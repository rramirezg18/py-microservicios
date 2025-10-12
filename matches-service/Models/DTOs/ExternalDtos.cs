namespace MatchesService.Models.DTOs;

public record TeamDto(long Id, string Name, string? Coach, string? City);

public record PlayerDto(long? Id, string? Name, string? Position, int? Number, string? Nationality, string? Team);

public record TeamRoster(TeamSummary Team, IReadOnlyList<PlayerDto> Players);

public record MatchRostersResponse(TeamRoster Home, TeamRoster Away);
