namespace MtgTracker.Api.Models;

public class DeckSubmission
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int PlayerId { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Event Event { get; set; } = null!;
    public User Player { get; set; } = null!;
    public ICollection<DeckCard> Cards { get; set; } = new List<DeckCard>();
}

public class DeckCard
{
    public int Id { get; set; }
    public int DeckSubmissionId { get; set; }
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public DeckSection Section { get; set; } = DeckSection.MainDeck;
    public bool IsProxy { get; set; } = false;

    public DeckSubmission DeckSubmission { get; set; } = null!;
}

public enum DeckSection
{
    MainDeck  = 0,
    Sideboard = 1,
    Commander = 2
}
