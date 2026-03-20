using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Decks;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IDeckService
{
    Task<(DeckSubmissionResponse? result, string? error)> SubmitDeckAsync(int eventId, int playerId, SubmitDeckRequest request);
    Task<DeckSubmissionResponse?> GetMyDeckAsync(int eventId, int playerId);
    Task<List<DeckSubmissionResponse>> GetAllDecksAsync(int eventId);
}

public class DeckService : IDeckService
{
    private readonly AppDbContext _db;

    public DeckService(AppDbContext db) => _db = db;

    public async Task<(DeckSubmissionResponse? result, string? error)> SubmitDeckAsync(int eventId, int playerId, SubmitDeckRequest request)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return (null, "Event not found.");
        if (!ev.RequiresDeckRegistration) return (null, "This event does not require deck registration.");

        if (!ev.ProxiesAllowed && request.Cards.Any(c => c.IsProxy))
            return (null, "Proxies are not allowed in this event.");

        var reg = await _db.EventRegistrations.FirstOrDefaultAsync(r => r.EventId == eventId && r.PlayerId == playerId);
        if (reg == null) return (null, "You are not registered for this event.");

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
