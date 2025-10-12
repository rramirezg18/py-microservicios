using AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuthService.Infrastructure.Persistence.Configurations
{
    public class ExternalLoginConfig : IEntityTypeConfiguration<ExternalLogin>
    {
        public void Configure(EntityTypeBuilder<ExternalLogin> b)
        {
            b.ToTable("external_logins");
            b.HasKey(x => x.Id);

            b.Property(x => x.Provider).HasMaxLength(64).IsRequired();
            b.Property(x => x.ProviderKey).HasMaxLength(256).IsRequired();

            b.HasIndex(x => new { x.Provider, x.ProviderKey }).IsUnique();
        }
    }
}
