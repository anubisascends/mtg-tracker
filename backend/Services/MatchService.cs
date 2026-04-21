using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Matches;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IMatchService
{
    Task<MatchResponse?> RecordMatchAsync(RecordMatchRequest request);
    Task<MatchResponse?> RecordResultAsync(int matchId, RecordMatchResultRequest request, int? requestingUserId = null);
    Task<List<MatchResponse>> GetByEventAsync(int eventId);
    Task<MatchResponse?> GetByIdAsync(int id);
    Task<bool> DeleteAsync(int id);
    Task<MatchResponse?> ReopenAsync(int matchId);
    Task<(MatchResponse? result, string? error)> CreatePendingMatchAsync(int eventId, int round, int player1Id, int? player2Id);
}

public class MatchService : IMatchService
{
    private readonly AppDbContext _db;

    public MatchService(AppDbContext db) => _db = db;

    public async Task<MatchResponse?> RecordMatchAsync(RecordMatchRequest request)
    {
        if (request.Player1Id == request.Player2Id) return null;

        var ev = await _db.Events.FindAsync(request.EventId);
        var p1 = await _db.Users.FindAsync(request.Player1Id);
        var p2 = await _db.Users.FindAsync(request.Player2Id);

        if (ev == null || p1 == null || p2 == null) return null;

        var match = new Match
        {
            EventId = request.EventId,
            Player1Id = request.Player1Id,
            Player2Id = request.Player2Id,
            Player1Wins = request.Player1Wins,
            Player2Wins = request.Player2Wins,
            Draws = request.Draws,
            Round = ev.CurrentRound > 0 ? ev.CurrentRound : 1,
            IsPending = false
        };

        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        return ToResponse(match, ev.Name, p1, p2);
    }

    public async Task<MatchResponse?> RecordResultAsync(int matchId, RecordMatchResultRequest request, int? requestingUserId = null)
    {
        var match = await _db.Matches
            .Include(m => m.Event)
            .Include(m => m.Player1)
            .Include(m => m.Player2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null || !match.IsPending || match.IsBye) return null;

        // Players can only record results for matches they participate in
        if (requestingUserId.HasValue &&
            match.Player1Id != requestingUserId.Value &&
            match.Player2Id != requestingUserId.Value)
            return null;

        // Validate: at least one game must be played, total games ≤ 3 (best-of-3)
        int totalGames = request.Player1Wins + request.Player2Wins + request.Draws;
        if (totalGames == 0) return null;
        if (totalGames > 3) return null;

        match.Player1Wins = request.Player1Wins;
        match.Player2Wins = request.Player2Wins;
        match.Draws = request.Draws;
        match.IsPending = false;
        match.RecordedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Auto-stop timer when all non-bye matches in the current round are done
        var ev = match.Event;
        if (ev.TimerStartedAt != null)
        {
            var stillPending = await _db.Matches.AnyAsync(m =>
                m.EventId == ev.Id &&
                m.Round == ev.CurrentRound &&
                m.IsPending &&
                !m.IsBye);

            if (!stillPending)
            {
                ev.TimerStartedAt = null;
                await _db.SaveChangesAsync();
            }
        }

        return ToResponse(match, match.Event.Name, match.Player1, match.Player2);
    }

    public async Task<List<MatchResponse>> GetByEventAsync(int eventId)
    {
        return await _db.Matches
            .Where(m => m.EventId == eventId)
            .Include(m => m.Event)
            .Include(m => m.Player1)
            .Include(m => m.Player2)
            .OrderBy(m => m.Round).ThenBy(m => m.Id)
            .Select(m => ToResponse(m, m.Event.Name, m.Player1, m.Player2))
            .ToListAsync();
    }

