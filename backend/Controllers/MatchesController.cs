using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.DTOs.Matches;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MatchesController : ControllerBase
{
    private readonly IMatchService _matches;

    public MatchesController(IMatchService matches) => _matches = matches;

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Record(RecordMatchRequest request)
    {
        var result = await _matches.RecordMatchAsync(request);
        if (result == null)
            return BadRequest(new { message = "Invalid match data. Check event and player IDs." });

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var match = await _matches.GetByIdAsync(id);
        return match == null ? NotFound() : Ok(match);
    }

    [HttpPut("{id}/result")]
    public async Task<IActionResult> RecordResult(int id, [FromBody] RecordMatchResultRequest request)
    {
        // Admins can record any result; players can only record their own matches
        var isAdmin = User.IsInRole("admin");
        int? requestingUserId = isAdmin ? null : int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var match = await _matches.RecordResultAsync(id, request, requestingUserId);
        return match == null ? NotFound() : Ok(match);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _matches.DeleteAsync(id);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("{id}/reopen")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reopen(int id)
    {
        var result = await _matches.ReopenAsync(id);
        return result == null ? NotFound() : Ok(result);
    }
}
