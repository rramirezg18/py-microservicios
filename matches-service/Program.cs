using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

using MatchesService.Data;
using MatchesService.Repositories;
using MatchesService.Services;
using MatchesService.Services.Runtime;
using MatchesService.Hubs;
using MatchesService.Http;
   // 👈 NUEVO: handler que reenvía Authorization

var builder = WebApplication.CreateBuilder(args);

// ==========================================================
// 🔧 CONFIGURACIÓN DE SERVICIOS
// ==========================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// DbContext (SQL Server)
builder.Services.AddDbContext<MatchesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// DI
builder.Services.AddScoped<IMatchRepository, MatchRepository>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddSingleton<IMatchRunTime, MatchRunTime>();

// SignalR
builder.Services.AddSignalR();

// =========  👇 NUEVO: HttpClient que reenvía Authorization al teams-service  =========
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<ForwardAuthHandler>();

builder.Services.AddHttpClient("Teams", (sp, http) =>
{
    // En docker-compose: TeamsService__BaseUrl: "http://teams-service:8082/api/teams"
    var cfg = sp.GetRequiredService<IConfiguration>();
    var baseUrl = cfg["TeamsService:BaseUrl"]
                  ?? throw new InvalidOperationException("TeamsService:BaseUrl no configurado");
    http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"); // => .../api/teams/
})
.AddHttpMessageHandler<ForwardAuthHandler>();



builder.Services.AddHttpContextAccessor();           // ✅
builder.Services.AddTransient<ForwardAuthHandler>(); // ✅

builder.Services.AddHttpClient("teams", (sp, client) =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var baseUrl = cfg["TeamsService:BaseUrl"] ?? "http://teams-service:8082/api/teams";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
})
.AddHttpMessageHandler<ForwardAuthHandler>();  

// (tu AddHttpClient() genérico puede quedarse; no estorba)
// builder.Services.AddHttpClient();

// ===========================
// ✅ AuthN/ AuthZ (JWT + roles)
// ===========================
var issuer   = builder.Configuration["Jwt:Issuer"]   ?? "auth-service";
var audience = builder.Configuration["Jwt:Audience"] ?? "py-microservices";
var keyRaw   = builder.Configuration["Jwt:Key"]      ?? "CHANGE_ME_DEV_SECRET_32_BYTES_MINIMUM";

if (Encoding.UTF8.GetBytes(keyRaw).Length < 32)
{
    // Evita arrancar con clave débil
    throw new InvalidOperationException("Jwt:Key debe tener al menos 32 bytes.");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyRaw));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = "role",
            NameClaimType = ClaimTypes.NameIdentifier
        };
        options.RequireHttpsMetadata = false; // en Docker dev
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin",   p => p.RequireRole("Admin"));
    options.AddPolicy("Control", p => p.RequireRole("Control"));
});

var app = builder.Build();

// ==========================================================
// 🗃️ APLICAR MIGRACIONES EN ARRANQUE
// ==========================================================
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MatchesDbContext>();
    db.Database.Migrate();
}

// ==========================================================
// 🌐 MIDDLEWARES
// ==========================================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// ==========================================================
// 🔌 ENDPOINTS Y HUBS
// ==========================================================
app.MapControllers();              // puedes añadir [Authorize(Policy="Control")] donde aplique
app.MapHub<ScoreHub>("/hub/score");

// Health
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();
