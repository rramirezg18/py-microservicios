using System;
using System.Threading.Tasks;
using AuthService.Application.Abstractions;
using AuthService.Application.Contracts.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;

        public AuthController(IAuthService auth)
        {
            _auth = auth;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
        {
            try
            {
                var tokens = await _auth.RegisterAsync(req);
                return Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
        {
            try
            {
                var tokens = await _auth.LoginAsync(req);
                return Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
            }
            catch (Exception ex) { return Unauthorized(ex.Message); }
        }

        [HttpPost("google")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Google(GoogleLoginRequest req)
        {
            try
            {
                var tokens = await _auth.LoginWithGoogleAsync(req);
                return Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
            }
            catch (Exception ex) { return Unauthorized(ex.Message); }
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Refresh(RefreshTokenRequest req)
        {
            try
            {
                var tokens = await _auth.RefreshAsync(req);
                return Ok(new AuthResponse(tokens.AccessToken, tokens.RefreshToken));
            }
            catch (Exception ex) { return Unauthorized(ex.Message); }
        }
    }
}
