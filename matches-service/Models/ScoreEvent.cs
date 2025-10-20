namespace MatchesService.Models
{
    /// <summary>
    /// Representa un evento de anotación o ajuste de puntos dentro de un partido.
    /// </summary>
    public class ScoreEvent
    {
        public long Id { get; set; }

        public int MatchId { get; set; }
        public Match Match { get; set; } = null!;

        // 🔹 Solo se almacena el ID del equipo, no la entidad Team
        public int TeamId { get; set; }

        // 👇 El jugador es opcional (viene del players-service por API)
        public int? PlayerId { get; set; }

        /// <summary>
        /// Puntos agregados o ajustados (1, 2, 3 o negativos para corrección).
        /// </summary>
        public int Points { get; set; }

        /// <summary>
        /// Nota opcional o descripción del evento (por ejemplo: “Triple de esquina”)
        /// </summary>
        public string? Note { get; set; }

        /// <summary>
        /// Fecha y hora en que se registró el evento.
        /// </summary>
        public DateTime DateRegister { get; set; } = DateTime.UtcNow;
    }
}

