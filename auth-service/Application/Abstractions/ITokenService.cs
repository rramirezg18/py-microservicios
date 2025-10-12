using System;

namespace AuthService.Application.Abstractions
{
    public interface ITokenService
    {
        string GenerateAccessToken(Guid userId, string email, string role);
        string GenerateRefreshToken();
    }
}
