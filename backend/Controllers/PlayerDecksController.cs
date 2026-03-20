using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.DTOs.PlayerDecks;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/my-decks")]
[Authorize]
public class PlayerDecksController : ControllerBase
{
    private readonly IPlayerDeckService _decks;

    public PlayerDecksController(IPlayerDeckService decks) => _decks = decks;

    private int UserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/my-decks
    [HttpGet]
    public async Task<IActionResult> GetMyDecks() =>
        Ok(await _decks.GetMyDecksAsync(UserId));

    // GET /api/my-decks/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetMyDeck(int id)
    {
        var deck = await _decks.GetMyDeckAsync(UserId, id);
        return deck == null ? NotFound() : Ok(deck);
    }

    // POST /api/my-decks
    [HttpPost]
    public async Task<IActionResult> CreateDeck([FromBody] SavePlayerDeckRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Deck name is required." });
        var deck = await _decks.CreateAsync(UserId, request);
        return CreatedAtAction(nameof(GetMyDeck), new { id = deck.Id }, deck);
    }

    // PUT /api/my-decks/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDeck(int id, [FromBody] SavePlayerDeckRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Deck name is required." });
        var deck = await _decks.UpdateAsync(UserId, id, request);
        return deck == null ? NotFound() : Ok(deck);
    }

    // DELETE /api/my-decks/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDeck(int id)
    {
        var deleted = await _decks.DeleteAsync(UserId, id);
        return deleted ? NoContent() : NotFound();
    }
}
