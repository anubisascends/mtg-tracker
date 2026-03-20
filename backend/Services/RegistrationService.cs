using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Registrations;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IRegistrationService
{
    Task<RegistrationResponse?> RegisterAsync(int eventId, int playerId);
    Task<(RegistrationResponse? result, string? error)> AdminRegisterAsync(int eventId, int playerId);
    Task<List<RegistrationResponse>> GetByEventAsync(int eventId);
    Task<bool> CancelAsync(int registrationId, int requestingUserId, string requestingUserRole);
    Task<(RegistrationResponse? result, string? error)> DropPlayerAsync(int registrationId, int currentRound);
    Task<(RegistrationResponse? result, string? error)> UndropPlayerAsync(int registrationId, int currentRound);
}

public class RegistrationService : IRegistrationService
{
    private readonly AppDbContext _db;

    public RegistrationService(AppDbContext db) => _db = db;

    public async Task<RegistrationResponse?> RegisterAsync(int eventId, int playerId)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null || ev.Status != EventStatus.Upcoming) return null;

        var alreadyRegistered = await _db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.PlayerId == playerId);
        if (alreadyRegistered) return null;

        var currentCount = await _db.EventRegistrations.CountAsync(r => r.EventId == eventId);
        if (currentCount >= ev.MaxPlayers) return null;

        var reg = new EventRegistration { EventId = eventId, PlayerId = playerId };
        _db.EventRegistrations.Add(reg);
        await _db.SaveChangesAsync();

        var player = await _db.Users.FindAsync(playerId);

        return new RegistrationResponse
        {
            Id = reg.Id,
            EventId = reg.EventId,
            PlayerId = reg.PlayerId,
            PlayerUsername = player?.Username ?? string.Empty,
            PlayerDisplayName = player?.Nickname ?? player?.Username ?? string.Empty,
            IsEliminated = reg.IsEliminated,
            EventLosses = reg.EventLosses,
            RegisteredAt = reg.RegisteredAt
        };
    }

    public async Task<(RegistrationResponse? result, string? error)> AdminRegisterAsync(int eventId, int playerId)
    {
        var ev = await _db.Events.FindAsync(eventId);
        if (ev == null) return (null, "Event not found.");
        if (ev.Status == EventStatus.InProgress || ev.Status == EventStatus.Completed)
            return (null, "Cannot register players after an event has started.");

        var alreadyRegistered = await _db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.PlayerId == playerId);
        if (alreadyRegistered) return (null, "Player is already registered for this event.");

        var currentCount = await _db.EventRegistrations.CountAsync(r => r.EventId == eventId);
        if (currentCount >= ev.MaxPlayers) return (null, "Event is full.");

        var player = await _db.Users.FindAsync(playerId);
        if (player == null) return (null, "Player not found.");

        var reg = new EventRegistration { EventId = eventId, PlayerId = playerId };
        _db.EventRegistrations.Add(reg);
        await _db.SaveChangesAsync();

        return (new RegistrationResponse
        {
            Id = reg.Id,
            EventId = reg.EventId,
            PlayerId = reg.PlayerId,
            PlayerUsername = player.Username,
            PlayerDisplayName = player.Nickname ?? player.Username,
            IsEliminated = reg.IsEliminated,
            EventLosses = reg.EventLosses,
            RegisteredAt = reg.RegisteredAt
        }, null);
    }

    public async Task<List<RegistrationResponse>> GetByEventAsync(int eventId)
    {
        return await _db.EventRegistrations
            .Where(r => r.EventId == eventId)
            .Include(r => r.Player)
            .Select(r => new RegistrationResponse
            {
                Id = r.Id,
                EventId = r.EventId,
                PlayerId = r.PlayerId,
                PlayerUsername = r.Player.Username,
                PlayerDisplayName = r.Player.Nickname ?? r.Player.Username,
                IsEliminated = r.IsEliminated,
                EventLosses = r.EventLosses,
                IsDropped = r.IsDropped,
                DroppedAtRound = r.DroppedAtRound,
                RegisteredAt = r.RegisteredAt
            })
            .ToListAsync();
    }

    public async Task<(RegistrationResponse? result, string? error)> DropPlayerAsync(int registrationId, int currentRound)
    {
        var reg = await _db.EventRegistrations.Include(r => r.Player).FirstOrDefaultAsync(r => r.Id == registrationId);
        if (reg == null) return (null, "Registration not found.");
        if (reg.IsEliminated) return (null, "Player is already eliminated.");
        if (reg.IsDropped) return (null, "Player is already dropped.");

        reg.IsDropped = true;
        reg.DroppedAtRound = currentRound;
        await _db.SaveChangesAsync();
        return (ToResponse(reg), null);
    }

    public async Task<(RegistrationResponse? result, string? error)> UndropPlayerAsync(int registrationId, int currentRound)
    {
        var reg = await _db.EventRegistrations.Include(r => r.Player).FirstOrDefaultAsync(r => r.Id == registrationId);
        if (reg == null) return (null, "Registration not found.");
        if (!reg.IsDropped) return (null, "Player is not dropped.");
        if (reg.DroppedAtRound < currentRound) return (null, "Drop is permanent — the next round has already started.");

        reg.IsDropped = false;
        reg.DroppedAtRound = 0;
        await _db.SaveChangesAsync();
        return (ToResponse(reg), null);
    }

    public async Task<bool> CancelAsync(int registrationId, int requestingUserId, string requestingUserRole)
    {
        var reg = await _db.EventRegistrations.FindAsync(registrationId);
        if (reg == null) return false;

        // Players can only cancel their own registrations; admins can cancel any
        if (requestingUserRole != "admin" && reg.PlayerId != requestingUserId) return false;

        _db.EventRegistrations.Remove(reg);
        await _db.SaveChangesAsync();
        return true;
    }

    private static RegistrationResponse ToResponse(EventRegistration reg) => new()
    {
        Id = reg.Id,
        EventId = reg.EventId,
        PlayerId = reg.PlayerId,
        PlayerUsername = reg.Player.Username,
        PlayerDisplayName = reg.Player.Nickname ?? reg.Player.Username,
        IsEliminated = reg.IsEliminated,
        EventLosses = reg.EventLosses,
        IsDropped = reg.IsDropped,
        DroppedAtRound = reg.DroppedAtRound,
        RegisteredAt = reg.RegisteredAt
    };
}
