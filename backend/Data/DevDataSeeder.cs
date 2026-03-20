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
            var email    = parts[1].Trim();
            var nickname = parts[2].Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(email))
                continue;

            players.Add(new User
            {
                Username     = username,
                Email        = email,
                Nickname     = string.IsNullOrEmpty(nickname) ? null : nickname,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role         = "player",
                CreatedAt    = DateTime.UtcNow,
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

        var now = DateTime.UtcNow;

        // ── Event 1: Draft tournament (in-progress, no deck reg) ─────────────────
        var draftEvent = new Event
        {
            Name              = "Sample Draft Tournament",
            Description       = "A sample draft event to get you started.",
            Format            = "Draft",
            Date              = DateTime.UtcNow.AddDays(7),
            MaxPlayers        = players.Count,
            Status            = EventStatus.InProgress,
            RunPhase          = RunPhase.Playing,
            EliminationType   = EliminationType.Swiss,
            CurrentRound      = 1,
            CreatedAt         = now,
        };
        db.Events.Add(draftEvent);
        db.SaveChanges();

        // ── Event 2: Planning event ───────────────────────────────────────────────
        var planEvent = new Event
        {
            Name            = "Planning Event",
            Description     = "A planning event",
            Format          = "Draft",
            Date            = DateTime.UtcNow.AddDays(90),
            MaxPlayers      = players.Count,
            Status          = EventStatus.Planning,
            RunPhase        = RunPhase.Initializing,
            EliminationType = EliminationType.Swiss,
            CreatedAt       = now,
        };
        db.Events.Add(planEvent);
        db.SaveChanges();

        // ── Event 3: Commander Night (deck registration required) ─────────────────
        var cmdEvent = new Event
        {
            Name                      = "Commander Night",
            Description               = "Weekly commander night. Deck registration required — proxies are welcome.",
            Format                    = "Commander",
            Date                      = DateTime.UtcNow.AddDays(14),
            MaxPlayers                = players.Count,
            Status                    = EventStatus.InProgress,
            RunPhase                  = RunPhase.Playing,
            EliminationType           = EliminationType.Swiss,
            CurrentRound              = 1,
            RequiresDeckRegistration  = true,
            ProxiesAllowed            = true,
            CreatedAt                 = now,
        };
        db.Events.Add(cmdEvent);
        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Created sample events.");

        // ── Register all players to draft event and commander night ──────────────
        foreach (var player in players)
        {
            db.EventRegistrations.Add(new EventRegistration
            {
                EventId      = draftEvent.Id,
                PlayerId     = player.Id,
                RegisteredAt = now,
            });
            db.EventRegistrations.Add(new EventRegistration
            {
                EventId      = cmdEvent.Id,
                PlayerId     = player.Id,
                RegisteredAt = now,
            });
        }
        db.SaveChanges();
        Console.WriteLine($"[DevDataSeeder] Registered {players.Count} players to events.");

        // ── Draft round 1 pairings ────────────────────────────────────────────────
        var shuffled = players.OrderBy(_ => Guid.NewGuid()).ToList();
        for (var i = 0; i + 1 < shuffled.Count; i += 2)
        {
            db.Matches.Add(new Match
            {
                EventId    = draftEvent.Id,
                Player1Id  = shuffled[i].Id,
                Player2Id  = shuffled[i + 1].Id,
                Round      = 1,
                IsPending  = true,
                RecordedAt = now,
            });
        }
        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Generated round 1 pairings.");

        // ── Deck submissions for Commander Night ──────────────────────────────────
        // Lookup helpers
        User P(string username) => players.First(p => p.Username == username);

        //
        // 0 · Kira Stormveil — Atraxa Superfriends · PROXIES: Jace the Mind Sculptor,
        //                                            Doubling Season, Mana Crypt
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Kira Stormveil").Id,
            Cards    = Cmd("Atraxa, Praetors' Voice").Concat(Cards(
                C("Jace, the Mind Sculptor",    proxy: true),
                C("Doubling Season",            proxy: true),
                C("Mana Crypt",                 proxy: true),
                C("Elspeth, Sun's Champion"),
                C("Liliana Vess"),
                C("Tamiyo, Field Researcher"),
                C("Nissa, Voice of Zendikar"),
                C("The Chain Veil"),
                C("Deepglow Skate"),
                C("Inexorable Tide"),
                C("Contagion Engine"),
                C("Vampire Nighthawk"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Kodama's Reach"),
                C("Cultivate"),
                C("Swords to Plowshares"),
                C("Cyclonic Rift"),
                C("Demonic Tutor"),
                C("Command Tower"),
                C("Breeding Pool"),
                C("Watery Grave"),
                C("Godless Shrine"),
                C("Temple Garden"),
                L("Island",   4),
                L("Swamp",    4),
                L("Forest",   3),
                L("Plains",   3)
            )).ToList(),
        });

        //
        // 1 · Draven Ashlock — Edgar Markov Vampires · NO PROXIES
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Draven Ashlock").Id,
            Cards    = Cmd("Edgar Markov").Concat(Cards(
                C("Sorin, Lord of Innistrad"),
                C("Bloodghast"),
                C("Stromkirk Captain"),
                C("Anointed Procession"),
                C("Captivating Vampire"),
                C("Dark Ritual"),
                C("Lightning Greaves"),
                C("Phyrexian Arena"),
                C("Boros Charm"),
                C("Legion Lieutenant"),
                C("Vampire Nocturnus"),
                C("Olivia Voldaren"),
                C("Sanctum Seeker"),
                C("Feast of Blood"),
                C("Stensia Masquerade"),
                C("Kalitas, Traitor of Ghet"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Boros Signet"),
                C("Orzhov Signet"),
                C("Swords to Plowshares"),
                C("Path to Exile"),
                C("Command Tower"),
                C("Blood Crypt"),
                C("Sacred Foundry"),
                C("Godless Shrine"),
                L("Mountain", 4),
                L("Swamp",    4),
                L("Plains",   3)
            )).ToList(),
        });

        //
        // 2 · Sable Nighthollow — Meren Reanimator · PROXIES: Craterhoof Behemoth,
        //                                            Survival of the Fittest, Gaea's Cradle
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Sable Nighthollow").Id,
            Cards    = Cmd("Meren of Clan Nel Toth").Concat(Cards(
                C("Craterhoof Behemoth",     proxy: true),
                C("Survival of the Fittest", proxy: true),
                C("Gaea's Cradle",           proxy: true),
                C("Grave Pact"),
                C("Dictate of Erebos"),
                C("Woodfall Primus"),
                C("Avenger of Zendikar"),
                C("Eternal Witness"),
                C("Jarad, Golgari Lich Lord"),
                C("Spore Frog"),
                C("Blood Artist"),
                C("Ashnod's Altar"),
                C("Viscera Seer"),
                C("Sakura-Tribe Elder"),
                C("Diabolic Intent"),
                C("Life from the Loam"),
                C("Birthing Pod"),
                C("Sheoldred, Whispering One"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Command Tower"),
                C("Overgrown Tomb"),
                C("Golgari Rot Farm"),
                L("Swamp",  5),
                L("Forest", 5)
            )).ToList(),
        });

        //
        // 3 · Cass Ironmore — Kaalia of the Vast · NO PROXIES
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Cass Ironmore").Id,
            Cards    = Cmd("Kaalia of the Vast").Concat(Cards(
                C("Avacyn, Angel of Hope"),
                C("Gisela, Blade of Goldnight"),
                C("Razaketh, the Foulblooded"),
                C("Rune-Scarred Demon"),
                C("Thundermaw Hellkite"),
                C("Aurelia, the Warleader"),
                C("Master of Cruelties"),
                C("Shalai, Voice of Plenty"),
                C("Dragon Tempest"),
                C("Reconnaissance"),
                C("Sneak Attack"),
                C("Lightning Greaves"),
                C("Swiftfoot Boots"),
                C("Boros Charm"),
                C("Anguished Unmaking"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Boros Signet"),
                C("Rakdos Signet"),
                C("Orzhov Signet"),
                C("Path to Exile"),
                C("Command Tower"),
                C("Blood Crypt"),
                C("Sacred Foundry"),
                C("Godless Shrine"),
                L("Mountain", 4),
                L("Plains",   4),
                L("Swamp",    3)
            )).ToList(),
        });

        //
        // 4 · Joryn Blackfen — Prossh Food Chain · PROXIES: Food Chain,
        //                                          Imperial Recruiter, Carpet of Flowers
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Joryn Blackfen").Id,
            Cards    = Cmd("Prossh, Skyraider of Kher").Concat(Cards(
                C("Food Chain",         proxy: true),
                C("Imperial Recruiter", proxy: true),
                C("Carpet of Flowers",  proxy: true),
                C("Eternal Scourge"),
                C("Living Wish"),
                C("Squee, Goblin Nabob"),
                C("Purphoros, God of the Forge"),
                C("Xenagos, God of Revels"),
                C("Goblin Bombardment"),
                C("Sylvan Library"),
                C("Beast Within"),
                C("Swiftfoot Boots"),
                C("Birthing Pod"),
                C("Blood Pet"),
                C("Diabolic Tutor"),
                C("Demonic Tutor"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Command Tower"),
                C("Stomping Ground"),
                C("Blood Crypt"),
                C("Overgrown Tomb"),
                L("Forest",   4),
                L("Mountain", 4),
                L("Swamp",    3)
            )).ToList(),
        });

        //
        // 5 · Tomas Brightwick — Breya Artifact Combo · NO PROXIES
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Tomas Brightwick").Id,
            Cards    = Cmd("Breya, Etherium Shaper").Concat(Cards(
                C("Thopter Foundry"),
                C("Sword of the Meek"),
                C("Sharuum the Hegemon"),
                C("Master Transmuter"),
                C("Krark-Clan Ironworks"),
                C("Myr Battlesphere"),
                C("Myr Retriever"),
                C("Goblin Welder"),
                C("Daretti, Scrap Savant"),
                C("Whir of Invention"),
                C("Shimmer Myr"),
                C("Darksteel Forge"),
                C("Sculpting Steel"),
                C("Trading Post"),
                C("Chromatic Lantern"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Cyclonic Rift"),
                C("Path to Exile"),
                C("Command Tower"),
                C("Spire of Industry"),
                C("Mana Confluence"),
                C("Hallowed Fountain"),
                C("Watery Grave"),
                L("Island",   4),
                L("Plains",   3),
                L("Mountain", 2),
                L("Swamp",    2)
            )).ToList(),
        });

        //
        // 6 · Rena Duskwhisper — Zur Enchantress · PROXIES: Necropotence,
        //                                          Mana Drain, Force of Will
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Rena Duskwhisper").Id,
            Cards    = Cmd("Zur the Enchanter").Concat(Cards(
                C("Necropotence",       proxy: true),
                C("Mana Drain",         proxy: true),
                C("Force of Will",      proxy: true),
                C("Rest in Peace"),
                C("Stasis"),
                C("Solitary Confinement"),
                C("Detention Sphere"),
                C("Copy Enchantment"),
                C("Steel of the Godhead"),
                C("Diplomatic Immunity"),
                C("Vanishing"),
                C("Imprisoned in the Moon"),
                C("Brainstorm"),
                C("Counterspell"),
                C("Mystic Remora"),
                C("Rhystic Study"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Swords to Plowshares"),
                C("Command Tower"),
                C("Hallowed Fountain"),
                C("Watery Grave"),
                C("Godless Shrine"),
                L("Island", 5),
                L("Plains", 4),
                L("Swamp",  4)
            )).ToList(),
        });

        //
        // 7 · Filo Starcroft — Yidris Storm · NO PROXIES
        //
        db.DeckSubmissions.Add(new DeckSubmission
        {
            EventId  = cmdEvent.Id,
            PlayerId = P("Filo Starcroft").Id,
            Cards    = Cmd("Yidris, Maelstrom Wielder").Concat(Cards(
                C("Wheel of Fortune"),
                C("Windfall"),
                C("Gitaxian Probe"),
                C("Brainstorm"),
                C("Ponder"),
                C("Preordain"),
                C("Dark Ritual"),
                C("Cabal Ritual"),
                C("Mox Diamond"),
                C("Chrome Mox"),
                C("Tendrils of Agony"),
                C("Ad Nauseam"),
                C("Past in Flames"),
                C("Sensei's Divining Top"),
                C("Mystical Tutor"),
                C("Vampiric Tutor"),
                C("Demonic Tutor"),
                C("Yawgmoth's Will"),
                C("Sol Ring"),
                C("Arcane Signet"),
                C("Command Tower"),
                C("Stomping Ground"),
                C("Blood Crypt"),
                C("Watery Grave"),
                C("Breeding Pool"),
                L("Island",   3),
                L("Swamp",    3),
                L("Forest",   2),
                L("Mountain", 2)
            )).ToList(),
        });

        db.SaveChanges();
        Console.WriteLine("[DevDataSeeder] Seeded 8 Commander decks.");
    }

    // ── Deck-building helpers ─────────────────────────────────────────────────

    /// <summary>Single Commander card (section = Commander).</summary>
    private static IEnumerable<DeckCard> Cmd(string name) =>
    [
        new DeckCard { CardName = name, Quantity = 1, Section = DeckSection.Commander, IsProxy = false },
    ];

    /// <summary>Collect card descriptors into a list.</summary>
    private static IEnumerable<DeckCard> Cards(params DeckCard[] cards) => cards;

    /// <summary>Single main-deck card.</summary>
    private static DeckCard C(string name, bool proxy = false) =>
        new() { CardName = name, Quantity = 1, Section = DeckSection.MainDeck, IsProxy = proxy };

    /// <summary>Basic land with explicit quantity.</summary>
    private static DeckCard L(string name, int qty) =>
        new() { CardName = name, Quantity = qty, Section = DeckSection.MainDeck, IsProxy = false };
}
