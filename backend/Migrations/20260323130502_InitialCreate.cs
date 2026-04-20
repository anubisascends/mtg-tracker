using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MtgTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Events",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Format = table.Column<string>(type: "TEXT", nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    RunPhase = table.Column<int>(type: "INTEGER", nullable: true),
                    EliminationType = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentRound = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxPlayers = table.Column<int>(type: "INTEGER", nullable: false),
                    TimerDurationSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    TimerStartedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    RequiresDeckRegistration = table.Column<bool>(type: "INTEGER", nullable: false),
                    ProxiesAllowed = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Role = table.Column<string>(type: "TEXT", nullable: false),
                    Nickname = table.Column<string>(type: "TEXT", nullable: true),
                    LifetimeWins = table.Column<int>(type: "INTEGER", nullable: false),
                    LifetimeLosses = table.Column<int>(type: "INTEGER", nullable: false),
                    LifetimeDraws = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeckSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EventId = table.Column<int>(type: "INTEGER", nullable: false),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeckSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeckSubmissions_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DeckSubmissions_Users_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EventRegistrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EventId = table.Column<int>(type: "INTEGER", nullable: false),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    IsEliminated = table.Column<bool>(type: "INTEGER", nullable: false),
                    EventLosses = table.Column<int>(type: "INTEGER", nullable: false),
                    IsDropped = table.Column<bool>(type: "INTEGER", nullable: false),
                    DroppedAtRound = table.Column<int>(type: "INTEGER", nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventRegistrations_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventRegistrations_Users_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Matches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EventId = table.Column<int>(type: "INTEGER", nullable: false),
                    Player1Id = table.Column<int>(type: "INTEGER", nullable: false),
                    Player2Id = table.Column<int>(type: "INTEGER", nullable: false),
                    Player1Wins = table.Column<int>(type: "INTEGER", nullable: false),
                    Player2Wins = table.Column<int>(type: "INTEGER", nullable: false),
                    Draws = table.Column<int>(type: "INTEGER", nullable: false),
                    IsBye = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsPending = table.Column<bool>(type: "INTEGER", nullable: false),
                    Round = table.Column<int>(type: "INTEGER", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Matches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Matches_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Matches_Users_Player1Id",
                        column: x => x.Player1Id,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Matches_Users_Player2Id",
                        column: x => x.Player2Id,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlayerDecks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Format = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerDecks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerDecks_Users_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DeckCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DeckSubmissionId = table.Column<int>(type: "INTEGER", nullable: false),
                    CardName = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    Section = table.Column<int>(type: "INTEGER", nullable: false),
                    IsProxy = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeckCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeckCards_DeckSubmissions_DeckSubmissionId",
                        column: x => x.DeckSubmissionId,
                        principalTable: "DeckSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerDeckCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerDeckId = table.Column<int>(type: "INTEGER", nullable: false),
                    CardName = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    Section = table.Column<int>(type: "INTEGER", nullable: false),
                    IsProxy = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerDeckCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerDeckCards_PlayerDecks_PlayerDeckId",
                        column: x => x.PlayerDeckId,
                        principalTable: "PlayerDecks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DeckCards_DeckSubmissionId",
                table: "DeckCards",
                column: "DeckSubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_DeckSubmissions_EventId_PlayerId",
                table: "DeckSubmissions",
                columns: new[] { "EventId", "PlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeckSubmissions_PlayerId",
                table: "DeckSubmissions",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_EventId_PlayerId",
                table: "EventRegistrations",
                columns: new[] { "EventId", "PlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_PlayerId",
                table: "EventRegistrations",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_EventId",
                table: "Matches",
                column: "EventId");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_Player1Id",
                table: "Matches",
                column: "Player1Id");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_Player2Id",
                table: "Matches",
                column: "Player2Id");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerDeckCards_PlayerDeckId",
                table: "PlayerDeckCards",
                column: "PlayerDeckId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerDecks_PlayerId",
                table: "PlayerDecks",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeckCards");

            migrationBuilder.DropTable(
                name: "EventRegistrations");

            migrationBuilder.DropTable(
                name: "Matches");

            migrationBuilder.DropTable(
                name: "PlayerDeckCards");

            migrationBuilder.DropTable(
                name: "DeckSubmissions");

            migrationBuilder.DropTable(
                name: "PlayerDecks");

            migrationBuilder.DropTable(
                name: "Events");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
