using MtgTracker.Api.Models;

namespace MtgTracker.Api.DTOs.Events;

public class EventResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RunPhase { get; set; }
    public string EliminationType { get; set; } = string.Empty;
    public int CurrentRound { get; set; }
    public int MaxPlayers { get; set; }
    public int TimerDurationSeconds { get; set; }
    public DateTime? TimerStartedAt { get; set; }
    public int RegisteredCount { get; set; }
    public bool RequiresDeckRegistration { get; set; }
    public bool ProxiesAllowed { get; set; }
    public DateTime CreatedAt { get; set; }
}
