namespace MatchesService.Models.DTOs;

/// <summary>
/// DTO used to register a new foul in a match.
/// </summary>
public record AddFoulDto(
    int TeamId,         // Team committing the foul
    int? PlayerId,      // Player committing the foul (optional)
    string? Type        // Type of foul (optional: personal, technical, etc.)
);
