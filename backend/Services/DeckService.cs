using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Decks;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IDeckService
{
    Task<(DeckSubmissionResponse? result, string? error)> SubmitDeckAsync(int eventId, int playerId, SubmitDeckRequest request);
    Task<DeckSubmissionResponse?> GetMyDeckAsync(int eventId, int playerId);
    Task<DeckSubmissionResponse?> GetDeckForViewAsync(int eventId, int playerId);
    Task<List<DeckSubmissionResponse>> GetAllDecksAsync(int eventId);
}

public class DeckService : IDeckService
{
    private readonly AppDbContext _db;

    public DeckService(AppDbContext db) => _db = db;

    private static readonly HashSet<string> BasicLandNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes",
        "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp",
        "Snow-Covered Mountain", "Snow-Covered Forest", "Snow-Covered Wastes",
    };

    public async Task<(DeckSubmissionResponse? result, string? error)> SubmitDeckAsync(int eventId, int playerId, SubmitDeckRequest request)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return (null, "Event not found.");
        if (!ev.RequiresDeckRegistration) return (null, "This event does not require deck registration.");

        if (!ev.ProxiesAllowed && request.Cards.Any(c => c.IsProxy))
            return (null, "Proxies are not allowed in this event.");

        var reg = await _db.EventRegistrations.FirstOrDefaultAsync(r => r.EventId == eventId && r.PlayerId == playerId);
        if (reg == null) return (null, "You are not registered for this event.");

        // ── Deck validation ────────────────────────────────────────────────────
        bool isLimited    = ev.Format.Equals("Draft", StringComparison.OrdinalIgnoreCase)
                         || ev.Format.Equals("Sealed", StringComparison.OrdinalIgnoreCase);
        bool isCommander  = ev.Format.Equals("Commander", StringComparison.OrdinalIgnoreCase);

        var mainCards      = request.Cards.Where(c => c.Section == DeckSection.MainDeck).ToList();
        var sideboardCards = request.Cards.Where(c => c.Section == DeckSection.Sideboard).ToList();
        var commanderCards = request.Cards.Where(c => c.Section == DeckSection.Commander).ToList();

        int mainCount      = mainCards.Sum(c => c.Quantity);
        int sideboardCount = sideboardCards.Sum(c => c.Quantity);
        int commanderCount = commanderCards.Sum(c => c.Quantity);

        if (isCommander)
        {
            if (commanderCount == 0)
                return (null, "Commander decks require at least one card in the Commander zone.");
            int totalDeckSize = mainCount + commanderCount;
            if (totalDeckSize < 100)
                return (null, $"Commander decks must contain 100 cards (commander included). You have {totalDeckSize}.");

            // Singleton rule: max 1 of each non-basic land
            var allCards = request.Cards.GroupBy(c => c.CardName.Trim(), StringComparer.OrdinalIgnoreCase);
            foreach (var group in allCards)
            {
                if (BasicLandNames.Contains(group.Key)) continue;
                int qty = group.Sum(c => c.Quantity);
                if (qty > 1)
                    return (null, $"Commander is singleton — '{group.Key}' appears {qty} times (max 1).");
            }
        }
        else
        {
            int minMain = isLimited ? 40 : 60;
            if (mainCount < minMain)
                return (null, $"Main deck must contain at least {minMain} cards. You have {mainCount}.");

            if (sideboardCount > 15)
                return (null, $"Sideboard cannot exceed 15 cards. You have {sideboardCount}.");

            // 4-copy rule for all non-basic lands
            var allNonBasic = request.Cards
                .Where(c => !BasicLandNames.Contains(c.CardName.Trim()))
                .GroupBy(c => c.CardName.Trim(), StringComparer.OrdinalIgnoreCase);
            foreach (var group in allNonBasic)
            {
                int qty = group.Sum(c => c.Quantity);
                if (qty > 4)
                    return (null, $"'{group.Key}' appears {qty} times. Maximum 4 copies allowed.");
            }
        }

        var existing = await _db.DeckSubmissions
            .Include(d => d.Cards)
            .FirstOrDefaultAsync(d => d.EventId == eventId && d.PlayerId == playerId);

        if (existing != null)
        {
            _db.DeckCards.RemoveRange(existing.Cards);
            existing.Cards = request.Cards.Select(c => new DeckCard
            {
                CardName = c.CardName.Trim(),
                Quantity = Math.Max(1, c.Quantity),
                Section = c.Section,
                IsProxy = c.IsProxy
            }).ToList();
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return (await BuildResponse(existing.Id), null);
        }

        var submission = new DeckSubmission
        {
            EventId = eventId,
            PlayerId = playerId,
            Cards = request.Cards.Select(c => new DeckCard
            {
                CardName = c.CardName.Trim(),
                Quantity = Math.Max(1, c.Quantity),
                Section = c.Section,
                IsProxy = c.IsProxy
            }).ToList()
        };
        _db.DeckSubmissions.Add(submission);
        await _db.SaveChangesAsync();
        return (await BuildResponse(submission.Id), null);
    }

    public async Task<DeckSubmissionResponse?> GetMyDeckAsync(int eventId, int playerId)
    {
        var submission = await _db.DeckSubmissions
            .Include(d => d.Cards)
            .Include(d => d.Player)
            .FirstOrDefaultAsync(d => d.EventId == eventId && d.PlayerId == playerId);

        return submission == null ? null : ToResponse(submission);
    }

    public Task<DeckSubmissionResponse?> GetDeckForViewAsync(int eventId, int playerId)
        => GetMyDeckAsync(eventId, playerId);

    public async Task<List<DeckSubmissionResponse>> GetAllDecksAsync(int eventId)
    {
        return await _db.DeckSubmissions
            .Where(d => d.EventId == eventId)
            .Include(d => d.Cards)
            .Include(d => d.Player)
            .Select(d => ToResponse(d))
            .ToListAsync();
    }

    private async Task<DeckSubmissionResponse?> BuildResponse(int submissionId)
    {
        var s = await _db.DeckSubmissions
            .Include(d => d.Cards)
            .Include(d => d.Player)
            .FirstOrDefaultAsync(d => d.Id == submissionId);
        return s == null ? null : ToResponse(s);
    }

    private static DeckSubmissionResponse ToResponse(DeckSubmission s) => new()
    {
        Id = s.Id,
        EventId = s.EventId,
        PlayerId = s.PlayerId,
        PlayerDisplayName = s.Player.Nickname ?? s.Player.Username,
        SubmittedAt = s.SubmittedAt,
        UpdatedAt = s.UpdatedAt,
        Cards = s.Cards.Select(c => new DeckCardResponse
        {
            Id = c.Id,
            CardName = c.CardName,
            Quantity = c.Quantity,
            Section = c.Section.ToString(),
            IsProxy = c.IsProxy
        }).ToList()
    };
}
