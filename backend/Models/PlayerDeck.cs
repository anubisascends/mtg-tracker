namespace MtgTracker.Api.Models;

public class PlayerDeck
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Format { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User Player { get; set; } = null!;
    public ICollection<PlayerDeckCard> Cards { get; set; } = new List<PlayerDeckCard>();
}

public class PlayerDeckCard
{
    public int Id { get; set; }
    public int PlayerDeckId { get; set; }
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public DeckSection Section { get; set; } = DeckSection.MainDeck;
    public bool IsProxy { get; set; } = false;

    public PlayerDeck Deck { get; set; } = null!;
}
