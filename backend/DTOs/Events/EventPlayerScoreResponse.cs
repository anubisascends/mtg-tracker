namespace MtgTracker.Api.DTOs.Events;

public class EventPlayerScoreResponse
{
    public int PlayerId { get; set; }
    public string PlayerDisplayName { get; set; } = string.Empty;
    public int Points { get; set; }
    public int MatchWins { get; set; }
    public int MatchLosses { get; set; }
    public int MatchDraws { get; set; }
    public int Byes { get; set; }
    public bool IsEliminated { get; set; }
    public int EventLosses { get; set; }
    public bool IsDropped { get; set; }
    public int DroppedAtRound { get; set; }
    public int RegistrationId { get; set; }
}
