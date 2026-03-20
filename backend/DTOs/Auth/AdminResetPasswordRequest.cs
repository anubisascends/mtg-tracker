namespace MtgTracker.Api.DTOs.Auth;

public class AdminResetPasswordRequest
{
    public string NewPassword { get; set; } = string.Empty;
}
