namespace MtgTracker.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "player"; // "player" or "admin"
    public string? Nickname { get; set; }
    public int LifetimeWins { get; set; }
    public int LifetimeLosses { get; set; }
    public int LifetimeDraws { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<EventRegistration> EventRegistrations { get; set; } = new List<EventRegistration>();
}
