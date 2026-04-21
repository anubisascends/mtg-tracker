using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Events;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IEventService
{
    Task<List<EventResponse>> GetAllAsync(bool isAdmin);
    Task<EventResponse?> GetByIdAsync(int id, bool isAdmin);
    Task<EventResponse> CreateAsync(CreateEventRequest request);
    Task<EventResponse?> UpdateAsync(int id, UpdateEventRequest request);
    Task<bool> DeleteAsync(int id);
    Task<EventResponse?> AdvanceStatusAsync(int id);
    Task<EventResponse?> AdvanceRunPhaseAsync(int id);
    Task<(EventResponse? response, string? error)> GenerateNextRoundAsync(int eventId);
    Task<(EventResponse? response, string? error)> ReverseRunPhaseAsync(int id);
    Task<(EventResponse? response, string? error)> ReverseStatusAsync(int id);
    Task<List<EventPlayerScoreResponse>> GetEventScoresAsync(int eventId);
    Task<EventResponse?> StartTimerAsync(int eventId, int durationSeconds);
    Task<EventResponse?> StopTimerAsync(int eventId);
}

public class EventService : IEventService
{
    private readonly AppDbContext _db;

    private static readonly Dictionary<string, RunPhase[]> FormatPhases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"]     = [RunPhase.Initializing, RunPhase.Drafting, RunPhase.DeckBuilding, RunPhase.Playing, RunPhase.Completed],
        ["Sealed"]    = [RunPhase.Initializing, RunPhase.DeckBuilding, RunPhase.Playing, RunPhase.Completed],
        ["Commander"] = [RunPhase.Initializing, RunPhase.PodAssignment, RunPhase.Playing, RunPhase.Completed],
    };

    private static readonly RunPhase[] ConstructedPhases =
        [RunPhase.Initializing, RunPhase.Playing, RunPhase.Completed];

    public EventService(AppDbContext db) => _db = db;

    public async Task<List<EventResponse>> GetAllAsync(bool isAdmin)
    {
        var query = _db.Events.Include(e => e.EventRegistrations).AsQueryable();
        if (!isAdmin) query = query.Where(e => e.Status != EventStatus.Planning);
        return await query.Select(e => ToResponse(e)).ToListAsync();
    }

    public async Task<EventResponse?> GetByIdAsync(int id, bool isAdmin)
    {
        var ev = await _db.Events.Include(e => e.EventRegistrations).FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return null;
        if (!isAdmin && ev.Status == EventStatus.Planning) return null;
        return ToResponse(ev);
    }

    public async Task<EventResponse> CreateAsync(CreateEventRequest request)
    {
        var ev = new Event
        {
            Name = request.Name,
            Description = request.Description,
            Format = request.Format,
            Date = request.Date,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            MaxPlayers = request.MaxPlayers,
            EliminationType = request.EliminationType,
            RequiresDeckRegistration = request.RequiresDeckRegistration,
            ProxiesAllowed = request.ProxiesAllowed,
            Status = EventStatus.Planning
        };
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public async Task<EventResponse?> UpdateAsync(int id, UpdateEventRequest request)
    {
        var ev = await _db.Events.Include(e => e.EventRegistrations).FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return null;
        if (ev.Status == EventStatus.Planning)
        {
            if (request.Name != null) ev.Name = request.Name;
            if (request.Description != null) ev.Description = request.Description;
            if (request.Format != null) ev.Format = request.Format;
            if (request.Date.HasValue) ev.Date = request.Date.Value;
            if (request.MaxPlayers.HasValue) ev.MaxPlayers = request.MaxPlayers.Value;
            if (request.EliminationType.HasValue) ev.EliminationType = request.EliminationType.Value;
            if (request.RequiresDeckRegistration.HasValue) ev.RequiresDeckRegistration = request.RequiresDeckRegistration.Value;
            if (request.ProxiesAllowed.HasValue) ev.ProxiesAllowed = request.ProxiesAllowed.Value;
        }
        if (request.StartTime.HasValue) ev.StartTime = request.StartTime.Value;
        if (request.EndTime.HasValue) ev.EndTime = request.EndTime.Value;
        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return false;
        _db.Events.Remove(ev);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<EventResponse?> AdvanceStatusAsync(int id)
    {
        var ev = await _db.Events
            .Include(e => e.EventRegistrations).ThenInclude(r => r.Player)
            .Include(e => e.Matches).ThenInclude(m => m.Player1)
            .Include(e => e.Matches).ThenInclude(m => m.Player2)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null || ev.Status == EventStatus.Completed) return null;

        ev.Status = ev.Status switch
        {
            EventStatus.Planning   => EventStatus.Upcoming,
            EventStatus.Upcoming   => EventStatus.InProgress,
            EventStatus.InProgress => EventStatus.Completed,
            _                      => ev.Status
        };

        if (ev.Status == EventStatus.InProgress)
            ev.RunPhase = RunPhase.Initializing;
        else if (ev.Status == EventStatus.Completed)
        {
            ev.RunPhase = null;
            await TallyEventStatsAsync(ev);
        }

        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public async Task<EventResponse?> AdvanceRunPhaseAsync(int id)
    {
        var ev = await _db.Events
            .Include(e => e.EventRegistrations)
            .Include(e => e.Matches).ThenInclude(m => m.Player1)
            .Include(e => e.Matches).ThenInclude(m => m.Player2)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null || ev.Status != EventStatus.InProgress || ev.RunPhase == null) return null;

        var phases = GetPhasesForFormat(ev.Format);
        var currentIndex = Array.IndexOf(phases, ev.RunPhase.Value);
        if (currentIndex < 0 || currentIndex >= phases.Length - 1) return null;

        var nextPhase = phases[currentIndex + 1];
        ev.RunPhase = nextPhase;

        if (nextPhase == RunPhase.Playing)
        {
            ev.CurrentRound = 1;

            // Auto-generate round 1 pairings (all players have 0 pts so order is random — correct for round 1)
            var activePlayers = ev.EventRegistrations
                .Where(r => !r.IsEliminated && !r.IsDropped)
                .Select(r => r.PlayerId)
                .ToList();

            if (activePlayers.Count >= 2)
            {
                var pairings = GenerateSwissPairings(activePlayers, [], []);
                foreach (var (p1Id, p2Id) in pairings)
                {
                    ev.Matches.Add(new Match
                    {
                        EventId = ev.Id,
                        Player1Id = p1Id,
                        Player2Id = p2Id ?? p1Id,
                        Round = 1,
                        IsBye = !p2Id.HasValue,
                        IsPending = p2Id.HasValue,
                    });
                }
            }
        }
        else if (nextPhase == RunPhase.Completed)
        {
            ev.Status = EventStatus.Completed;
            ev.RunPhase = null;
            await TallyEventStatsAsync(ev);
        }

        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public async Task<(EventResponse? response, string? error)> ReverseRunPhaseAsync(int id)
    {
        var ev = await _db.Events
            .Include(e => e.Matches)
            .Include(e => e.EventRegistrations)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null || ev.Status != EventStatus.InProgress || ev.RunPhase == null)
            return (null, "Event is not in progress.");

        var phases = GetPhasesForFormat(ev.Format);
        var currentIndex = Array.IndexOf(phases, ev.RunPhase.Value);
        if (currentIndex <= 0)
            return (null, "Already at the first phase.");

        var prevPhase = phases[currentIndex - 1];

        // If going back from Playing, clear pending matches and reset round
        if (ev.RunPhase == RunPhase.Playing)
        {
            var pendingMatches = ev.Matches.Where(m => m.IsPending).ToList();
            if (pendingMatches.Count > 0)
                return (null, $"Cannot go back: {pendingMatches.Count} pending match(es) must be completed or removed first.");
            // Remove all matches from round 1 that were created manually (completed ones keep history)
            var round1Matches = ev.Matches.Where(m => m.Round == ev.CurrentRound).ToList();
            _db.Matches.RemoveRange(round1Matches);
            ev.CurrentRound = 0;
        }

        ev.RunPhase = prevPhase;
        await _db.SaveChangesAsync();
        return (ToResponse(ev), null);
    }

    public async Task<(EventResponse? response, string? error)> ReverseStatusAsync(int id)
    {
        var ev = await _db.Events
            .Include(e => e.EventRegistrations)
            .Include(e => e.Matches)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null) return (null, "Event not found.");

        if (ev.Status == EventStatus.Planning)
            return (null, "Event is already at the earliest status.");

        if (ev.Status == EventStatus.Completed)
        {
            ev.Status = EventStatus.InProgress;
            ev.RunPhase = RunPhase.Playing;
            await _db.SaveChangesAsync();
            return (ToResponse(ev), null);
        }

        if (ev.Status == EventStatus.InProgress)
        {
            if (ev.RunPhase != RunPhase.Initializing)
                return (null, "Can only go back to Upcoming from the Initializing phase. Use the phase back button first.");
            if (ev.Matches.Count > 0)
                return (null, "Cannot go back: matches have already been recorded.");
            ev.Status = EventStatus.Upcoming;
            ev.RunPhase = null;
            ev.CurrentRound = 0;
        }
        else // Upcoming → Planning
        {
            ev.Status = EventStatus.Planning;
        }

        await _db.SaveChangesAsync();
        return (ToResponse(ev), null);
    }

    public async Task<(EventResponse? response, string? error)> GenerateNextRoundAsync(int eventId)
    {
        var ev = await _db.Events
            .Include(e => e.EventRegistrations).ThenInclude(r => r.Player)
            .Include(e => e.Matches)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (ev == null || ev.Status != EventStatus.InProgress || ev.RunPhase != RunPhase.Playing)
            return (null, "Event is not in the Playing phase.");

        var pendingInRound = ev.Matches.Where(m => m.Round == ev.CurrentRound && m.IsPending).ToList();
        if (pendingInRound.Count > 0)
            return (null, $"{pendingInRound.Count} match(es) in round {ev.CurrentRound} are still pending.");

        // Apply eliminations before pairing
        ApplyEliminations(ev);
        await _db.SaveChangesAsync();

        // Active players sorted by current points (Swiss ranking)
        var completedMatches = ev.Matches.Where(m => !m.IsPending).ToList();
        var playerPoints = new Dictionary<int, int>();
        foreach (var reg in ev.EventRegistrations.Where(r => !r.IsEliminated && !r.IsDropped))
        {
            var pid = reg.PlayerId;
            int pts = completedMatches
                .Where(m => m.Player1Id == pid || (!m.IsBye && m.Player2Id == pid))
                .Sum(m => { var (p1, p2) = MatchService.CalculatePoints(m); return m.Player1Id == pid ? p1 : p2; });
            playerPoints[pid] = pts;
        }

        var sortedPlayers = playerPoints.Keys
            .OrderByDescending(pid => playerPoints[pid])
            .ToList();

        if (sortedPlayers.Count < 2)
            return (null, "Not enough active players to generate a new round.");

        // Rematch tracking
        var prevPairs = ev.Matches
            .Where(m => !m.IsBye)
            .Select(m => (Math.Min(m.Player1Id, m.Player2Id), Math.Max(m.Player1Id, m.Player2Id)))
            .ToHashSet();

        var prevByeRecipients = ev.Matches
            .Where(m => m.IsBye)
            .Select(m => m.Player1Id)
            .ToHashSet();

        var nextRound = ev.CurrentRound + 1;
        var pairings = GenerateSwissPairings(sortedPlayers, prevPairs, prevByeRecipients);

        ev.CurrentRound = nextRound;

        foreach (var (p1Id, p2Id) in pairings)
        {
            ev.Matches.Add(new Match
            {
                EventId = eventId,
                Player1Id = p1Id,
                Player2Id = p2Id ?? p1Id,
                Round = nextRound,
                IsBye = !p2Id.HasValue,
                IsPending = p2Id.HasValue,
            });
        }

        await _db.SaveChangesAsync();
        return (ToResponse(ev), null);
    }

    private static List<(int, int?)> GenerateSwissPairings(
        List<int> sortedPlayers,
        HashSet<(int, int)> prevPairs,
        HashSet<int> prevByeRecipients)
    {
        var result = new List<(int, int?)>();
        var unpaired = new List<int>(sortedPlayers);

        // Assign bye to lowest-ranked player without a previous bye (odd count)
        if (unpaired.Count % 2 == 1)
        {
            var byePlayer = -1;
            for (int i = unpaired.Count - 1; i >= 0; i--)
            {
                if (!prevByeRecipients.Contains(unpaired[i])) { byePlayer = unpaired[i]; break; }
            }
            if (byePlayer < 0) byePlayer = unpaired[^1]; // all have byes — give to last
            unpaired.Remove(byePlayer);
            result.Add((byePlayer, null));
        }

        // Greedy Swiss: pair highest-ranked player with nearest opponent avoiding rematches
        while (unpaired.Count >= 2)
        {
            var p1 = unpaired[0];
            unpaired.RemoveAt(0);

            var opponentIdx = -1;
            for (int i = 0; i < unpaired.Count; i++)
            {
                var key = (Math.Min(p1, unpaired[i]), Math.Max(p1, unpaired[i]));
                if (!prevPairs.Contains(key)) { opponentIdx = i; break; }
            }
            if (opponentIdx < 0) opponentIdx = 0; // forced rematch as last resort

            var p2 = unpaired[opponentIdx];
            unpaired.RemoveAt(opponentIdx);
            result.Add((p1, p2));
        }

        return result;
    }

    private void ApplyEliminations(Event ev)
    {
        if (ev.EliminationType == EliminationType.Swiss) return;

        var completedMatches = ev.Matches
            .Where(m => m.Round == ev.CurrentRound && !m.IsBye && !m.IsPending)
            .ToList();

        foreach (var m in completedMatches)
        {
            if (m.Player1Wins == m.Player2Wins) continue; // draw = no elimination

            var loserId = m.Player1Wins < m.Player2Wins ? m.Player1Id : m.Player2Id;
            var loserReg = ev.EventRegistrations.FirstOrDefault(r => r.PlayerId == loserId);
            if (loserReg == null) continue;

            loserReg.EventLosses++;

            if (ev.EliminationType == EliminationType.SingleElimination || loserReg.EventLosses >= 2)
                loserReg.IsEliminated = true;
        }
    }

    // ── Stats tally ────────────────────────────────────────────────────────────

    private static async Task TallyEventStatsAsync(Event ev)
    {
        foreach (var match in ev.Matches.Where(m => !m.IsPending && !m.IsBye))
        {
            if (match.Player1Wins > match.Player2Wins)
            {
                match.Player1.LifetimeWins++;
                match.Player2.LifetimeLosses++;
            }
            else if (match.Player2Wins > match.Player1Wins)
            {
                match.Player2.LifetimeWins++;
                match.Player1.LifetimeLosses++;
            }
            else
            {
                match.Player1.LifetimeDraws++;
                match.Player2.LifetimeDraws++;
            }
        }
        await Task.CompletedTask;
    }

    // ── Scores endpoint ────────────────────────────────────────────────────────

    public async Task<List<EventPlayerScoreResponse>> GetEventScoresAsync(int eventId)
    {
        var registrations = await _db.EventRegistrations
            .Where(r => r.EventId == eventId)
            .Include(r => r.Player)
            .ToListAsync();

        var matches = await _db.Matches
            .Where(m => m.EventId == eventId && !m.IsPending)
            .ToListAsync();

        // First pass: build per-player basic stats including MWP and GWP
        var stats = new Dictionary<int, PlayerStats>();
        foreach (var reg in registrations)
        {
            var pid = reg.PlayerId;
            int points = 0, mWins = 0, mLosses = 0, mDraws = 0, byes = 0;
            int gWins = 0, gLosses = 0, gDraws = 0;

            foreach (var m in matches.Where(m => !m.IsBye))
            {
                var (p1Pts, p2Pts) = MatchService.CalculatePoints(m);
                if (m.Player1Id == pid)
                {
                    points += p1Pts;
                    if (m.Player1Wins > m.Player2Wins) mWins++;
                    else if (m.Player2Wins > m.Player1Wins) mLosses++;
                    else mDraws++;
                    gWins += m.Player1Wins; gLosses += m.Player2Wins; gDraws += m.Draws;
                }
                else if (m.Player2Id == pid)
                {
                    points += p2Pts;
                    if (m.Player2Wins > m.Player1Wins) mWins++;
                    else if (m.Player1Wins > m.Player2Wins) mLosses++;
                    else mDraws++;
                    gWins += m.Player2Wins; gLosses += m.Player1Wins; gDraws += m.Draws;
                }
            }
            foreach (var _ in matches.Where(m => m.IsBye && m.Player1Id == pid))
            { points++; byes++; }

            int totalM = mWins + mLosses + mDraws;
            int totalG = gWins + gLosses + gDraws;
            stats[pid] = new PlayerStats
            {
                Registration = reg,
                Points = points,
                MWins = mWins, MLosses = mLosses, MDraws = mDraws, Byes = byes,
                GWins = gWins,
                MatchWinPct = totalM > 0 ? Math.Max(1.0 / 3, (double)mWins / totalM) : 1.0 / 3,
                GameWinPct  = totalG > 0 ? Math.Max(1.0 / 3, (double)gWins / totalG) : 1.0 / 3,
            };
        }

        // Second pass: opponent-based tiebreakers (OMW%, OGW%)
        var result = new List<EventPlayerScoreResponse>();
        foreach (var (pid, ps) in stats)
        {
            var opponents = matches
                .Where(m => !m.IsBye && (m.Player1Id == pid || m.Player2Id == pid))
                .Select(m => m.Player1Id == pid ? m.Player2Id : m.Player1Id)
                .Distinct().ToList();

            double omwp = opponents.Count > 0
                ? Math.Max(1.0 / 3, opponents.Average(o => stats.TryGetValue(o, out var os) ? os.MatchWinPct : 1.0 / 3))
                : 1.0 / 3;
            double ogwp = opponents.Count > 0
                ? Math.Max(1.0 / 3, opponents.Average(o => stats.TryGetValue(o, out var os) ? os.GameWinPct  : 1.0 / 3))
                : 1.0 / 3;

            result.Add(new EventPlayerScoreResponse
            {
                RegistrationId = ps.Registration.Id,
                PlayerId = pid,
                PlayerDisplayName = ps.Registration.Player.Nickname ?? ps.Registration.Player.Username,
                Points = ps.Points,
                MatchWins = ps.MWins, MatchLosses = ps.MLosses, MatchDraws = ps.MDraws, Byes = ps.Byes,
                IsEliminated = ps.Registration.IsEliminated,
                EventLosses = ps.Registration.EventLosses,
                IsDropped = ps.Registration.IsDropped,
                DroppedAtRound = ps.Registration.DroppedAtRound,
                OpponentMatchWinPct = Math.Round(omwp * 100, 1),
                GameWinPct          = Math.Round(ps.GameWinPct * 100, 1),
                OpponentGameWinPct  = Math.Round(ogwp * 100, 1),
            });
        }

        return result
            .OrderByDescending(s => s.Points)
            .ThenByDescending(s => s.OpponentMatchWinPct)
            .ThenByDescending(s => s.GameWinPct)
            .ThenByDescending(s => s.OpponentGameWinPct)
            .ThenBy(s => s.PlayerDisplayName)
            .ToList();
    }

    private sealed class PlayerStats
    {
        public EventRegistration Registration { get; set; } = null!;
        public int Points { get; set; }
        public int MWins { get; set; }
        public int MLosses { get; set; }
        public int MDraws { get; set; }
        public int Byes { get; set; }
        public int GWins { get; set; }
        public double MatchWinPct { get; set; }
        public double GameWinPct { get; set; }
    }

    public async Task<EventResponse?> StartTimerAsync(int eventId, int durationSeconds)
    {
        var ev = await _db.Events.Include(e => e.EventRegistrations).FirstOrDefaultAsync(e => e.Id == eventId);
        if (ev == null) return null;
        ev.TimerDurationSeconds = durationSeconds;
        ev.TimerStartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public async Task<EventResponse?> StopTimerAsync(int eventId)
    {
        var ev = await _db.Events.Include(e => e.EventRegistrations).FirstOrDefaultAsync(e => e.Id == eventId);
        if (ev == null) return null;
        ev.TimerStartedAt = null;
        await _db.SaveChangesAsync();
        return ToResponse(ev);
    }

    public static RunPhase[] GetPhasesForFormat(string format)
        => FormatPhases.TryGetValue(format, out var phases) ? phases : ConstructedPhases;

    private static EventResponse ToResponse(Event ev) => new()
    {
        Id = ev.Id,
        Name = ev.Name,
        Description = ev.Description,
        Format = ev.Format,
        Date = ev.Date,
        StartTime = ev.StartTime,
        EndTime = ev.EndTime,
        Status = ev.Status.ToString(),
        RunPhase = ev.RunPhase?.ToString(),
        EliminationType = ev.EliminationType.ToString(),
        CurrentRound = ev.CurrentRound,
        MaxPlayers = ev.MaxPlayers,
        TimerDurationSeconds = ev.TimerDurationSeconds,
        TimerStartedAt = ev.TimerStartedAt.HasValue
            ? DateTime.SpecifyKind(ev.TimerStartedAt.Value, DateTimeKind.Utc)
            : null,
        RegisteredCount = ev.EventRegistrations?.Count ?? 0,
        RequiresDeckRegistration = ev.RequiresDeckRegistration,
        ProxiesAllowed = ev.ProxiesAllowed,
        CreatedAt = ev.CreatedAt
    };
}
