using System;
using System.Security.Cryptography;
using System.Text;

namespace AuthService.Infrastructure.Security
{
    // Formato: PBKDF2$<iterations>$<saltBase64>$<hashBase64>
    public class PasswordHasher
    {
        private const int SaltSize = 16;      // 128-bit
        private const int KeySize  = 32;      // 256-bit
        private const int Iterations = 100_000;

        public string Hash(string password)
        {
            using var rng = RandomNumberGenerator.Create();
            var salt = new byte[SaltSize];
            rng.GetBytes(salt);

            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, Iterations, HashAlgorithmName.SHA256);
            var key = pbkdf2.GetBytes(KeySize);

            return $"PBKDF2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
        }

        public bool Verify(string password, string hashBase64)
        {
            try
            {
                var parts = hashBase64.Split('$');
                if (parts.Length != 4 || parts[0] != "PBKDF2") return false;

                var iterations = int.Parse(parts[1]);
                var salt = Convert.FromBase64String(parts[2]);
                var expected = Convert.FromBase64String(parts[3]);

                using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
                var actual = pbkdf2.GetBytes(expected.Length);
                return CryptographicOperations.FixedTimeEquals(actual, expected);
            }
            catch { return false; }
        }

        public static string Sha256Base64(string input)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
            return Convert.ToBase64String(bytes);
        }
    }
}
