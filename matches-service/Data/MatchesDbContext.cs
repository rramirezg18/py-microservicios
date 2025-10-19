using Microsoft.EntityFrameworkCore;
using MatchesService.Models;

namespace MatchesService.Data
{
    /// <summary>
    /// Contexto principal de la base de datos para el microservicio de partidos (matches-service).
    /// Solo maneja información de partidos, puntuaciones, faltas y victorias.
    /// Los equipos se obtienen desde el microservicio teams-service (Java).
    /// </summary>
    public class MatchesDbContext : DbContext
    {
        public MatchesDbContext(DbContextOptions<MatchesDbContext> options)
            : base(options)
        {
        }

        // 🔹 Tablas principales del microservicio
        public DbSet<Match> Matches { get; set; } = null!;
        public DbSet<ScoreEvent> ScoreEvents { get; set; } = null!;
        public DbSet<Foul> Fouls { get; set; } = null!;
        public DbSet<TeamWin> TeamWins { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ⚙️ Configuración de relaciones internas (sin Team local)

            // Cada ScoreEvent pertenece a un partido
            modelBuilder.Entity<ScoreEvent>()
                .HasOne(se => se.Match)
                .WithMany(m => m.ScoreEvents)
                .HasForeignKey(se => se.MatchId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cada falta pertenece a un partido
            modelBuilder.Entity<Foul>()
                .HasOne(f => f.Match)
                .WithMany(m => m.Fouls)
                .HasForeignKey(f => f.MatchId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cada TeamWin depende de un partido
            modelBuilder.Entity<TeamWin>()
                .HasOne(tw => tw.Match)
                .WithMany()
                .HasForeignKey(tw => tw.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
