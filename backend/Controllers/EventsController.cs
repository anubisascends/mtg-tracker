using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.DTOs.Events;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly IEventService _events;
    private readonly IRegistrationService _registrations;
    private readonly IMatchService _matches;

    public EventsController(IEventService events, IRegistrationService registrations, IMatchService matches)
    {
        _events = events;
        _registrations = registrations;
        _matches = matches;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var isAdmin = User.IsInRole("admin");
        return Ok(await _events.GetAllAsync(isAdmin));
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var isAdmin = User.IsInRole("admin");
        var ev = await _events.GetByIdAsync(id, isAdmin);
        return ev == null ? NotFound() : Ok(ev);
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create(CreateEventRequest request)
    {
        var ev = await _events.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = ev.Id }, ev);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, UpdateEventRequest request)
    {
        var ev = await _events.UpdateAsync(id, request);
        return ev == null ? NotFound() : Ok(ev);
    }

    [HttpPost("{id}/advance")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Advance(int id)
    {
        var ev = await _events.AdvanceStatusAsync(id);
        return ev == null ? NotFound() : Ok(ev);
    }

    [HttpPost("{id}/advance-run-phase")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdvanceRunPhase(int id)
    {
        var ev = await _events.AdvanceRunPhaseAsync(id);
        return ev == null ? NotFound() : Ok(ev);
    }

    [HttpPost("{id}/reverse-run-phase")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ReverseRunPhase(int id)
    {
        var (response, error) = await _events.ReverseRunPhaseAsync(id);
        if (error != null) return BadRequest(new { message = error });
        return response == null ? NotFound() : Ok(response);
    }

    [HttpPost("{id}/reverse-status")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ReverseStatus(int id)
    {
        var (response, error) = await _events.ReverseStatusAsync(id);
        if (error != null) return BadRequest(new { message = error });
        return response == null ? NotFound() : Ok(response);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _events.DeleteAsync(id);
        return success ? NoContent() : NotFound();
    }

    [HttpGet("{id}/registrations")]
    [AllowAnonymous]
    public async Task<IActionResult> GetRegistrations(int id) =>
        Ok(await _registrations.GetByEventAsync(id));

    [HttpGet("{id}/matches")]
    [AllowAnonymous]
    public async Task<IActionResult> GetMatches(int id) =>
        Ok(await _matches.GetByEventAsync(id));

    [HttpGet("{id}/scores")]
    [AllowAnonymous]
    public async Task<IActionResult> GetScores(int id) =>
        Ok(await _events.GetEventScoresAsync(id));

    [HttpPost("{id}/next-round")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> NextRound(int id)
    {
        var (response, error) = await _events.GenerateNextRoundAsync(id);
        if (error != null) return BadRequest(new { message = error });
        return response == null ? NotFound() : Ok(response);
    }

    [HttpPost("{id}/registrations/{regId}/drop")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DropPlayer(int id, int regId)
    {
        var ev = await _events.GetByIdAsync(id, isAdmin: true);
        if (ev == null) return NotFound();
        var (result, error) = await _registrations.DropPlayerAsync(regId, ev.CurrentRound);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/registrations/{regId}/undrop")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UndropPlayer(int id, int regId)
    {
        var ev = await _events.GetByIdAsync(id, isAdmin: true);
        if (ev == null) return NotFound();
        var (result, error) = await _registrations.UndropPlayerAsync(regId, ev.CurrentRound);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/register-player")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RegisterPlayer(int id, [FromBody] AdminRegisterPlayerRequest request)
    {
        var (result, error) = await _registrations.AdminRegisterAsync(id, request.PlayerId);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/self-drop")]
    [Authorize]
    public async Task<IActionResult> SelfDrop(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ev = await _events.GetByIdAsync(id, isAdmin: false);
        if (ev == null) return NotFound();

        var regs = await _registrations.GetByEventAsync(id);
        var myReg = regs.FirstOrDefault(r => r.PlayerId == userId);
        if (myReg == null) return BadRequest(new { message = "You are not registered for this event." });

        var (result, error) = await _registrations.DropPlayerAsync(myReg.Id, ev.CurrentRound);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/self-undrop")]
    [Authorize]
    public async Task<IActionResult> SelfUndrop(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ev = await _events.GetByIdAsync(id, isAdmin: false);
        if (ev == null) return NotFound();

        var regs = await _registrations.GetByEventAsync(id);
        var myReg = regs.FirstOrDefault(r => r.PlayerId == userId);
        if (myReg == null) return BadRequest(new { message = "You are not registered for this event." });

        var (result, error) = await _registrations.UndropPlayerAsync(myReg.Id, ev.CurrentRound);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/pairings")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreatePairing(int id, [FromBody] CreatePairingRequest request)
    {
        var ev = await _events.GetByIdAsync(id, isAdmin: true);
        if (ev == null) return NotFound();
        if (ev.Status != "InProgress" || ev.RunPhase != "Playing")
            return BadRequest(new { message = "Event is not in the Playing phase." });

        var (result, error) = await _matches.CreatePendingMatchAsync(id, ev.CurrentRound, request.Player1Id, request.Player2Id);
        if (error != null) return BadRequest(new { message = error });
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/timer/start")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> StartTimer(int id, [FromBody] TimerStartRequest request)
    {
        if (request.DurationSeconds <= 0) return BadRequest(new { message = "Duration must be positive." });
        var ev = await _events.StartTimerAsync(id, request.DurationSeconds);
        return ev == null ? NotFound() : Ok(ev);
    }

    [HttpPost("{id}/timer/stop")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> StopTimer(int id)
    {
        var ev = await _events.StopTimerAsync(id);
        return ev == null ? NotFound() : Ok(ev);
    }
}

public class AdminRegisterPlayerRequest
{
    public int PlayerId { get; set; }
}

public class CreatePairingRequest
{
    public int Player1Id { get; set; }
    public int? Player2Id { get; set; }
}
