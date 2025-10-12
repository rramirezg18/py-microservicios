using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AuthService.Application.Abstractions;
using AuthService.Application.Contracts.Auth;
using AuthService.Application.Options;
using AuthService.Domain.Entities;
using AuthService.Infrastructure.Persistence;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly AuthDbContext _db;
        private readonly ITokenService _tokens;
        private readonly PasswordHasher _hasher;
        private readonly JwtOptions _jwt;

        public AuthService(
            AuthDbContext db,
            ITokenService tokens,
            PasswordHasher hasher,
            IOptions<JwtOptions> jwt)
        {
            _db = db;
            _tokens = tokens;
            _hasher = hasher;
            _jwt = jwt.Value;
        }

        private async Task<AuthTokensDto> IssueTokensAsync(User user)
        {
            var access = _tokens.GenerateAccessToken(user.Id, user.Email, user.Role);

            var refresh = _tokens.GenerateRefreshToken();
            var refreshHash = PasswordHasher.Sha256Base64(refresh);

            var expires = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays);

            // Invalidar tokens antiguos del usuario (opcional)
            var oldTokens = await _db.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var t in oldTokens) t.RevokedAt = DateTime.UtcNow;

            _db.RefreshTokens.Add(new RefreshToken
            {
                UserId = user.Id,
                TokenHash = refreshHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = expires
            });

            await _db.SaveChangesAsync();

            return new AuthTokensDto { AccessToken = access, RefreshToken = refresh };
        }

        public async Task<AuthTokensDto> RegisterAsync(RegisterRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            if (await _db.Users.AnyAsync(u => u.Email == email))
                throw new InvalidOperationException("Email ya registrado.");

            var user = new User
            {
                Email = email,
                Name = request.Name?.Trim(),
                PasswordHash = _hasher.Hash(request.Password),
                Role = "user",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            return await IssueTokensAsync(user);
        }

        public async Task<AuthTokensDto> LoginAsync(LoginRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || !user.IsActive) throw new InvalidOperationException("Credenciales inválidas.");

            if (string.IsNullOrWhiteSpace(user.PasswordHash) || !_hasher.Verify(request.Password, user.PasswordHash))
                throw new InvalidOperationException("Credenciales inválidas.");

            return await IssueTokensAsync(user);
        }

        public async Task<AuthTokensDto> LoginWithGoogleAsync(GoogleLoginRequest request)
        {
            // Validación mínima del idToken localmente (sin llamar a Google): leemos claims.
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(request.IdToken);
            var sub = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)?.Value;
            var email = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Email)?.Value
                        ?? jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;

            if (string.IsNullOrWhiteSpace(sub) || string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException("IdToken inválido.");

            var provider = "google";

            // ¿Existe login externo?
            var ext = await _db.ExternalLogins
                .Include(e => e.User)
                .FirstOrDefaultAsync(e => e.Provider == provider && e.ProviderKey == sub);

            if (ext != null)
            {
                if (!ext.User.IsActive) throw new InvalidOperationException("Usuario inactivo.");
                return await IssueTokensAsync(ext.User);
            }

            // ¿Existe usuario con ese email? Si sí, le adjuntamos el login externo
            var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existing != null)
            {
                existing.ExternalLogins.Add(new ExternalLogin
                {
                    Provider = provider,
                    ProviderKey = sub
                });
                await _db.SaveChangesAsync();
                return await IssueTokensAsync(existing);
            }

            // Nuevo usuario sin password
            var newUser = new User
            {
                Email = email.ToLowerInvariant(),
                Name = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value,
                PasswordHash = null, // solo externo
                Role = "user",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            newUser.ExternalLogins.Add(new ExternalLogin { Provider = provider, ProviderKey = sub });

            _db.Users.Add(newUser);
            await _db.SaveChangesAsync();

            return await IssueTokensAsync(newUser);
        }

        public async Task<AuthTokensDto> RefreshAsync(RefreshTokenRequest request)
        {
            var hash = PasswordHasher.Sha256Base64(request.RefreshToken);

            var token = await _db.RefreshTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == hash);

            if (token == null || token.RevokedAt != null || token.ExpiresAt <= DateTime.UtcNow)
                throw new InvalidOperationException("Refresh token inválido.");

            // Rotación: revocamos el actual y emitimos otro
            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return await IssueTokensAsync(token.User);
        }
    }
}
