namespace TournamentService.Entities;

public class BracketMatchEntity
{
    public int Id { get; set; }

    public string TournamentId { get; set; } = default!;
    public TournamentEntity Tournament { get; set; } = default!;

    public int? GroupId { get; set; }
    public GroupEntity? Group { get; set; }

    // "group" | "semi" | "final"
    public string Round { get; set; } = "group";

    // Para los de grupo: 0,1,2...
    public int? SlotIndex { get; set; }

    // Texto para la UI
    public string Label { get; set; } = "";

    // Vinculación con matches-service
    public int? ExternalMatchId { get; set; }

    // scheduled | live | finished (se refresca desde matches-service)
    public string Status { get; set; } = "scheduled";

    public DateTime? ScheduledAtUtc { get; set; }
}
