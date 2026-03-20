namespace MtgTracker.Api.Models;

public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int PlayerId { get; set; }
    public bool IsEliminated { get; set; } = false;
    public int EventLosses { get; set; } = 0;
    public bool IsDropped { get; set; } = false;
    public int DroppedAtRound { get; set; } = 0;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public Event Event { get; set; } = null!;
    public User Player { get; set; } = null!;
}
