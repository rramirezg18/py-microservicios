using Microsoft.EntityFrameworkCore;
using MatchesService.Models.Entities;
using MatchesService.Models.Enums;

namespace MatchesService.Infrastructure;

public class MatchesDbContext(DbContextOptions<MatchesDbContext> options) : DbContext(options)
{
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<ScoreEvent> ScoreEvents => Set<ScoreEvent>();
    public DbSet<Foul> Fouls => Set<Foul>();
    public DbSet<TeamWin> TeamWins => Set<TeamWin>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Match>(entity =>
        {
            entity.ToTable("matches");
            entity.Property(m => m.HomeTeamName).HasMaxLength(120);
            entity.Property(m => m.AwayTeamName).HasMaxLength(120);
            entity.Property(m => m.Status)
                .HasConversion(
                    status => status.ToString(),
                    value => Enum.TryParse<MatchStatus>(value, true, out var parsed) ? parsed : MatchStatus.Scheduled)
                .HasMaxLength(24);
            entity.Property(m => m.DateMatchUtc).IsRequired();
            entity.Property(m => m.QuarterDurationSeconds).HasDefaultValue(600);
            entity.Property(m => m.Period).HasDefaultValue(1);
            entity.Property(m => m.CreatedAtUtc).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(m => m.UpdatedAtUtc).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasMany(m => m.ScoreEvents)
                .WithOne(e => e.Match)
                .HasForeignKey(e => e.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(m => m.Fouls)
                .WithOne(f => f.Match)
                .HasForeignKey(f => f.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(m => m.Wins)
                .WithOne(w => w.Match)
                .HasForeignKey(w => w.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScoreEvent>(entity =>
        {
            entity.ToTable("score_events");
            entity.Property(e => e.RegisteredAtUtc).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        modelBuilder.Entity<Foul>(entity =>
        {
            entity.ToTable("fouls");
            entity.Property(f => f.Type).HasMaxLength(80);
            entity.Property(f => f.RegisteredAtUtc).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        modelBuilder.Entity<TeamWin>(entity =>
        {
            entity.ToTable("team_wins");
            entity.Property(w => w.RegisteredAtUtc).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(w => new { w.MatchId, w.TeamId }).IsUnique();
        });
    }
}
