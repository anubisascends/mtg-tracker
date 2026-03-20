namespace MtgTracker.Api.DTOs.PlayerDecks;

public class PlayerDeckResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Format { get; set; }
    public int TotalCards { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<PlayerDeckCardResponse> Cards { get; set; } = new();
}

public class PlayerDeckCardResponse
{
    public int Id { get; set; }
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Section { get; set; } = string.Empty;
    public bool IsProxy { get; set; }
}
