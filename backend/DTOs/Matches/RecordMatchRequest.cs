using System.ComponentModel.DataAnnotations;

namespace MtgTracker.Api.DTOs.Matches;

public class RecordMatchRequest
{
    [Required] public int EventId { get; set; }
    [Required] public int Player1Id { get; set; }
    [Required] public int Player2Id { get; set; }
    public int Player1Wins { get; set; }
    public int Player2Wins { get; set; }
    public int Draws { get; set; }
}
