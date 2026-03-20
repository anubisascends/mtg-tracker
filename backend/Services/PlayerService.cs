using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Players;
using MtgTracker.Api.DTOs.Registrations;

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
        return user == null ? null : ToResponse(user);
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
