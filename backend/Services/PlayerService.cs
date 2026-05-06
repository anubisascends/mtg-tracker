using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Players;
using MtgTracker.Api.DTOs.Registrations;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IPlayerService
{
    Task<List<PlayerResponse>> GetAllAsync(bool archived = false);
    Task<PlayerResponse?> GetByIdAsync(int id);
    Task<List<RegistrationResponse>> GetRegistrationsForPlayerAsync(int playerId);
    Task<(PlayerResponse? player, string? error)> UpdateAsync(int id, UpdatePlayerRequest request);
    Task<string?> DeleteAsync(int id, int requestingUserId);
    Task<bool> UnarchiveAsync(int id);
}

public class PlayerService : IPlayerService
{
    private readonly AppDbContext _db;

    public PlayerService(AppDbContext db) => _db = db;

    public async Task<List<PlayerResponse>> GetAllAsync(bool archived = false)
    {
        return await _db.Users
            .Where(u => u.IsArchived == archived)
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
            Role = user.Role,
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

    public async Task<(PlayerResponse? player, string? error)> UpdateAsync(int id, UpdatePlayerRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return (null, null);

        var validRoles = new[] { "player", "admin" };
        if (!validRoles.Contains(request.Role))
            return (null, "Role must be 'player' or 'admin'.");

        var duplicate = await _db.Users.AnyAsync(u =>
            u.Id != id && (u.Username == request.Username || u.Email == request.Email));
        if (duplicate)
            return (null, "Username or email is already in use.");

        user.Username = request.Username.Trim();
        user.Email = request.Email.Trim();
        user.Nickname = string.IsNullOrWhiteSpace(request.Nickname) ? null : request.Nickname.Trim();
        user.Role = request.Role;

        await _db.SaveChangesAsync();
        return (await GetByIdAsync(id), null);
    }

    public async Task<string?> DeleteAsync(int id, int requestingUserId)
    {
        if (id == requestingUserId)
            return "Cannot delete your own account.";

        var user = await _db.Users.FindAsync(id);
        if (user == null) return "not_found";

        var hasMatches = await _db.Matches.AnyAsync(m => m.Player1Id == id || m.Player2Id == id);
        if (hasMatches)
        {
            user.IsArchived = true;
            await _db.SaveChangesAsync();
            return null;
        }

        var submissions = await _db.DeckSubmissions
            .Where(d => d.PlayerId == id)
            .Include(d => d.Cards)
            .ToListAsync();
        _db.DeckSubmissions.RemoveRange(submissions);

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return null;
    }

    public async Task<bool> UnarchiveAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;

        user.IsArchived = false;
        await _db.SaveChangesAsync();
        return true;
    }

    private static PlayerResponse ToResponse(MtgTracker.Api.Models.User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        Nickname = u.Nickname,
        Email = u.Email,
        Role = u.Role,
        LifetimeWins = u.LifetimeWins,
        LifetimeLosses = u.LifetimeLosses,
        LifetimeDraws = u.LifetimeDraws,
        CreatedAt = u.CreatedAt
    };
}
