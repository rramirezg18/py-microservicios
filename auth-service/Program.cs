using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using AspNet.Security.OAuth.GitHub;
using Microsoft.AspNetCore.Http; // SameSiteMode
using Microsoft.Extensions.DependencyInjection; // Para CreateScope
using Microsoft.Extensions.Logging; // Para ILogger

using AuthService.Data;
using AuthService.Repositories.Interfaces;
using AuthService.Repositories;
using AuthService.Services.Interfaces;
using AuthService.Services;

var builder = WebApplication.CreateBuilder(args);

// (Opcional) Cargar user-secrets en Development
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>();
}

// Controllers + Swagger (con auth Bearer)
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    var jwtScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Bearer {token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    c.AddSecurityDefinition("Bearer", jwtScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { jwtScheme, Array.Empty<string>() }
    });
});

// DbContext
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// AUTH: JWT + Cookie externa + GitHub OAuth
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        var key = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key missing");
        if (Encoding.UTF8.GetBytes(key).Length < 32)
            throw new InvalidOperationException("Jwt:Key debe tener al menos 32 bytes (256 bits).");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ClockSkew = TimeSpan.Zero
        };
    })

    .AddCookie("External", cookie =>
    {
        cookie.Cookie.SameSite = SameSiteMode.Lax;                    
        cookie.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; 
        cookie.ExpireTimeSpan = TimeSpan.FromMinutes(10);
    })
    .AddGitHub(options =>
    {
        options.ClientId = builder.Configuration["Authentication:GitHub:ClientId"]!;
        options.ClientSecret = builder.Configuration["Authentication:GitHub:ClientSecret"]!;

        options.CallbackPath = "/signin-github";

        options.SignInScheme = "External";
        options.Scope.Add("user:email");
        options.SaveTokens = true;


        options.CorrelationCookie.SameSite = SameSiteMode.Lax;
        options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

builder.Services.AddAuthorization();

// CORS para tu frontend Angular
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("frontend", p =>
        p.WithOrigins(
            "http://localhost",           // Cambiar esto a http://localhost
            "http://127.0.0.1",           // Cambiar esto a http://127.0.0.1
            "http://proyecto"             // Agregar aquí la URL para proyecto
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
    );
});

// DI
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IMenuRepository, MenuRepository>();

builder.Services.AddScoped<IAuthService, AuthService.Services.AuthService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IMenuService, MenuService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        // Obtener el contexto de la base de datos
        var context = services.GetRequiredService<AppDbContext>();
        
        // Aplicar todas las migraciones pendientes
        // Esto crea la DB 'authDb' y sus tablas si no existen
        context.Database.Migrate(); 
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        // Esto registrará el error si la conexión o la migración fallan
        logger.LogError(ex, "An error occurred while migrating the database.");
    }
}



if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Mantén HTTP en dev para simplificar OAuth local
// app.UseHttpsRedirection();

app.UseCookiePolicy(new CookiePolicyOptions
{
    MinimumSameSitePolicy = SameSiteMode.Lax
});

app.UseCors("frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }