namespace MatchesService.Models
{
    /// <summary>
    /// Registra el equipo ganador de un partido.
    /// </summary>
    public class TeamWin
    {
        public long Id { get; set; }

        /// <summary>
        /// Identificador del equipo ganador.
        /// </summary>
        public int TeamId { get; set; }

        /// <summary>
        /// Identificador del partido correspondiente.
        /// </summary>
        public int MatchId { get; set; }

        /// <summary>
        /// Fecha y hora en que se registró la victoria (UTC).
        /// </summary>
        public DateTime DateRegistered { get; set; } = DateTime.UtcNow;

        // 🔹 Solo mantenemos la relación con el partido (Match)
        public Match Match { get; set; } = null!;
    }
}
