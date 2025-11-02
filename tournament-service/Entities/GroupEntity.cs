namespace TournamentService.Entities;

public class GroupEntity
{
    public int Id { get; set; }

    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Color { get; set; }

    public string TournamentId { get; set; } = default!;
    public TournamentEntity Tournament { get; set; } = default!;

    public ICollection<BracketMatchEntity> Matches { get; set; } = new List<BracketMatchEntity>();
}
