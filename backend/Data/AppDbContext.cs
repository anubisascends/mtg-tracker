using Microsoft.EntityFrameworkCore;
using MtgTracker.Api.Models;

namespace MtgTracker.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<DeckSubmission> DeckSubmissions => Set<DeckSubmission>();
    public DbSet<DeckCard> DeckCards => Set<DeckCard>();
    public DbSet<PlayerDeck> PlayerDecks => Set<PlayerDeck>();
    public DbSet<PlayerDeckCard> PlayerDeckCards => Set<PlayerDeckCard>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<EmailSettings> EmailSettings => Set<EmailSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.Username).IsUnique();
        });

        modelBuilder.Entity<EventRegistration>(e =>
        {
            e.HasIndex(r => new { r.EventId, r.PlayerId }).IsUnique();
            e.HasOne(r => r.Event).WithMany(ev => ev.EventRegistrations).HasForeignKey(r => r.EventId);
            e.HasOne(r => r.Player).WithMany(u => u.EventRegistrations).HasForeignKey(r => r.PlayerId);
        });

        modelBuilder.Entity<Match>(e =>
        {
            e.HasOne(m => m.Event).WithMany(ev => ev.Matches).HasForeignKey(m => m.EventId);
            e.HasOne(m => m.Player1).WithMany().HasForeignKey(m => m.Player1Id).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.Player2).WithMany().HasForeignKey(m => m.Player2Id).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DeckSubmission>(e =>
        {
            e.HasIndex(d => new { d.EventId, d.PlayerId }).IsUnique();
            e.HasOne(d => d.Event).WithMany(ev => ev.DeckSubmissions).HasForeignKey(d => d.EventId);
            e.HasOne(d => d.Player).WithMany().HasForeignKey(d => d.PlayerId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DeckCard>(e =>
        {
            e.HasOne(c => c.DeckSubmission).WithMany(d => d.Cards).HasForeignKey(c => c.DeckSubmissionId);
        });

        modelBuilder.Entity<PlayerDeck>(e =>
        {
            e.HasIndex(d => d.PlayerId);
            e.HasOne(d => d.Player).WithMany().HasForeignKey(d => d.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerDeckCard>(e =>
        {
            e.HasOne(c => c.Deck).WithMany(d => d.Cards).HasForeignKey(c => c.PlayerDeckId);
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.HasIndex(t => t.Token).IsUnique();
            e.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
