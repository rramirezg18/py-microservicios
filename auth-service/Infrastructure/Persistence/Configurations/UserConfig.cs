using AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthService.Infrastructure.Persistence.Configurations
{
    public class UserConfig : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> b)
        {
            b.ToTable("users");
            b.HasKey(x => x.Id);

            b.Property(x => x.Email).HasMaxLength(200).IsRequired();
            b.HasIndex(x => x.Email).IsUnique();

            b.Property(x => x.Name).HasMaxLength(200);
            b.Property(x => x.PasswordHash).HasMaxLength(600);
            b.Property(x => x.Role).HasMaxLength(32).HasDefaultValue("user");
            b.Property(x => x.IsActive).HasDefaultValue(true);
            b.Property(x => x.CreatedAt);

            b.HasMany(x => x.RefreshTokens)
             .WithOne(x => x.User)
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.ExternalLogins)
             .WithOne(x => x.User)
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
