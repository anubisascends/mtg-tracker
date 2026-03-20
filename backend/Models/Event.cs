namespace MtgTracker.Api.Models;

public class Event
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public EventStatus Status { get; set; } = EventStatus.Planning;
    public RunPhase? RunPhase { get; set; }
    public EliminationType EliminationType { get; set; } = EliminationType.Swiss;
    public int CurrentRound { get; set; } = 0;
    public int MaxPlayers { get; set; }
    public int TimerDurationSeconds { get; set; } = 0;
    public DateTime? TimerStartedAt { get; set; }
    public bool RequiresDeckRegistration { get; set; } = false;
    public bool ProxiesAllowed { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<EventRegistration> EventRegistrations { get; set; } = new List<EventRegistration>();
    public ICollection<Match> Matches { get; set; } = new List<Match>();
    public ICollection<DeckSubmission> DeckSubmissions { get; set; } = new List<DeckSubmission>();
}

public enum EventStatus
{
    Planning,   // 0 - Admin only, all fields editable
    Upcoming,   // 1 - Players can see and register, name/date/description/format locked
    InProgress, // 2 - Players can see, no new registrations
    Completed   // 3 - All can view, no registrations, stats tallied
}

public enum EliminationType
{
    Swiss             = 0, // All players play all rounds, paired by record
    SingleElimination = 1, // Lose once and you're out
    DoubleElimination = 2  // Lose twice and you're out
}

public enum RunPhase
{
    Initializing  = 0, // All formats  — event setup, seating, etc.
    Drafting      = 1, // Draft        — card selection from booster packs
    DeckBuilding  = 2, // Draft/Sealed — constructing the play deck from the pool
    PodAssignment = 3, // Commander    — grouping players into multiplayer pods
    Matching      = 4, // All except Commander — generating Swiss/bracket pairings
    Playing       = 5, // All formats  — matches in progress
    Completed     = 6  // All formats  — event finished, triggers stat tally
}
