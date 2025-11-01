using System.ComponentModel.DataAnnotations;

namespace MatchesService.Models.DTOs
{
    /// <summary>DTO para iniciar/ajustar el temporizador del partido.</summary>
    public record class StartTimerDto
    {
        [Range(1, 7200)] public int? Seconds { get; init; }
        [Range(1, 7200)] public int? QuarterDurationSeconds { get; init; }
    }

}
