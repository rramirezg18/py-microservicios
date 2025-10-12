using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Domain.Entities;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Persistence.Seed
{
    public static class DbSeeder
    {
        public static async Task RunAsync(AuthDbContext db, PasswordHasher hasher)
        {
            await db.Database.EnsureCreatedAsync();

            // Admin inicial
            var adminEmail = "admin@local";
            if (!await db.Users.AnyAsync(u => u.Email == adminEmail))
            {
                var admin = new User
                {
                    Email = adminEmail,
                    Name = "Admin",
                    PasswordHash = hasher.Hash("Admin123!"),
                    Role = "admin",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                db.Users.Add(admin);
                await db.SaveChangesAsync();
            }
        }
    }
}
