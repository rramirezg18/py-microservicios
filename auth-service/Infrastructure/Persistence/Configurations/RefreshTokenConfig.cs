using AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthService.Infrastructure.Persistence.Configurations
{
    public class RefreshTokenConfig : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> b)
        {
            b.ToTable("refresh_tokens");
            b.HasKey(x => x.Id);

            b.Property(x => x.TokenHash).HasMaxLength(256).IsRequired();
            b.HasIndex(x => new { x.UserId, x.TokenHash }).IsUnique();

            b.Property(x => x.CreatedAt);
            b.Property(x => x.ExpiresAt);
            b.Property(x => x.RevokedAt);
        }
    }
}
