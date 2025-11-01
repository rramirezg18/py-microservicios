// Models/Tournament.cs
namespace TournametsService.Models;

public class Tournament
{
    public string Id { get; set; } = default!;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Season { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;

    public int? FinalMatchId { get; set; }
    public BracketMatch? FinalMatch { get; set; }

    public ICollection<Group> Groups { get; set; } = new List<Group>();
    public ICollection<BracketMatch> Matches { get; set; } = new List<BracketMatch>();
}
