namespace TournamentService.Entities;

public class BracketMatchEntity
{
    public int Id { get; set; }

    public string TournamentId { get; set; } = default!;
    public TournamentEntity Tournament { get; set; } = default!;

    public int? GroupId { get; set; }
    public GroupEntity? Group { get; set; }

    public string Round { get; set; } = "group";


    public int? SlotIndex { get; set; }

    public string Label { get; set; } = "";


    public int? ExternalMatchId { get; set; }


    public string Status { get; set; } = "scheduled";

    public DateTime? ScheduledAtUtc { get; set; }
}
