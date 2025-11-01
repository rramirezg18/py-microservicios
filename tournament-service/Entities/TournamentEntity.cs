namespace TournamentService.Entities;

public class TournamentEntity
{
    // Usamos un string legible como clave: "cup2025"
    public string Id { get; set; } = default!;
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Season { get; set; } = "2025";
    public string Location { get; set; } = "";
    public string Venue { get; set; } = "";
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;

    public ICollection<GroupEntity> Groups { get; set; } = new List<GroupEntity>();
    public ICollection<BracketMatchEntity> Matches { get; set; } = new List<BracketMatchEntity>();
    public int? FinalMatchId { get; set; }
    public BracketMatchEntity? FinalMatch { get; set; }
}
