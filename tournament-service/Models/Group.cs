// Models/Group.cs
namespace TournametsService.Models;

public class Group
{
    public int Id { get; set; }
    public string Key { get; set; } = default!;    // ej. "group-a"
    public string Name { get; set; } = default!;   // ej. "GRUPO A"
    public string? Color { get; set; }

    public string TournamentId { get; set; } = default!;
    public Tournament? Tournament { get; set; }

    public ICollection<BracketMatch> Matches { get; set; } = new List<BracketMatch>();
}
