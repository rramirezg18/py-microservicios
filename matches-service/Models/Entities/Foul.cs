namespace MatchesService.Models.Entities;

public class Foul
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public long TeamId { get; set; }
    public long? PlayerId { get; set; }
    public string? Type { get; set; }
    public DateTime RegisteredAtUtc { get; set; } = DateTime.UtcNow;

    public Match? Match { get; set; }
}
