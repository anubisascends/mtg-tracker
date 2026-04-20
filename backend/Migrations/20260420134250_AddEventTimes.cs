using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MtgTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEventTimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "EndTime",
                table: "Events",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "Events",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Events");
        }
    }
}
