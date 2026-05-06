using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.DTOs.Auth;
using MtgTracker.Api.Services;
using MtgTracker.Api.DTOs.Players;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlayersController : ControllerBase
{
    private readonly IPlayerService _players;
    private readonly IAuthService _auth;
    private readonly IEmailService _email;

    public PlayersController(IPlayerService players, IAuthService auth, IEmailService email)
    {
        _players = players;
        _auth = auth;
        _email = email;
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminCreatePlayer(AdminCreatePlayerRequest request)
    {
        var result = await _auth.AdminCreatePlayerAsync(request, _email);
        if (result == null)
            return Conflict(new { message = "Email or username already in use." });
        return Ok(result);
    }

    [HttpPost("{id}/invite")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GenerateInvite(int id)
    {
        var result = await _auth.GenerateInviteTokenAsync(id, _email);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("{id}/send-invite-email")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SendInviteEmail(int id)
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var sent = await _auth.SendInviteEmailAsync(id, _email, baseUrl);
        if (!sent) return BadRequest(new { message = "Email not configured or no valid invite token found." });
        return NoContent();
    }

    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetAll([FromQuery] bool archived = false) =>
        Ok(await _players.GetAllAsync(archived));

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "player";

        // Players can only view their own profile
        if (role != "admin" && userId != id)
            return Forbid();

        var player = await _players.GetByIdAsync(id);
        return player == null ? NotFound() : Ok(player);
    }

    [HttpGet("{id}/registrations")]
    public async Task<IActionResult> GetRegistrations(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "player";

        if (role != "admin" && userId != id)
            return Forbid();

        return Ok(await _players.GetRegistrationsForPlayerAsync(id));
    }

    [HttpPost("{id}/unarchive")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UnarchivePlayer(int id)
    {
        var ok = await _players.UnarchiveAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdatePlayer(int id, UpdatePlayerRequest request)
    {
        var requestingUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

        // Prevent admin from demoting themselves
        if (id == requestingUserId && request.Role != "admin")
            return BadRequest(new { message = "Cannot demote your own account." });

        var (player, error) = await _players.UpdateAsync(id, request);
        if (player == null && error == null) return NotFound();
        if (error != null) return Conflict(new { message = error });
        return Ok(player);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeletePlayer(int id)
    {
        var requestingUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var error = await _players.DeleteAsync(id, requestingUserId);
        if (error == "not_found") return NotFound();
        if (error != null) return BadRequest(new { message = error });
        return NoContent();
    }

    [HttpPut("{id}/reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminResetPassword(int id, AdminResetPasswordRequest request)
    {
        var ok = await _auth.AdminResetPasswordAsync(id, request.NewPassword);
        if (!ok) return NotFound();
        return NoContent();
    }
}
