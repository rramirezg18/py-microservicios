namespace MatchesService.Models.DTOs;

/// <summary>
/// DTO para iniciar el temporizador de un partido.
/// </summary>
public record StartTimerDto(
    int Seconds   // Duración del cuarto o periodo en segundos
);
