using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.PlayerDecks;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IPlayerDeckService
{
    Task<List<PlayerDeckResponse>> GetMyDecksAsync(int playerId);
    Task<PlayerDeckResponse?> GetMyDeckAsync(int playerId, int deckId);
    Task<PlayerDeckResponse> CreateAsync(int playerId, SavePlayerDeckRequest request);
    Task<PlayerDeckResponse?> UpdateAsync(int playerId, int deckId, SavePlayerDeckRequest request);
    Task<bool> DeleteAsync(int playerId, int deckId);
}

public class PlayerDeckService : IPlayerDeckService
{
    private readonly AppDbContext _db;

    public PlayerDeckService(AppDbContext db) => _db = db;

    public async Task<List<PlayerDeckResponse>> GetMyDecksAsync(int playerId) =>
        await _db.PlayerDecks
            .Where(d => d.PlayerId == playerId)
            .Include(d => d.Cards)
            .OrderByDescending(d => d.UpdatedAt)
            .Select(d => ToResponse(d))
            .ToListAsync();

    public async Task<PlayerDeckResponse?> GetMyDeckAsync(int playerId, int deckId)
    {
        var deck = await _db.PlayerDecks
            .Include(d => d.Cards)
            .FirstOrDefaultAsync(d => d.Id == deckId && d.PlayerId == playerId);
        return deck == null ? null : ToResponse(deck);
    }

    public async Task<PlayerDeckResponse> CreateAsync(int playerId, SavePlayerDeckRequest request)
    {
        var deck = new PlayerDeck
        {
            PlayerId = playerId,
            Name = request.Name.Trim(),
            Format = request.Format?.Trim(),
            Cards = request.Cards.Select(ToCard).ToList()
        };
        _db.PlayerDecks.Add(deck);
        await _db.SaveChangesAsync();
        return (await GetMyDeckAsync(playerId, deck.Id))!;
    }

    public async Task<PlayerDeckResponse?> UpdateAsync(int playerId, int deckId, SavePlayerDeckRequest request)
    {
        var deck = await _db.PlayerDecks
            .Include(d => d.Cards)
            .FirstOrDefaultAsync(d => d.Id == deckId && d.PlayerId == playerId);
        if (deck == null) return null;

        _db.PlayerDeckCards.RemoveRange(deck.Cards);
        deck.Name = request.Name.Trim();
        deck.Format = request.Format?.Trim();
        deck.Cards = request.Cards.Select(ToCard).ToList();
        deck.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await GetMyDeckAsync(playerId, deckId))!;
    }

    public async Task<bool> DeleteAsync(int playerId, int deckId)
    {
        var deck = await _db.PlayerDecks
            .FirstOrDefaultAsync(d => d.Id == deckId && d.PlayerId == playerId);
        if (deck == null) return false;
        _db.PlayerDecks.Remove(deck);
        await _db.SaveChangesAsync();
        return true;
    }

    private static PlayerDeckCard ToCard(PlayerDeckCardRequest c) => new()
    {
        CardName = c.CardName.Trim(),
        Quantity = Math.Max(1, c.Quantity),
        Section = c.Section,
        IsProxy = c.IsProxy
    };

    private static PlayerDeckResponse ToResponse(PlayerDeck d) => new()
    {
        Id = d.Id,
        Name = d.Name,
        Format = d.Format,
        TotalCards = d.Cards.Sum(c => c.Quantity),
        CreatedAt = d.CreatedAt,
        UpdatedAt = d.UpdatedAt,
        Cards = d.Cards.Select(c => new PlayerDeckCardResponse
        {
            Id = c.Id,
            CardName = c.CardName,
            Quantity = c.Quantity,
            Section = c.Section.ToString(),
            IsProxy = c.IsProxy
        }).ToList()
    };
}
