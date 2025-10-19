using Microsoft.AspNetCore.SignalR;
using MatchesService.Hubs;
using MatchesService.Models.DTOs;
using MatchesService.Models;
using MatchesService.Repositories;
using MatchesService.Services.Runtime;
using System.Net.Http.Json;
using System.Text.Json;

namespace MatchesService.Services
{
    /// <summary>
    /// Implementa la lógica de negocio principal de los partidos (Matches).
    /// Versión adaptada a microservicios, integrando el teams-service vía HTTP.
    /// </summary>
    public class MatchService : IMatchService
    {
        private readonly IMatchRepository _repo;
        private readonly IMatchRunTime _runTime;
        private readonly IHubContext<ScoreHub> _hub;
        private readonly HttpClient _http;

        // URL base del microservicio de equipos
        private const string TeamsApiBase = "http://teams-service:8080/api/teams";

        public MatchService(IMatchRepository repo, IMatchRunTime runTime, IHubContext<ScoreHub> hub, IHttpClientFactory httpFactory)
        {
            _repo = repo;
            _runTime = runTime;
            _hub = hub;
            _http = httpFactory.CreateClient();
        }

        // ==========================================================
        // 📋 CONSULTAS GENERALES
        // ==========================================================
        public async Task<object> ListarAsync(int page, int pageSize, string? status, int? teamId, DateTime? from, DateTime? to)
        {
            var items = await _repo.GetAllAsync(page, pageSize, status, teamId, from, to);
            var total = await _repo.CountAsync(status, teamId, from, to);
            return new { Total = total, Data = items };
        }

        public async Task<object?> GetMatchAsync(int id)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match == null) return null;

            // 🔹 Enriquecer con info de equipos desde el microservicio externo
            var homeTeam = await _http.GetStringAsync($"{TeamsApiBase}/{match.HomeTeamId}");
            var awayTeam = await _http.GetStringAsync($"{TeamsApiBase}/{match.AwayTeamId}");

            var enriched = new
            {
                match.Id,
                match.Status,
                match.DateMatch,
                match.HomeTeamId,
                match.AwayTeamId,
                match.HomeScore,
                match.AwayScore,
                match.Period,
                HomeTeam = JsonSerializer.Deserialize<object>(homeTeam),
                AwayTeam = JsonSerializer.Deserialize<object>(awayTeam)
            };

