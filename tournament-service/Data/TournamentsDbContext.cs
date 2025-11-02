// Data/TournametsDbContext.cs
using Microsoft.EntityFrameworkCore;
using TournametsService.Models;

namespace TournametsService.Data;

public class TournametsDbContext : DbContext
{
    public TournametsDbContext(DbContextOptions<TournametsDbContext> options) : base(options) { }

    public DbSet<Tournament> Tournaments => Set<Tournament>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<BracketMatch> BracketMatches => Set<BracketMatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Tournament
        modelBuilder.Entity<Tournament>(eb =>
        {
            eb.HasKey(t => t.Id);
            eb.Property(t => t.Id).HasMaxLength(450);

            eb.HasOne(t => t.FinalMatch)
              .WithMany()
              .HasForeignKey(t => t.FinalMatchId)
              .OnDelete(DeleteBehavior.Restrict);
        });

        // Group
        modelBuilder.Entity<Group>(eb =>
        {
            eb.HasKey(g => g.Id);
            eb.Property(g => g.Key).HasMaxLength(450);

            eb.HasIndex(g => new { g.TournamentId, g.Key }).IsUnique();

            eb.HasOne(g => g.Tournament)
              .WithMany(t => t.Groups)
              .HasForeignKey(g => g.TournamentId)
              .OnDelete(DeleteBehavior.Cascade);
        });

        // BracketMatch
        modelBuilder.Entity<BracketMatch>(eb =>
        {
            eb.HasKey(b => b.Id);

            eb.HasOne(b => b.Tournament)
              .WithMany(t => t.Matches)
              .HasForeignKey(b => b.TournamentId)
              .OnDelete(DeleteBehavior.Restrict); 

            eb.HasOne(b => b.Group)
              .WithMany(g => g.Matches)
              .HasForeignKey(b => b.GroupId)
              .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
