using Microsoft.EntityFrameworkCore;
using TournametsService.Data;
using TournametsService.Services;

var builder = WebApplication.CreateBuilder(args);

// ===============================
// 1. Connection String
// ===============================
var conn = builder.Configuration.GetConnectionString("DefaultConnection")
           ?? "Server=db,1433;Database=tournamentsDb;User Id=sa;Password=Spider12man3;TrustServerCertificate=True;Encrypt=False;MultipleActiveResultSets=true";

// ===============================
// 2. DbContext + resiliencia
// ===============================
builder.Services.AddDbContext<TournametsDbContext>(opt =>
    opt.UseSqlServer(conn, sql =>
    {
        sql.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null);
    })
);

// ===============================
// 3. Servicios
// ===============================
builder.Services.AddScoped<TournamentQueryService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ===============================
// 4. Migraciones automáticas
// ===============================
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TournametsDbContext>();
    try
    {
        Console.WriteLine("Applying pending migrations...");
        db.Database.Migrate();
        Console.WriteLine("Migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠️ Migration error: {ex.Message}");
    }
}

// ===============================
// 5. Middleware
// ===============================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// ===============================
// 6. Run app
// ===============================
app.Run();
