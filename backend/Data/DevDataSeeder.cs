using MtgTracker.Api.Models;

namespace MtgTracker.Api.Data;

public static class DevDataSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Users.Any(u => u.Role == "player") || db.Events.Any())
        {
            Console.WriteLine("[DevDataSeeder] Skipping — players or events already exist.");
            return;
        }

        var csvPath = Path.Combine(AppContext.BaseDirectory, "SeedData", "sample_players.csv");
        Console.WriteLine($"[DevDataSeeder] Looking for CSV at: {csvPath}");

        if (!File.Exists(csvPath))
        {
            Console.WriteLine("[DevDataSeeder] CSV not found — skipping seed.");
            return;
        }

        var lines = File.ReadAllLines(csvPath).Skip(1); // skip header
        var players = new List<User>();

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var parts = line.Split(',');
            if (parts.Length < 3) continue;

            var username = parts[0].Trim();
            var email = parts[1].Trim();
            var nickname = parts[2].Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email))
                continue;

            players.Add(new User
            {
                Username = username,
                Email = email,
                Nickname = string.IsNullOrEmpty(nickname) ? null : nickname,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "player",
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (players.Count == 0)
        {
            Console.WriteLine("[DevDataSeeder] No players found in CSV — skipping seed.");
            return;
        }

        db.Users.AddRange(players);
        db.SaveChanges();
        Console.WriteLine($"[DevDataSeeder] Created {players.Count} sample players.");

        // Create the event in InProgress / Playing so pairings can be shown immediately
        var ev = new Event
        {
            Name = "Sample Draft Tournament",
            Description = "A sample draft event to get you started.",
            Format = "Draft",
            Date = DateTime.UtcNow.AddDays(7),
            MaxPlayers = players.Count,
            Status = EventStatus.InProgress,
            RunPhase = RunPhase.Playing,
            EliminationType = EliminationType.Swiss,
            CurrentRound = 1,
            CreatedAt = DateTime.UtcNow,
        };
        db.Events.Add(ev);
        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Created sample event.");

        var ev2 = new Event
        {
            Name = "Planning Event",
            Description = "A planning event",
            Format = "Draft",
            Date = DateTime.UtcNow.AddDays(90),
            MaxPlayers = players.Count,
            Status = EventStatus.Planning,
            RunPhase = RunPhase.Initializing,
            EliminationType = EliminationType.Swiss,
            CreatedAt = DateTime.Now
        };
        db.Events.Add(ev2);
        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Create another sample event");

        // Register all players
        var now = DateTime.UtcNow;
        foreach (var player in players)
        {
            db.EventRegistrations.Add(new EventRegistration
            {
                EventId = ev.Id,
                PlayerId = player.Id,
                RegisteredAt = now,
            });
        }
        db.SaveChanges();
        Console.WriteLine($"[DevDataSeeder] Registered {players.Count} players to the event.");

        // Generate round 1 pairings (random shuffle, pair sequentially)
        var shuffled = players.OrderBy(_ => Guid.NewGuid()).ToList();
        for (var i = 0; i + 1 < shuffled.Count; i += 2)
        {
            db.Matches.Add(new Match
            {
                EventId = ev.Id,
                Player1Id = shuffled[i].Id,
                Player2Id = shuffled[i + 1].Id,
                Round = 1,
                IsPending = true,
                RecordedAt = now,
            });
        }
        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Generated round 1 pairings.");
    }
}
