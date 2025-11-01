// Services/TournamentQueryService.cs
using Microsoft.EntityFrameworkCore;
using TournametsService.Data;
using TournametsService.Models;

namespace TournametsService.Services;

public class TournamentQueryService
{
    private readonly TournametsDbContext _db;

    public TournamentQueryService(TournametsDbContext db) => _db = db;

    public async Task<List<object>> ListSummariesAsync()
    {
        var items = await _db.Tournaments.AsNoTracking().ToListAsync();
        return items.Select(t => new
        {
            id = t.Id,
            code = t.Code,
            name = t.Name,
            season = t.Season,
            heroTitle = t.Name,
            location = t.Location,
            scheduleLabel = "Calendario pendiente",
            progress = 0.0,
            matchesPlayed = 0,
            totalMatches = _db.BracketMatches.Count(b => b.TournamentId == t.Id)
        } as object).ToList();
    }

    public async Task<object?> GetViewAsync(string id)
    {
        var t = await _db.Tournaments
            .Include(x => x.Groups)
                .ThenInclude(g => g.Matches)
            .Include(x => x.Matches)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (t == null) return null;

        return ToViewModel(t);
    }

    public object ToViewModel(Tournament t)
    {
        var groups = t.Groups
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                id = g.Key,
                name = g.Name,
                color = g.Color,
                matches = g.Matches
                    .OrderBy(m => m.SlotIndex ?? int.MaxValue)
                    .Select(m => ToMatchView(m, g.Key))
                    .ToList(),
                qualifiers = new List<object>(),
                semiFinal = (object?)null
            }).ToList();

        var final = t.FinalMatch != null ? ToMatchView(t.FinalMatch, null) : null;

        return new
        {
            id = t.Id,
            code = t.Code,
            name = t.Name,
            heroTitle = t.Name,
            season = t.Season,
            location = t.Location,
            venue = t.Venue,
            description = "",
            scheduleLabel = "Calendario pendiente",
            updatedLabel = t.UpdatedUtc.ToString("u"),
            domain = "basket",
            progress = 0.0,
            matchesPlayed = 0,
            totalMatches = t.Matches.Count,
            summary = "",
            groups,
            final,
            winner = (object?)null,
            teams = new List<object>(),
            teamsIndex = new Dictionary<string, object>()
        };
    }

    private static object ToMatchView(BracketMatch m, string? groupKey)
    {
        var isPlaceholder = m.ExternalMatchId == null;
        var id = isPlaceholder ? $"slot:{groupKey}:{m.SlotIndex}" : m.ExternalMatchId!.Value.ToString();

        return new
        {
            id,
            label = m.Label,
            round = m.Round,
            status = m.Status,
            statusLabel = m.Status,
            scheduleLabel = m.ScheduledAtUtc?.ToString("u") ?? "Sin fecha",
            scheduledAtUtc = m.ScheduledAtUtc,
            venue = (string?)null,
            broadcast = (string?)null,
            teamA = new
            {
                id = (string?)null,
                displayName = "Por definir",
                score = (int?)null,
                isPlaceholder = true,
                originLabel = (string?)null,
                detail = (object?)null,
                palette = (object?)null
            },
            teamB = new
            {
                id = (string?)null,
                displayName = "Por definir",
                score = (int?)null,
                isPlaceholder = true,
                originLabel = (string?)null,
                detail = (object?)null,
                palette = (object?)null
            },
            winnerId = (string?)null,
            groupId = groupKey,
            slotIndex = m.SlotIndex,
            isPlaceholder
        };
    }
}
