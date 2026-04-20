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
    public async Task<IActionResult> GetAll() => Ok(await _players.GetAllAsync());

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

    [HttpPut("{id}/reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminResetPassword(int id, AdminResetPasswordRequest request)
    {
        var ok = await _auth.AdminResetPasswordAsync(id, request.NewPassword);
        if (!ok) return NotFound();
        return NoContent();
    }
}
