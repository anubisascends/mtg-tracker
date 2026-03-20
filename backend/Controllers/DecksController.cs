using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.DTOs.Decks;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/events/{eventId}/deck")]
[Authorize]
public class DecksController : ControllerBase
{
    private readonly IDeckService _decks;

    public DecksController(IDeckService decks) => _decks = decks;

    // GET /api/events/{eventId}/deck  — player fetches their own deck
    [HttpGet]
    public async Task<IActionResult> GetMyDeck(int eventId)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var deck = await _decks.GetMyDeckAsync(eventId, userId);
        return deck == null ? NotFound() : Ok(deck);
    }

    // POST /api/events/{eventId}/deck  — player submits / updates deck
    [HttpPost]
    public async Task<IActionResult> SubmitDeck(int eventId, [FromBody] SubmitDeckRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var (result, error) = await _decks.SubmitDeckAsync(eventId, userId, request);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    // GET /api/events/{eventId}/deck/view/{playerId}  — public: anyone can view a submitted deck
    [HttpGet("view/{playerId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDeckForView(int eventId, int playerId)
    {
        var deck = await _decks.GetDeckForViewAsync(eventId, playerId);
        return deck == null ? NotFound() : Ok(deck);
    }

    // GET /api/events/{eventId}/deck/all  — admin sees all submitted decks
    [HttpGet("all")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetAllDecks(int eventId)
    {
        return Ok(await _decks.GetAllDecksAsync(eventId));
    }
}
