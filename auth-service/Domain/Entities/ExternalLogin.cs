using System;

namespace AuthService.Domain.Entities
{
    public class ExternalLogin
    {
        public int Id { get; set; }

        public Guid UserId { get; set; }
        public User User { get; set; } = default!;

        // "google", "github", etc.
        public string Provider { get; set; } = default!;

        // Clave única del proveedor (por ejemplo 'sub' de Google)
        public string ProviderKey { get; set; } = default!;
    }
}
