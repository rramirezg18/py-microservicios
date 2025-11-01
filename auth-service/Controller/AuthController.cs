using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using AspNet.Security.OAuth.GitHub;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

using AuthService.Models.Dtos;
using AuthService.Services.Interfaces;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly TokenValidationParameters _tvp;
        private readonly IConfiguration _cfg;

        public AuthController(IAuthService auth, TokenValidationParameters tvp, IConfiguration cfg)
        {
            _auth = auth;
            _tvp = tvp;
            _cfg = cfg;
        }

        // Helpers para construir URLs públicas detrás de Nginx
        private (string proto, string host) PublicOrigin()
        {
            var proto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault()
                        ?? Request.Scheme;
            var host = Request.Headers["X-Forwarded-Host"].FirstOrDefault()
                        ?? Request.Host.ToString();
            return (proto, host);
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            var response = await _auth.AuthenticateAsync(request);
            if (response is null) return Unauthorized("Usuario o contraseña inválidos");
            return Ok(response);
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            var result = await _auth.RegisterAsync(request);
            if (result is null) return BadRequest("El usuario ya existe o el rol no es válido");
            return Ok(new { message = result });
        }

        // ---- GitHub OAuth ----
        [AllowAnonymous]
        [HttpGet("github/login")]
        public IActionResult GitHubLogin()
        {
            // Construye explicitamente el RedirectUri público hacia tu propio callback
            var (proto, host) = PublicOrigin();
            var redirectUri = $"{proto}://{host}/api/auth/github/callback";

            var props = new AuthenticationProperties
            {
                RedirectUri = redirectUri
            };
            return Challenge(props, GitHubAuthenticationDefaults.AuthenticationScheme);
        }

        [AllowAnonymous]
        [HttpGet("github/callback")]
        public async Task<IActionResult> GitHubCallback()
        {
            var result = await HttpContext.AuthenticateAsync("External");
            if (!result.Succeeded || result.Principal is null)
                return Unauthorized("No se pudo autenticar con GitHub.");

            var p = result.Principal;
            var githubLogin =
                p.FindFirst("urn:github:login")?.Value ??
                p.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                p.Identity?.Name ??
                "github-user";

            var email =
                p.FindFirst("urn:github:email")?.Value ??
                p.FindFirst(ClaimTypes.Email)?.Value;

            var loginResponse = await _auth.AuthenticateWithGitHubAsync(githubLogin, email);

            await HttpContext.SignOutAsync("External");

            // Destino del frontend para recibir ?token=
            // 1) Usa Frontend:OAuthRedirect si está configurado
            // 2) Si no, cae al host público actual en /oauth/callback
            var target = _cfg["Frontend:OAuthRedirect"];
            if (string.IsNullOrWhiteSpace(target))
            {
                var (proto, host) = PublicOrigin();
                target = $"{proto}://{host}/oauth/callback";
            }

            // Envía el JWT al SPA
            var url = $"{target}?token={Uri.EscapeDataString(loginResponse.Token!)}";
            return Redirect(url);
        }

        // ========= /api/auth/validate para auth_request de Nginx =========
        [AllowAnonymous]
        [HttpGet("validate")]
        public IActionResult Validate(
            [FromHeader(Name = "Authorization")] string? authorization,
            [FromHeader(Name = "X-Required-Role")] string? requiredRole)
        {
            if (string.IsNullOrWhiteSpace(authorization) || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return Unauthorized();

            var token = authorization.Substring("Bearer ".Length).Trim();
            var handler = new JwtSecurityTokenHandler();

            try
            {
                var tvp = _tvp.Clone();
                var principal = handler.ValidateToken(token, tvp, out _);

                if (string.IsNullOrWhiteSpace(requiredRole) || requiredRole.Equals("Any", StringComparison.OrdinalIgnoreCase))
                    return Ok();

                var needed = requiredRole.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                                         .Select(r => r.Trim())
                                         .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var roles = principal.Claims
                    .Where(c => c.Type == ClaimTypes.Role || c.Type == "role")
                    .Select(c => c.Value)
                    .ToList();

                var rolesArrayClaim = principal.Claims.FirstOrDefault(c => c.Type == "roles")?.Value;
                if (!string.IsNullOrWhiteSpace(rolesArrayClaim))
                {
                    foreach (var r in rolesArrayClaim.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        roles.Add(r);
                }

                var hasAny = roles.Any(r => needed.Contains(r));
                return hasAny ? Ok() : Forbid();
            }
            catch
            {
                return Unauthorized();
            }
        }
    }
}
