namespace AuthService.Application.Options
{
    public class JwtOptions
    {
        public string Key { get; set; } = "super-secret-key-change-me";
        public string Issuer { get; set; } = "auth-service";
        public string Audience { get; set; } = "scoreboard-app";
        public int AccessTokenMinutes { get; set; } = 60;
        public int RefreshTokenDays { get; set; } = 30;
    }
}
