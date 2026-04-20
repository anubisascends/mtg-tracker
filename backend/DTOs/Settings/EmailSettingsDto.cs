namespace MtgTracker.Api.DTOs.Settings;

public class EmailSettingsDto
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? FromAddress { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
    public bool IsConfigured { get; set; }
}
