// Models/BracketMatch.cs
namespace TournametsService.Models;

public class BracketMatch
{
    public int Id { get; set; }

    public string TournamentId { get; set; } = default!;
    public Tournament? Tournament { get; set; }

    public int? GroupId { get; set; }
    public Group? Group { get; set; }

    // 'group' | 'semi' | 'final'
    public string Round { get; set; } = "group";

    public int? SlotIndex { get; set; } // 0,1,...
    public string Label { get; set; } = string.Empty;

    // id del partido real en matches-service; null = placeholder
    public int? ExternalMatchId { get; set; }

    public string Status { get; set; } = "scheduled"; // scheduled|live|finished
    public DateTime? ScheduledAtUtc { get; set; }
}
