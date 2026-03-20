namespace MtgTracker.Api.DTOs.Matches;

public class MatchResponse
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string EventName { get; set; } = string.Empty;
    public int Player1Id { get; set; }
    public string Player1Username { get; set; } = string.Empty;
    public string Player1DisplayName { get; set; } = string.Empty;
    public int Player2Id { get; set; }
    public string Player2Username { get; set; } = string.Empty;
    public string Player2DisplayName { get; set; } = string.Empty;
    public int Player1Wins { get; set; }
    public int Player2Wins { get; set; }
    public int Draws { get; set; }
    public int Player1Points { get; set; }
    public int Player2Points { get; set; }
    public bool IsBye { get; set; }
    public bool IsPending { get; set; }
    public int Round { get; set; }
    public DateTime RecordedAt { get; set; }
}
