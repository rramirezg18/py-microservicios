namespace MatchesService.Models.Entities;

public class TeamWin
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public long TeamId { get; set; }
    public DateTime RegisteredAtUtc { get; set; } = DateTime.UtcNow;

    public Match? Match { get; set; }
}
