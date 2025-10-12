using System.Text;
using AuthService.Application.Abstractions;
using AuthService.Application.Options;
using AuthService.Infrastructure.Persistence;
using AuthService.Infrastructure.Persistence.Seed;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ===== Options (JWT) =====
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()!;
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key));

// ===== DbContext (MySQL con Pomelo) =====
var cs = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AuthDbContext>(opt =>
{
    opt.UseMySql(cs, ServerVersion.AutoDetect(cs));
    opt.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
});

// ===== Servicios (DI) =====
builder.Services.AddSingleton<PasswordHasher>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService.Infrastructure.Services.AuthService>();

builder.Services.AddControllers();

// ===== Auth: JWT Bearer =====
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.RequireHttpsMetadata = false;
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

// ===== Swagger =====
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo { Title = "Auth Service", Version = "v1" });
    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });
    opt.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ===== CORS dev =====
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("dev", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

// Migración/seed al arrancar
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<PasswordHasher>();
    await db.Database.MigrateAsync();
    await DbSeeder.RunAsync(db, hasher);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("dev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
