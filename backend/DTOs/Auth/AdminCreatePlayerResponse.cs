namespace MtgTracker.Api.DTOs.Auth;

public class AdminCreatePlayerResponse
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ResetToken { get; set; } = string.Empty;
    public bool EmailConfigured { get; set; }
}
