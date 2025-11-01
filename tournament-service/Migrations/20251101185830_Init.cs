using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TournametsService.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BracketMatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TournamentId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    GroupId = table.Column<int>(type: "int", nullable: true),
                    Round = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SlotIndex = table.Column<int>(type: "int", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExternalMatchId = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ScheduledAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BracketMatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tournaments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Season = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Venue = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinalMatchId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tournaments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Tournaments_BracketMatches_FinalMatchId",
                        column: x => x.FinalMatchId,
                        principalTable: "BracketMatches",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Groups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Key = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Color = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TournamentId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Groups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Groups_Tournaments_TournamentId",
                        column: x => x.TournamentId,
                        principalTable: "Tournaments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Tournaments",
                columns: new[] { "Id", "Code", "FinalMatchId", "Location", "Name", "Season", "UpdatedUtc", "Venue" },
                values: new object[] { "cup2025", "cup2025", null, "Arena Nacional", "Copa 2025", "2025", new DateTime(2025, 11, 1, 18, 58, 30, 392, DateTimeKind.Utc).AddTicks(3797), "Estadio Principal" });

            migrationBuilder.InsertData(
                table: "BracketMatches",
                columns: new[] { "Id", "ExternalMatchId", "GroupId", "Label", "Round", "ScheduledAtUtc", "SlotIndex", "Status", "TournamentId" },
                values: new object[] { 1099, null, null, "Final", "final", null, null, "scheduled", "cup2025" });

            migrationBuilder.InsertData(
                table: "Groups",
                columns: new[] { "Id", "Color", "Key", "Name", "TournamentId" },
                values: new object[,]
                {
                    { 1, "#7c3aed", "group-a", "GRUPO A", "cup2025" },
                    { 2, "#a21caf", "group-b", "GRUPO B", "cup2025" }
                });

            migrationBuilder.InsertData(
                table: "BracketMatches",
                columns: new[] { "Id", "ExternalMatchId", "GroupId", "Label", "Round", "ScheduledAtUtc", "SlotIndex", "Status", "TournamentId" },
                values: new object[,]
                {
                    { 1001, null, 1, "Ronda grupal 1", "group", null, 0, "scheduled", "cup2025" },
                    { 1002, null, 1, "Ronda grupal 2", "group", null, 1, "scheduled", "cup2025" },
                    { 1003, null, 2, "Ronda grupal 1", "group", null, 0, "scheduled", "cup2025" },
                    { 1004, null, 2, "Ronda grupal 2", "group", null, 1, "scheduled", "cup2025" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_BracketMatches_GroupId",
                table: "BracketMatches",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_BracketMatches_TournamentId",
                table: "BracketMatches",
                column: "TournamentId");

            migrationBuilder.CreateIndex(
                name: "IX_Groups_TournamentId_Key",
                table: "Groups",
                columns: new[] { "TournamentId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tournaments_FinalMatchId",
                table: "Tournaments",
                column: "FinalMatchId");

            migrationBuilder.AddForeignKey(
                name: "FK_BracketMatches_Groups_GroupId",
                table: "BracketMatches",
                column: "GroupId",
                principalTable: "Groups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_BracketMatches_Tournaments_TournamentId",
                table: "BracketMatches",
                column: "TournamentId",
                principalTable: "Tournaments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BracketMatches_Groups_GroupId",
                table: "BracketMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_BracketMatches_Tournaments_TournamentId",
                table: "BracketMatches");

            migrationBuilder.DropTable(
                name: "Groups");

            migrationBuilder.DropTable(
                name: "Tournaments");

            migrationBuilder.DropTable(
                name: "BracketMatches");
        }
    }
}
