namespace MtgTracker.Api.Models;

public class EmailSettings
{
    public int Id { get; set; } = 1;
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? FromAddress { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
}
