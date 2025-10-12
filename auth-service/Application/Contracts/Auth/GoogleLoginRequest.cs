namespace AuthService.Application.Contracts.Auth
{
    // IdToken (credential) devuelto por Google One-Tap o GSI
    public record GoogleLoginRequest(string IdToken);
}
