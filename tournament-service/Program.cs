// Program.cs
using Microsoft.EntityFrameworkCore;
using TournametsService.Data;
using TournametsService.Services;

var builder = WebApplication.CreateBuilder(args);

// Connection string (usa la del compose en contenedor; en host puedes usar 127.0.0.1)
var conn = builder.Configuration.GetConnectionString("DefaultConnection")
           ?? "Server=db,1433;Database=tournamentsDb;User Id=sa;Password=Spider12man3;TrustServerCertificate=True;Encrypt=False";

builder.Services.AddDbContext<TournametsDbContext>(opt =>
    opt.UseSqlServer(conn));

// Servicios de dominio
builder.Services.AddScoped<TournamentQueryService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.Run();
