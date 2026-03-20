namespace MtgTracker.Api.DTOs.Registrations;

public class RegistrationResponse
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerUsername { get; set; } = string.Empty;
    public string PlayerDisplayName { get; set; } = string.Empty;
    public bool IsEliminated { get; set; }
    public int EventLosses { get; set; }
    public bool IsDropped { get; set; }
    public int DroppedAtRound { get; set; }
    public DateTime RegisteredAt { get; set; }
}
