using System.Net;
using System.Net.Mail;
using MtgTracker.Api.Data;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Services;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string username, string resetLink);
    bool IsConfigured { get; }
}

public class SmtpEmailService : IEmailService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public SmtpEmailService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    private EmailSettings? _resolved;

    private EmailSettings Resolved => _resolved ??= ResolveSettings();

    private EmailSettings ResolveSettings()
    {
        var db = _db.EmailSettings.Find(1);

        var host = NonEmpty(db?.Host) ?? NonEmpty(_config["Smtp:Host"]);
        var from = NonEmpty(db?.FromAddress) ?? NonEmpty(_config["Smtp:From"]);
        var port = db?.Port is > 0 ? db.Port
            : int.TryParse(_config["Smtp:Port"], out var p) && p > 0 ? p : 587;
        var user = NonEmpty(db?.Username) ?? NonEmpty(_config["Smtp:Username"]);
        var pass = NonEmpty(db?.Password) ?? NonEmpty(_config["Smtp:Password"]);
        var ssl = db != null ? db.EnableSsl : _config["Smtp:EnableSsl"] != "false";

        return new EmailSettings
        {
            Host = host, Port = port, FromAddress = from,
            Username = user, Password = pass, EnableSsl = ssl
        };
    }

    private static string? NonEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Resolved.Host) &&
        !string.IsNullOrWhiteSpace(Resolved.FromAddress);

    public async Task SendPasswordResetEmailAsync(string toEmail, string username, string resetLink)
    {
        var s = Resolved;
        using var client = new SmtpClient(s.Host, s.Port) { EnableSsl = s.EnableSsl };
        if (!string.IsNullOrEmpty(s.Username) && !string.IsNullOrEmpty(s.Password))
            client.Credentials = new NetworkCredential(s.Username, s.Password);

        var body = $"""
            Hi {username},

            An account has been created for you on MTG Event Tracker.

            Click the link below to set your password and log in:
            {resetLink}

            This link expires in 7 days.

            If you didn't expect this email, you can ignore it.
            """;

        await client.SendMailAsync(new MailMessage(s.FromAddress!, toEmail,
            "Your MTG Tracker account is ready", body));
    }
}
