using System.ComponentModel.DataAnnotations;

namespace MtgTracker.Api.DTOs.Auth;

public class AdminCreatePlayerRequest
{
    [Required, MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string? Nickname { get; set; }
}
