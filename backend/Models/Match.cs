namespace MtgTracker.Api.Models;

public class Match
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int Player1Id { get; set; }
    public int Player2Id { get; set; }
    public int Player1Wins { get; set; } = 0;
    public int Player2Wins { get; set; } = 0;
    public int Draws { get; set; } = 0;
    public bool IsBye { get; set; } = false;
    public bool IsPending { get; set; } = false;
    public int Round { get; set; } = 1;
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    public Event Event { get; set; } = null!;
    public User Player1 { get; set; } = null!;
    public User Player2 { get; set; } = null!;
}
