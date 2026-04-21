using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Players;
using MtgTracker.Api.DTOs.Registrations;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IPlayerService
{
    Task<List<PlayerResponse>> GetAllAsync();
    Task<PlayerResponse?> GetByIdAsync(int id);
    Task<List<RegistrationResponse>> GetRegistrationsForPlayerAsync(int playerId);
}

public class PlayerService : IPlayerService
{
    private readonly AppDbContext _db;

    public PlayerService(AppDbContext db) => _db = db;

    public async Task<List<PlayerResponse>> GetAllAsync()
    {
        return await _db.Users
            .Where(u => u.Role == "player")
            .Select(u => ToResponse(u))
            .ToListAsync();
    }

    public async Task<PlayerResponse?> GetByIdAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return null;

        // Compute lifetime stats dynamically so they stay accurate regardless of event completion status
        var matches = await _db.Matches
            .Where(m => !m.IsPending && !m.IsBye && (m.Player1Id == id || m.Player2Id == id))
            .ToListAsync();

        int wins = 0, losses = 0, draws = 0;
        foreach (var m in matches)
        {
            bool isP1 = m.Player1Id == id;
            int myWins  = isP1 ? m.Player1Wins : m.Player2Wins;
            int oppWins = isP1 ? m.Player2Wins : m.Player1Wins;
            if (myWins > oppWins) wins++;
            else if (oppWins > myWins) losses++;
            else draws++;
        }

        return new PlayerResponse
        {
            Id = user.Id,
            Username = user.Username,
            Nickname = user.Nickname,
            Email = user.Email,
            LifetimeWins = wins,
            LifetimeLosses = losses,
            LifetimeDraws = draws,
            CreatedAt = user.CreatedAt,
        };
    }

    public async Task<List<RegistrationResponse>> GetRegistrationsForPlayerAsync(int playerId)
    {
        return await _db.EventRegistrations
            .Where(r => r.PlayerId == playerId)
            .Include(r => r.Event)
            .Select(r => new RegistrationResponse
            {
                Id = r.Id,
                EventId = r.EventId,
                PlayerId = r.PlayerId,
                PlayerUsername = r.Player.Username,
                RegisteredAt = r.RegisteredAt
            })
            .ToListAsync();
    }

    private static PlayerResponse ToResponse(MtgTracker.Api.Models.User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        Nickname = u.Nickname,
        Email = u.Email,
        LifetimeWins = u.LifetimeWins,
        LifetimeLosses = u.LifetimeLosses,
        LifetimeDraws = u.LifetimeDraws,
        CreatedAt = u.CreatedAt
    };
}
