using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RegistrationsController : ControllerBase
{
    private readonly IRegistrationService _registrations;

    public RegistrationsController(IRegistrationService registrations) => _registrations = registrations;

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterForEventRequest request)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var result = await _registrations.RegisterAsync(request.EventId, userId);

        if (result == null)
            return BadRequest(new { message = "Unable to register. Event may be full, completed, or you are already registered." });

        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Cancel(int id)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var role = User.FindFirstValue(ClaimTypes.Role) ?? "player";
        var success = await _registrations.CancelAsync(id, userId, role);
        return success ? NoContent() : NotFound();
    }
}

public class RegisterForEventRequest
{
    public int EventId { get; set; }
}
