namespace MatchesService.Models.DTOs;

/// <summary>
/// Ajusta el marcador (suma o resta puntos) de un equipo.
/// </summary>
public record AdjustScoreDto(
    int TeamId,   // ID del equipo
    int Delta     // Diferencia (positiva o negativa)
);