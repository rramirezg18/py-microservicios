using MatchesService.Models.Enums;

namespace MatchesService.Models.Entities;

public class Match
{
    public int Id { get; set; }
    public long HomeTeamId { get; set; }
    public string HomeTeamName { get; set; } = string.Empty;
    public long AwayTeamId { get; set; }
    public string AwayTeamName { get; set; } = string.Empty;
    public MatchStatus Status { get; set; } = MatchStatus.Scheduled;
    public DateTime DateMatchUtc { get; set; }
    public int QuarterDurationSeconds { get; set; } = 600;
    public int Period { get; set; } = 1;
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public int HomeFouls { get; set; }
    public int AwayFouls { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<ScoreEvent> ScoreEvents { get; set; } = new List<ScoreEvent>();
    public ICollection<Foul> Fouls { get; set; } = new List<Foul>();
    public ICollection<TeamWin> Wins { get; set; } = new List<TeamWin>();
}
