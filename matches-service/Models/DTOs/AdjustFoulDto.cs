namespace MatchesService.Models.DTOs;

/// <summary>
/// Ajusta la cantidad de faltas de un equipo.
/// </summary>
public record AdjustFoulDto(
    int TeamId,   // ID del equipo
    int Delta     // Diferencia (positiva o negativa)
);
