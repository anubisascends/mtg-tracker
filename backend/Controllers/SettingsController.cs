using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MtgTracker.Api.Data;
using MtgTracker.Api.DTOs.Settings;
using MtgTracker.Api.Models;
using MtgTracker.Api.Services;

namespace MtgTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmailService _email;

    public SettingsController(AppDbContext db, IEmailService email)
    {
        _db = db;
        _email = email;
    }

    [HttpGet("email")]
    public IActionResult GetEmailSettings()
    {
        var s = _db.EmailSettings.Find(1);
        return Ok(new EmailSettingsDto
        {
            Host = s?.Host ?? string.Empty,
            Port = s?.Port ?? 587,
            FromAddress = s?.FromAddress ?? string.Empty,
            Username = s?.Username ?? string.Empty,
            Password = string.IsNullOrEmpty(s?.Password) ? string.Empty : "••••••••",
            EnableSsl = s?.EnableSsl ?? true,
            IsConfigured = _email.IsConfigured
        });
    }

    [HttpPut("email")]
    public async Task<IActionResult> UpdateEmailSettings(EmailSettingsDto dto)
    {
        var existing = await _db.EmailSettings.FindAsync(1);
        if (existing == null)
        {
            existing = new EmailSettings { Id = 1 };
            _db.EmailSettings.Add(existing);
        }

        existing.Host = dto.Host?.Trim();
        existing.Port = dto.Port > 0 ? dto.Port : 587;
        existing.FromAddress = dto.FromAddress?.Trim();
        existing.Username = dto.Username?.Trim();
        existing.EnableSsl = dto.EnableSsl;

        // Only update password if it's not the masked placeholder
        if (!string.IsNullOrEmpty(dto.Password) && dto.Password != "••••••••")
            existing.Password = dto.Password;

        await _db.SaveChangesAsync();
        return Ok(new EmailSettingsDto
        {
            Host = existing.Host ?? string.Empty,
            Port = existing.Port,
            FromAddress = existing.FromAddress ?? string.Empty,
            Username = existing.Username ?? string.Empty,
            Password = string.IsNullOrEmpty(existing.Password) ? string.Empty : "••••••••",
            EnableSsl = existing.EnableSsl,
            IsConfigured = _email.IsConfigured
        });
    }

    [HttpPost("email/test")]
    public async Task<IActionResult> TestEmail()
    {
        if (!_email.IsConfigured)
            return BadRequest(new { message = "Email is not configured." });

        var adminEmail = User.FindFirstValue(ClaimTypes.Email);
        var adminName = User.FindFirstValue("username") ?? "Admin";
        if (string.IsNullOrEmpty(adminEmail))
            return BadRequest(new { message = "Could not determine admin email." });

        try
        {
            await _email.SendPasswordResetEmailAsync(adminEmail, adminName, "https://example.com/test");
            return Ok(new { message = $"Test email sent to {adminEmail}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Failed to send: {ex.Message}" });
        }
    }
}
