using Microsoft.AspNetCore.Mvc;
using AuthService.Models.Dtos;
using AuthService.Services.Interfaces;

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

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            var response = await _auth.AuthenticateAsync(request);
            if (response is null) return Unauthorized("Usuario o contraseña inválidos");
            return Ok(response);
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            var result = await _auth.RegisterAsync(request);
            if (result is null) return BadRequest("El usuario ya existe o el rol no es válido");
            return Ok(new { message = result });
        }
    }
}
