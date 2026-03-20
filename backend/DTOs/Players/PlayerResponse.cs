namespace MtgTracker.Api.DTOs.Players;

public class PlayerResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Nickname { get; set; }
    public string DisplayName => string.IsNullOrEmpty(Nickname) ? Username : $"{Username} ({Nickname})";
    public string Email { get; set; } = string.Empty;
    public int LifetimeWins { get; set; }
    public int LifetimeLosses { get; set; }
    public int LifetimeDraws { get; set; }
    public int TotalMatches => LifetimeWins + LifetimeLosses + LifetimeDraws;
    public DateTime CreatedAt { get; set; }
}
