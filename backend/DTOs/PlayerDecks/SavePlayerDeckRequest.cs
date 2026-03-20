using MtgTracker.Api.Models;

namespace MtgTracker.Api.DTOs.PlayerDecks;

public class SavePlayerDeckRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Format { get; set; }
    public List<PlayerDeckCardRequest> Cards { get; set; } = new();
}

public class PlayerDeckCardRequest
{
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public DeckSection Section { get; set; }
    public bool IsProxy { get; set; }
}
