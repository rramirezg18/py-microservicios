namespace MatchesService.Models.DTOs;

/// <summary>
/// DTO used to add a new score event to a match.
/// </summary>
public record AddScoreDto(
    int TeamId,         // Team that scored
    int? PlayerId,      // Player who scored (optional)
    int Points          // Points scored (1, 2, 3, etc.)
);
