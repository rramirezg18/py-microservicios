namespace AuthService.Application.Contracts.Auth
{
    public record AuthResponse(string AccessToken, string RefreshToken);
}