            return enriched;
        }

        public async Task<object> ProximosAsync()
        {
            var data = await _repo.GetUpcomingAsync();
            return new { Data = data };
        }

        public async Task<(bool Success, string? Error, object? Data)> RangoAsync(DateTime from, DateTime to)
        {
            var data = await _repo.GetByRangeAsync(from, to);
            return (true, null, data);
        }

        // ==========================================================
        // 🏀 PROGRAMAR / REPROGRAMAR
        // ==========================================================
        public async Task<(bool Success, string? Error, object? Data)> ProgramarAsync(ProgramarPartidoDto dto)
        {
            try
            {
                // 🔹 Verificar si los equipos existen en teams-service
                var homeExists = await _http.GetAsync($"{TeamsApiBase}/{dto.HomeTeamId}");
                var awayExists = await _http.GetAsync($"{TeamsApiBase}/{dto.AwayTeamId}");

                if (!homeExists.IsSuccessStatusCode || !awayExists.IsSuccessStatusCode)
                    return (false, "Uno o ambos equipos no existen en teams-service", null);

                var match = new Match
                {
                    HomeTeamId = dto.HomeTeamId,
                    AwayTeamId = dto.AwayTeamId,
                    DateMatch = dto.DateMatch,
                    QuarterDurationSeconds = dto.QuarterDurationSeconds ?? 600,
                    Status = "Scheduled"
                };

                await _repo.AddAsync(match);
                await _repo.SaveChangesAsync();

                return (true, null, match);
            }
            catch (Exception ex)
            {
                return (false, ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Error, object? Data)> ReprogramarAsync(int id, ReprogramarDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match == null) return (false, "Partido no encontrado", null);

            match.DateMatch = dto.NewDate;
            match.Status = "Rescheduled";

            await _repo.UpdateAsync(match);
            await _repo.SaveChangesAsync();

            return (true, null, match);
        }

        // ==========================================================
        // ⚙️ CREAR PARTIDO RÁPIDO
        // ==========================================================
        public async Task<(bool Success, string? Error, object? Data)> NewGameAsync(NewGameDto dto)
        {
            // 🔹 Crear equipos directamente en teams-service
            var home = new { Name = dto.HomeName };
            var away = new { Name = dto.AwayName };

            var homeRes = await _http.PostAsJsonAsync(TeamsApiBase, home);
            var awayRes = await _http.PostAsJsonAsync(TeamsApiBase, away);

            if (!homeRes.IsSuccessStatusCode || !awayRes.IsSuccessStatusCode)
                return (false, "Error creando equipos en teams-service", null);

            var homeTeam = await homeRes.Content.ReadFromJsonAsync<TeamResponse>();
            var awayTeam = await awayRes.Content.ReadFromJsonAsync<TeamResponse>();

            var match = new Match
            {
                HomeTeamId = homeTeam!.Id,
                AwayTeamId = awayTeam!.Id,
                QuarterDurationSeconds = dto.QuarterDurationSeconds ?? 600,
                Status = "Scheduled"
            };

            await _repo.AddAsync(match);
            await _repo.SaveChangesAsync();
            return (true, null, match);
        }

        public async Task<(bool Success, string? Error, object? Data)> NewByTeamsAsync(NewGameByTeamsDto dto)
        {
            // Validar que ambos equipos existan
            var homeExists = await _http.GetAsync($"{TeamsApiBase}/{dto.HomeTeamId}");
            var awayExists = await _http.GetAsync($"{TeamsApiBase}/{dto.AwayTeamId}");

            if (!homeExists.IsSuccessStatusCode || !awayExists.IsSuccessStatusCode)
                return (false, "Uno o ambos equipos no existen en teams-service", null);

            var match = new Match
            {
                HomeTeamId = dto.HomeTeamId,
                AwayTeamId = dto.AwayTeamId,
                QuarterDurationSeconds = dto.QuarterDurationSeconds ?? 600,
                Status = "Scheduled"
            };

            await _repo.AddAsync(match);
            await _repo.SaveChangesAsync();
            return (true, null, match);
        }

        // ==========================================================
        // 🎯 EVENTOS DEL PARTIDO (STUBS TEMPORALES)
        // ==========================================================
        public Task<(bool Success, string? Error, object? Data)> AddScoreAsync(int id, AddScoreDto dto)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> AdjustScoreAsync(int id, AdjustScoreDto dto)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> AddFoulAsync(int id, AddFoulDto dto)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> AdjustFoulAsync(int id, AdjustFoulDto dto)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        // ==========================================================
        // ⏱️ CONTROL DE TIEMPO (STUBS TEMPORALES)
        // ==========================================================
        public Task<(bool Success, string? Error, object? Data)> StartTimerAsync(int id, StartTimerDto? dto)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> PauseTimerAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> ResumeTimerAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> ResetTimerAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        // ==========================================================
        // ⏭️ PERIODOS Y FINALIZACIÓN (STUBS TEMPORALES)
        // ==========================================================
        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> AdvanceQuarterAsync(int id)
            => Task.FromResult<(bool, string?, object?, object?)>((true, null, null, null));

        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> AutoAdvanceQuarterAsync(int id)
            => Task.FromResult<(bool, string?, object?, object?)>((true, null, null, null));

        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> FinishAsync(int id, FinishMatchDto dto)
            => Task.FromResult<(bool, string?, object?, object?)>((true, null, null, null));

        // ==========================================================
        // 🚫 CANCELAR / SUSPENDER (STUBS TEMPORALES)
        // ==========================================================
        public Task<(bool Success, string? Error, object? Data)> CancelAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> SuspendAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));
    }

    // 🔹 Helper DTO temporal para leer respuestas del teams-service
    public class TeamResponse
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Color { get; set; }
    }
}
