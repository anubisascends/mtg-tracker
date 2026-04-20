using System.ComponentModel.DataAnnotations;

namespace MtgTracker.Api.DTOs.Auth;

public class ResetPasswordRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}
