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
            return (null, "Cannot reverse a completed event.");

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

        // Determine active players
        var activePlayerIds = ev.EventRegistrations
            .Where(r => !r.IsEliminated && !r.IsDropped)
            .Select(r => r.PlayerId)
            .ToList();

        if (activePlayerIds.Count < 2)
            return (null, "Not enough active players to generate a new round.");

        ev.CurrentRound++;

        await _db.SaveChangesAsync();
        return (ToResponse(ev), null);
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

        return registrations.Select(reg =>
        {
            var pid = reg.PlayerId;
            int points = 0, wins = 0, losses = 0, draws = 0, byes = 0;

            foreach (var m in matches.Where(m => !m.IsBye))
            {
                var (p1Pts, p2Pts) = MatchService.CalculatePoints(m);
                if (m.Player1Id == pid)
                {
                    points += p1Pts;
                    if (m.Player1Wins > m.Player2Wins) wins++;
                    else if (m.Player2Wins > m.Player1Wins) losses++;
                    else draws++;
                }
                else if (m.Player2Id == pid)
                {
                    points += p2Pts;
                    if (m.Player2Wins > m.Player1Wins) wins++;
                    else if (m.Player1Wins > m.Player2Wins) losses++;
                    else draws++;
                }
            }

            foreach (var _ in matches.Where(m => m.IsBye && m.Player1Id == pid))
            {
                points++;
                byes++;
            }

            return new EventPlayerScoreResponse
            {
                RegistrationId = reg.Id,
                PlayerId = pid,
                PlayerDisplayName = reg.Player.Nickname ?? reg.Player.Username,
                Points = points,
                MatchWins = wins,
                MatchLosses = losses,
                MatchDraws = draws,
                Byes = byes,
                IsEliminated = reg.IsEliminated,
                EventLosses = reg.EventLosses,
                IsDropped = reg.IsDropped,
                DroppedAtRound = reg.DroppedAtRound
            };
        })
        .OrderByDescending(s => s.Points)
        .ThenBy(s => s.PlayerDisplayName)
        .ToList();
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
