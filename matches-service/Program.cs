using Microsoft.EntityFrameworkCore;
using MatchesService.Data;
using MatchesService.Repositories;
using MatchesService.Services;
using MatchesService.Services.Runtime;
using MatchesService.Hubs;

var builder = WebApplication.CreateBuilder(args);

// ==========================================================
// 🔧 CONFIGURACIÓN DE SERVICIOS
// ==========================================================

// 1️⃣ Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2️⃣ Controladores + JSON
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
    });

// 3️⃣ CORS (permitir peticiones desde tu frontend Angular/React)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// 4️⃣ DbContext (base de datos de Matches)
builder.Services.AddDbContext<MatchesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 5️⃣ Inyección de dependencias (Repository / Service / Runtime)
builder.Services.AddScoped<IMatchRepository, MatchRepository>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddSingleton<IMatchRunTime, MatchRunTime>();

// 6️⃣ SignalR (para comunicación en tiempo real)
builder.Services.AddSignalR();

// 7️⃣ HttpClient para llamadas a otros microservicios (teams-service)
builder.Services.AddHttpClient();

// ==========================================================
// 🚀 CONSTRUCCIÓN DE LA APLICACIÓN
// ==========================================================
var app = builder.Build();

// 1️⃣ Middleware: Swagger
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 2️⃣ Middleware: HTTPS + CORS
app.UseHttpsRedirection();
app.UseCors("AllowAll");

// 3️⃣ Middleware: Autenticación / Autorización (si se usa JWT o Roles)
app.UseAuthentication();
app.UseAuthorization();

// ==========================================================
// 🔌 ENDPOINTS Y HUBS
// ==========================================================

// Controladores API REST
app.MapControllers();

// Hub de SignalR para actualizaciones en vivo
app.MapHub<ScoreHub>("/hub/score");

// ==========================================================
// 🟢 INICIO DE LA APLICACIÓN
// ==========================================================
app.Run();
