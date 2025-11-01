// Controllers/TournamentsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TournametsService.Data;
using TournametsService.Models;
using TournametsService.Services;

namespace TournametsService.Controllers;

[ApiController]
[Route("api/tournaments")]
public class TournamentsController : ControllerBase
{
    private readonly TournametsDbContext _db;
    private readonly TournamentQueryService _query;

    public TournamentsController(TournametsDbContext db, TournamentQueryService query)
    {
        _db = db;
        _query = query;
    }

    // Inicializa un torneo demo si la tabla está vacía (solo para dev)
    private async Task EnsureSeedAsync()
    {
        if (await _db.Tournaments.AnyAsync()) return;

        var t = new Tournament
        {
            Id = "cup2025",
            Code = "cup2025",
            Name = "Copa 2025",
            Season = "2025",
            Location = "Arena Nacional",
            Venue = "Estadio Principal",
            UpdatedUtc = DateTime.UtcNow
        };

        var gA = new Group { Key = "group-a", Name = "GRUPO A", Color = "#7c3aed", Tournament = t };
        var gB = new Group { Key = "group-b", Name = "GRUPO B", Color = "#a21caf", Tournament = t };

        _db.Tournaments.Add(t);
        _db.Groups.AddRange(gA, gB);

        // 2 slots por grupo, sin asignación inicial (placeholders)
        _db.BracketMatches.AddRange(
            new BracketMatch { Tournament = t, Group = gA, Round = "group", SlotIndex = 0, Label = "Ronda grupal 1" },
            new BracketMatch { Tournament = t, Group = gA, Round = "group", SlotIndex = 1, Label = "Ronda grupal 2" },
            new BracketMatch { Tournament = t, Group = gB, Round = "group", SlotIndex = 0, Label = "Ronda grupal 1" },
            new BracketMatch { Tournament = t, Group = gB, Round = "group", SlotIndex = 1, Label = "Ronda grupal 2" }
        );

        // Final placeholder
        var final = new BracketMatch { Tournament = t, Round = "final", Label = "Final" };
        _db.BracketMatches.Add(final);
        t.FinalMatch = final;

        await _db.SaveChangesAsync();
    }

    [HttpGet]
    public async Task<IActionResult> ListAsync([FromQuery] bool refresh = false)
    {
        await EnsureSeedAsync();
        var list = await _query.ListSummariesAsync();
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAsync([FromRoute] string id)
    {
        await EnsureSeedAsync();
        var vm = await _query.GetViewAsync(id);
        if (vm == null) return NotFound();
        return Ok(vm);
    }

    public record AssignSlotRequest(int? matchId);

    [HttpPut("{tournamentId}/groups/{groupKey}/slots/{slotIndex:int}")]
    public async Task<IActionResult> AssignSlotAsync(
        [FromRoute] string tournamentId,
        [FromRoute] string groupKey,
        [FromRoute] int slotIndex,
        [FromBody] AssignSlotRequest body)
    {
        await EnsureSeedAsync();

        var group = await _db.Groups
            .FirstOrDefaultAsync(g => g.TournamentId == tournamentId && g.Key == groupKey);
        if (group == null) return NotFound(new { error = "Grupo no encontrado." });

        var match = await _db.BracketMatches
            .FirstOrDefaultAsync(m =>
                m.TournamentId == tournamentId &&
                m.GroupId == group.Id &&
                m.SlotIndex == slotIndex &&
                m.Round == "group");

        if (match == null) return NotFound(new { error = "Slot no encontrado en el grupo." });

        // Asigna (o limpia si viene null)
        match.ExternalMatchId = body.matchId;
        await _db.SaveChangesAsync();

        var vm = await _query.GetViewAsync(tournamentId);
        return Ok(vm);
    }

    public record UpdateMatchRequestDto(int scoreA, int scoreB, string? status);

    // Mínimo para evitar 404 si tu UI lo llama
    [HttpPatch("{tournamentId}/matches/{matchId}")]
    public async Task<IActionResult> UpdateMatchAsync(
        [FromRoute] string tournamentId,
        [FromRoute] string matchId,
        [FromBody] UpdateMatchRequestDto dto)
    {
        // Si hay coincidencia de ExternalMatchId, marcamos status (simple)
        if (int.TryParse(matchId, out var externalId))
        {
            var bm = await _db.BracketMatches
                .FirstOrDefaultAsync(b => b.TournamentId == tournamentId && b.ExternalMatchId == externalId);

            if (bm != null && !string.IsNullOrWhiteSpace(dto.status))
            {
                bm.Status = dto.status!;
                await _db.SaveChangesAsync();
            }
        }

        var vm = await _query.GetViewAsync(tournamentId);
        return vm is null ? NotFound() : Ok(vm);
    }
}
