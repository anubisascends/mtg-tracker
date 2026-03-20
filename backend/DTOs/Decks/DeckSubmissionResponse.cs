namespace MtgTracker.Api.DTOs.Decks;

public class DeckSubmissionResponse
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerDisplayName { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<DeckCardResponse> Cards { get; set; } = new();
}

public class DeckCardResponse
{
    public int Id { get; set; }
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Section { get; set; } = string.Empty;
    public bool IsProxy { get; set; }
}
