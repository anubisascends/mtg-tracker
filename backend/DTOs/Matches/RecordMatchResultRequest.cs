namespace MtgTracker.Api.DTOs.Matches;

public class RecordMatchResultRequest
{
    public int Player1Wins { get; set; }
    public int Player2Wins { get; set; }
    public int Draws { get; set; }
}
