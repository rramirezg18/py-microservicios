namespace MatchesService.Models
{
    /// <summary>
    /// Representa una falta cometida por un equipo o jugador en un partido.
    /// </summary>
    public class Foul
    {
        public long Id { get; set; }

        public int MatchId { get; set; }
        public Match Match { get; set; } = null!;

        // 🔹 Ya no usamos la entidad Team, solo guardamos el ID del equipo
        public int TeamId { get; set; }

        // 👇 El jugador se referencia solo por ID (viene del players-service)
        public int? PlayerId { get; set; }

        /// <summary>
        /// Tipo de falta: Personal, Técnica, Antideportiva, etc.
        /// </summary>
        public string? Type { get; set; }

        /// <summary>
        /// Fecha y hora en que se registró la falta.
        /// </summary>
        public DateTime DateRegister { get; set; } = DateTime.UtcNow;
    }
}
