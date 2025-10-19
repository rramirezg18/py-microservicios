using AuthService.Models.Dtos;
namespace AuthService.Services.Interfaces
{


    public interface IAuthService
    {
        Task<LoginResponseDto?> AuthenticateAsync(LoginRequestDto request);
        Task<string?> RegisterAsync(RegisterRequestDto request);
    }
}
