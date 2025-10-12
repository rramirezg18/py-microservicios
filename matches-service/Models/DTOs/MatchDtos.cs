using MatchesService.Models.Entities;
using MatchesService.Models.Enums;

namespace MatchesService.Models.DTOs;

public record TeamSummary(long Id, string Name);

public record MatchListItem(
    int Id,
    DateTime DateMatchUtc,
    MatchStatus Status,
    TeamSummary Home,
    TeamSummary Away,
    int HomeScore,
    int AwayScore,
    int Period,
    int QuarterDurationSeconds,
    int HomeFouls,
    int AwayFouls
);

public record MatchListResponse(
    IReadOnlyList<MatchListItem> Items,
    int Total,
    int Page,
    int PageSize
);

public record MatchTimerDto(bool Running, int RemainingSeconds, DateTime? QuarterEndsAtUtc);

public record MatchDetail(
    int Id,
    TeamSummary Home,
    TeamSummary Away,
    MatchStatus Status,
    int Period,
    int QuarterDurationSeconds,
    MatchTimerDto Timer,
    int HomeScore,
    int AwayScore,
    int HomeFouls,
    int AwayFouls,
    DateTime DateMatchUtc
);

public record ProgramMatchRequest(
    long HomeTeamId,
    long AwayTeamId,
    DateTime DateMatchUtc,
    int? QuarterDurationSeconds
);

public record ReprogramMatchRequest(DateTime NewDateMatchUtc);

public record StartTimerRequest(int? QuarterDurationSeconds);

public record ScoreEventRequest(long TeamId, long? PlayerId, int Points, DateTime? RegisteredAtUtc);

public record AdjustScoreRequest(long TeamId, int Delta);

public record FoulRequest(long TeamId, long? PlayerId, string? Type, DateTime? RegisteredAtUtc);

public record AdjustFoulRequest(long TeamId, int Delta);

public record FinishMatchRequest(
    int HomeScore,
    int AwayScore,
    int HomeFouls,
    int AwayFouls,
    IReadOnlyCollection<ScoreEventRequest>? ScoreEvents,
    IReadOnlyCollection<FoulRequest>? Fouls
);

public record SetQuarterRequest(int Quarter);

public static class MatchDtoMapper
{
    public static MatchListItem ToListItem(Match match) => new(
        match.Id,
        match.DateMatchUtc,
        match.Status,
        new TeamSummary(match.HomeTeamId, match.HomeTeamName),
        new TeamSummary(match.AwayTeamId, match.AwayTeamName),
        match.HomeScore,
        match.AwayScore,
        match.Period,
        match.QuarterDurationSeconds,
        match.HomeFouls,
        match.AwayFouls
    );
}