    public async Task<MatchResponse?> GetByIdAsync(int id)
    {
        var match = await _db.Matches
            .Include(m => m.Event)
            .Include(m => m.Player1)
            .Include(m => m.Player2)
            .FirstOrDefaultAsync(m => m.Id == id);

        return match == null ? null : ToResponse(match, match.Event.Name, match.Player1, match.Player2);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var match = await _db.Matches.FindAsync(id);
        if (match == null || !match.IsPending) return false;
        _db.Matches.Remove(match);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<MatchResponse?> ReopenAsync(int matchId)
    {
        var match = await _db.Matches
            .Include(m => m.Event)
            .Include(m => m.Player1)
            .Include(m => m.Player2)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null || match.IsBye || match.IsPending) return null;

        match.Player1Wins = 0;
        match.Player2Wins = 0;
        match.Draws = 0;
        match.IsPending = true;
        await _db.SaveChangesAsync();

        return ToResponse(match, match.Event.Name, match.Player1, match.Player2);
    }

    public async Task<(MatchResponse? result, string? error)> CreatePendingMatchAsync(int eventId, int round, int player1Id, int? player2Id)
    {
        var ev = await _db.Events
            .Include(e => e.EventRegistrations)
            .FirstOrDefaultAsync(e => e.Id == eventId);
        if (ev == null) return (null, "Event not found.");

        var p1Reg = ev.EventRegistrations.FirstOrDefault(r => r.PlayerId == player1Id);
        if (p1Reg == null || p1Reg.IsEliminated || p1Reg.IsDropped)
            return (null, "Player 1 is not an active participant.");

        var p1AlreadyPaired = await _db.Matches.AnyAsync(m =>
            m.EventId == eventId && m.Round == round &&
            (m.Player1Id == player1Id || (!m.IsBye && m.Player2Id == player1Id)));
        if (p1AlreadyPaired) return (null, "Player 1 is already paired this round.");

        bool isBye = !player2Id.HasValue;

        if (!isBye)
        {
            var p2Reg = ev.EventRegistrations.FirstOrDefault(r => r.PlayerId == player2Id!.Value);
            if (p2Reg == null || p2Reg.IsEliminated || p2Reg.IsDropped)
                return (null, "Player 2 is not an active participant.");

            var p2AlreadyPaired = await _db.Matches.AnyAsync(m =>
                m.EventId == eventId && m.Round == round &&
                (m.Player1Id == player2Id || (!m.IsBye && m.Player2Id == player2Id)));
            if (p2AlreadyPaired) return (null, "Player 2 is already paired this round.");
        }

        var p1 = await _db.Users.FindAsync(player1Id);
        if (p1 == null) return (null, "Player not found.");

        var match = new Match
        {
            EventId = eventId,
            Player1Id = player1Id,
            Player2Id = isBye ? player1Id : player2Id!.Value,
            Round = round,
            IsBye = isBye,
            IsPending = !isBye
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        var p2 = isBye ? p1 : (await _db.Users.FindAsync(player2Id!.Value))!;
        return (ToResponse(match, ev.Name, p1, p2), null);
    }

    internal static (int p1Points, int p2Points) CalculatePoints(Match m)
    {
        if (m.IsBye) return (1, 0);
        if (m.Player1Wins > m.Player2Wins) return (3, 0);
        if (m.Player2Wins > m.Player1Wins) return (0, 3);
        return (1, 1); // draw
    }

    private static MatchResponse ToResponse(Match m, string eventName, User p1, User p2)
    {
        var (p1Points, p2Points) = CalculatePoints(m);
        return new MatchResponse
        {
            Id = m.Id,
            EventId = m.EventId,
            EventName = eventName,
            Player1Id = m.Player1Id,
            Player1Username = p1.Username,
            Player1DisplayName = p1.Nickname ?? p1.Username,
            Player2Id = m.Player2Id,
            Player2Username = m.IsBye ? "" : p2.Username,
            Player2DisplayName = m.IsBye ? "BYE" : (p2.Nickname ?? p2.Username),
            Player1Wins = m.Player1Wins,
            Player2Wins = m.Player2Wins,
            Draws = m.Draws,
            Player1Points = m.IsPending ? 0 : p1Points,
            Player2Points = m.IsPending ? 0 : p2Points,
            IsBye = m.IsBye,
            IsPending = m.IsPending,
            Round = m.Round,
            RecordedAt = m.RecordedAt
        };
    }
}
