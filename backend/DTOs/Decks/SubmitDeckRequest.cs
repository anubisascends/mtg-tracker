using MtgTracker.Api.Models;

namespace MtgTracker.Api.DTOs.Decks;

public class SubmitDeckRequest
{
    public List<DeckCardRequest> Cards { get; set; } = new();
}

public class DeckCardRequest
{
    public string CardName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public DeckSection Section { get; set; } = DeckSection.MainDeck;
    public bool IsProxy { get; set; } = false;
}
