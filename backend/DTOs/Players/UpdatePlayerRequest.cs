namespace MtgTracker.Api.DTOs.Players;

public class UpdatePlayerRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Nickname { get; set; }
    public string Role { get; set; } = "player";
}
