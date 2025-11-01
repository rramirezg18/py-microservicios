namespace TournamentService.Models;

public sealed class TournamentTeamDetail
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public (string primary, string secondary) Palette { get; set; } = ("#312e81","#6d28d9");
}

public sealed class TournamentMatchTeamSlot
{
    public string? Id { get; set; }
    public string DisplayName { get; set; } = "—";
    public int? Score { get; set; }
    public bool IsPlaceholder { get; set; } = true;
    public (string primary, string secondary)? Palette { get; set; }
}

public sealed class TournamentMatchView
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Round { get; set; } = "group"; // group|semi|final
    public string Status { get; set; } = "scheduled";
    public string StatusLabel { get; set; } = "Programado";
    public string ScheduleLabel { get; set; } = "";
    public string? ScheduledAtUtc { get; set; }
    public TournamentMatchTeamSlot TeamA { get; set; } = new();
    public TournamentMatchTeamSlot TeamB { get; set; } = new();
    public string? GroupId { get; set; }
    public int? SlotIndex { get; set; }
    public bool? IsPlaceholder { get; set; }
}

public sealed class TournamentGroupView
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Color { get; set; }
    public List<TournamentMatchView> Matches { get; set; } = new();
    public TournamentMatchView? SemiFinal { get; set; }
}

public sealed class TournamentSummary
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Season { get; set; } = "";
    public string HeroTitle { get; set; } = "";
    public string Location { get; set; } = "";
    public string ScheduleLabel { get; set; } = "";
    public double Progress { get; set; }
    public int MatchesPlayed { get; set; }
    public int TotalMatches { get; set; }
}

public sealed class TournamentViewModel
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string HeroTitle { get; set; } = "";
    public string Season { get; set; } = "";
    public string Location { get; set; } = "";
    public string Venue { get; set; } = "";
    public string Description { get; set; } = "";
    public string ScheduleLabel { get; set; } = "";
    public string UpdatedLabel { get; set; } = "";
    public string Domain { get; set; } = "league";
    public double Progress { get; set; }
    public int MatchesPlayed { get; set; }
    public int TotalMatches { get; set; }
    public List<TournamentGroupView> Groups { get; set; } = new();
    public TournamentMatchView? Final { get; set; }
}

public sealed class AssignSlotRequest { public int? MatchId { get; set; } }
public sealed class UpdateMatchRequest { public int ScoreA { get; set; } public int ScoreB { get; set; } public string? Status { get; set; } }
