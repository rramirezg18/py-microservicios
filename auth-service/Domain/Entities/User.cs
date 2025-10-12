using System;
using System.Collections.Generic;

namespace AuthService.Domain.Entities
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public string Email { get; set; } = default!;
        public string? Name { get; set; }

        // Password en formato PBKDF2$iter$salt$hash (o null si solo login externo)
        public string? PasswordHash { get; set; }

        // Rol simple como string (admin/user)
        public string Role { get; set; } = "user";

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
        public ICollection<ExternalLogin> ExternalLogins { get; set; } = new List<ExternalLogin>();
    }
}
