using System.Threading.Tasks;
using AuthService.Application.Contracts.Auth;

namespace AuthService.Application.Abstractions
{
    public interface IAuthService
    {
        Task<AuthTokensDto> RegisterAsync(RegisterRequest request);
        Task<AuthTokensDto> LoginAsync(LoginRequest request);
        Task<AuthTokensDto> LoginWithGoogleAsync(GoogleLoginRequest request);
        Task<AuthTokensDto> RefreshAsync(RefreshTokenRequest request);
    }
}
