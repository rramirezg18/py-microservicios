namespace AuthService.Application.Contracts.Auth
{
    public record RegisterRequest(string Email, string Password, string? Name);
}
