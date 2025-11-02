using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MatchesService.Data;
using MatchesService.Hubs;
using MatchesService.Models;
using MatchesService.Models.DTOs;
using MatchesService.Repositories;
using MatchesService.Services.Runtime;
using Newtonsoft.Json.Linq;
using System.Net.Http.Json;
using System.Collections.Concurrent;

namespace MatchesService.Services
{
    public class MatchService : IMatchService
    {
        private readonly IMatchRepository _repo;
        private readonly IMatchRunTime _runTime;
        private readonly IHubContext<ScoreHub> _hub;
        private readonly HttpClient _http;
        private readonly string _teamsApiBase;
        private readonly MatchesDbContext _db;

        private static readonly ConcurrentDictionary<int, TimerState> _timers = new();

        public MatchService(
            IMatchRepository repo,
            IMatchRunTime runTime,
            IHubContext<ScoreHub> hub,
            IHttpClientFactory httpFactory,
            IConfiguration config,
            MatchesDbContext db)
        {
            _repo = repo;
            _runTime = runTime;
            _hub = hub;
            _http = httpFactory.CreateClient("teams");
            _db = db;

            _teamsApiBase = (config["TeamsService:BaseUrl"] ?? "http://teams-service:8082/api/teams").TrimEnd('/');
            if (!_teamsApiBase.EndsWith("/teams", StringComparison.OrdinalIgnoreCase))
                _teamsApiBase += "/teams";
        }

        private Task BroadcastAsync(int matchId, string method, object payload)
            => _hub.Clients.Group(ScoreHub.GroupName(matchId)).SendAsync(method, payload);

        private static int CalcRemainingSeconds(TimerState s)
        {
            if (!s.Running) return Math.Max(0, s.RemainingSecondsAtStart);
            var elapsed = (int)Math.Floor((DateTime.UtcNow - s.StartedAtUtc).TotalSeconds);
            return Math.Max(0, s.RemainingSecondsAtStart - elapsed);
        }

        private sealed class TimerState
        {
            public bool Running { get; set; }
            public DateTime StartedAtUtc { get; set; }
            public int RemainingSecondsAtStart { get; set; }
        }

        // ==================== CONSULTAS ====================
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

            JObject? homeTeam = null;
            JObject? awayTeam = null;

            try
            {
                var homeResp = await _http.GetAsync($"{_teamsApiBase}/{match.HomeTeamId}");
                if (homeResp.IsSuccessStatusCode)
                    homeTeam = JObject.Parse(await homeResp.Content.ReadAsStringAsync());

                var awayResp = await _http.GetAsync($"{_teamsApiBase}/{match.AwayTeamId}");
                if (awayResp.IsSuccessStatusCode)
                    awayTeam = JObject.Parse(await awayResp.Content.ReadAsStringAsync());
            }
            catch { }

            var state = _timers.TryGetValue(id, out var ts) ? ts : null;
            var remaining = state is null
                ? (match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 0)
                : CalcRemainingSeconds(state);

            return new
            {
                match.Id,
                match.Status,
                match.DateMatch,
                match.HomeTeamId,
                match.AwayTeamId,
                match.HomeScore,
                match.AwayScore,
                Period = match.Period,
                HomeTeam = homeTeam,
                AwayTeam = awayTeam,
                timer = new
                {
                    running = state?.Running ?? false,
                    remainingSeconds = remaining,
                    quarter = match.Period,
                    quarterEndsAtUtc = (state is not null && state.Running)
                        ? DateTime.UtcNow.AddSeconds(remaining).ToString("o")
                        : null
                }
            };
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

        // ==================== PROGRAMAR / REPROGRAMAR ====================
        public async Task<(bool Success, string? Error, object? Data)> ProgramarAsync(ProgramarPartidoDto dto)
        {
            try
            {
                var homeExists = await _http.GetAsync($"{_teamsApiBase}/{dto.HomeTeamId}");
                var awayExists = await _http.GetAsync($"{_teamsApiBase}/{dto.AwayTeamId}");
                if (!homeExists.IsSuccessStatusCode || !awayExists.IsSuccessStatusCode)
                    return (false, "Uno o ambos equipos no existen en teams-service", null);

                if (dto.DateMatch.Year < 2000)
                    return (false, "dateMatch es obligatorio", null);

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

        // ==================== SCORE ====================
        public async Task<(bool Success, string? Error, object? Data)> AddScoreAsync(int id, AddScoreDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);
            if (dto.TeamId != match.HomeTeamId && dto.TeamId != match.AwayTeamId)
                return (false, "El TeamId no pertenece a este partido", null);
            if (dto.Points < -3 || dto.Points > 3)
                return (false, "Points debe estar entre -3 y 3", null);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                if (dto.TeamId == match.HomeTeamId)
                    match.HomeScore = Math.Max(0, match.HomeScore + dto.Points);
                else
                    match.AwayScore = Math.Max(0, match.AwayScore + dto.Points);

                await _repo.AddScoreEventAsync(new ScoreEvent
                {
                    MatchId = match.Id,
                    TeamId = dto.TeamId,
                    PlayerId = dto.PlayerId,
                    Points = dto.Points,
                    DateRegister = DateTime.UtcNow
                });

                await _repo.UpdateAsync(match);
                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var payload = new { match.Id, match.HomeScore, match.AwayScore };
                await BroadcastAsync(match.Id, "scoreUpdated", payload);
                return (true, null, payload);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return (false, ex.Message, null);
            }
        }

        // ==================== FOULS ====================
        public async Task<(bool Success, string? Error, object? Data)> AddFoulAsync(int id, AddFoulDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);
            if (dto.TeamId != match.HomeTeamId && dto.TeamId != match.AwayTeamId)
                return (false, "El TeamId no pertenece a este partido", null);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                await _repo.AddFoulAsync(new Foul
                {
                    MatchId = match.Id,
                    TeamId = dto.TeamId,
                    PlayerId = dto.PlayerId,
                    Type = dto.Type,
                    DateRegister = DateTime.UtcNow
                });

                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var foulsHome = await _repo.GetFoulCountAsync(match.Id, match.HomeTeamId);
                var foulsAway = await _repo.GetFoulCountAsync(match.Id, match.AwayTeamId);

                var payload = new { foulsHome, foulsAway };
                await BroadcastAsync(match.Id, "foulsUpdated", payload);
                return (true, null, payload);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return (false, ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Error, object? Data)> AdjustFoulAsync(int id, AdjustFoulDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);
            if (dto.TeamId != match.HomeTeamId && dto.TeamId != match.AwayTeamId)
                return (false, "El TeamId no pertenece a este partido", null);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                if (dto.Delta > 0)
                {
                    var now = DateTime.UtcNow;
                    for (int i = 0; i < dto.Delta; i++)
                    {
                        await _repo.AddFoulAsync(new Foul
                        {
                            MatchId = match.Id,
                            TeamId = dto.TeamId,
                            PlayerId = null,
                            Type = "Adjust",
                            DateRegister = now
                        });
                    }
                }
                else if (dto.Delta < 0)
                {
                    await _repo.RemoveLastFoulsAsync(match.Id, dto.TeamId, Math.Abs(dto.Delta));
                }

                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var foulsHome = await _repo.GetFoulCountAsync(match.Id, match.HomeTeamId);
                var foulsAway = await _repo.GetFoulCountAsync(match.Id, match.AwayTeamId);

                var payload = new { foulsHome, foulsAway };
                await BroadcastAsync(match.Id, "foulsUpdated", payload);
                return (true, null, payload);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return (false, ex.Message, null);
            }
        }

        // ==================== TIMER ====================
        public async Task<(bool Success, string? Error, object? Data)> StartTimerAsync(int id, StartTimerDto? dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            int seconds = dto?.Seconds ?? match.QuarterDurationSeconds;
            if (seconds <= 0) seconds = 600;

            _timers[id] = new TimerState
            {
                Running = true,
                StartedAtUtc = DateTime.UtcNow,
                RemainingSecondsAtStart = seconds
            };

            await BroadcastAsync(id, "timerStarted", new
            {
                remainingSeconds = seconds,
                quarterEndsAtUtc = DateTime.UtcNow.AddSeconds(seconds).ToString("o")
            });

            return (true, null, new { match.Id, timerRunning = true, seconds });
        }

        public Task<(bool Success, string? Error, object? Data)> PauseTimerAsync(int id)
        {
            if (!_timers.TryGetValue(id, out var s)) return Task.FromResult<(bool, string?, object?)>((false, "No activo", null));
            var rem = CalcRemainingSeconds(s);
            s.Running = false;
            s.RemainingSecondsAtStart = rem;
            return Task.FromResult<(bool, string?, object?)>((true, null, new { remaining = rem }));
        }

        public Task<(bool Success, string? Error, object? Data)> ResumeTimerAsync(int id)
        {
            if (!_timers.TryGetValue(id, out var s)) return Task.FromResult<(bool, string?, object?)>((false, "No activo", null));
            s.Running = true;
            s.StartedAtUtc = DateTime.UtcNow;
            return Task.FromResult<(bool, string?, object?)>((true, null, new { remaining = CalcRemainingSeconds(s) }));
        }

        public Task<(bool Success, string? Error, object? Data)> ResetTimerAsync(int id)
        {
            _timers.TryRemove(id, out _);
            return Task.FromResult<(bool, string?, object?)>((true, null, new { remaining = 0 }));
        }

        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> AdvanceQuarterAsync(int id)
        {
            _timers.TryRemove(id, out _);
            return Task.FromResult<(bool, string?, object?, object?)>((true, null, new { quarter = "next" }, null));
        }

        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> AutoAdvanceQuarterAsync(int id)
            => AdvanceQuarterAsync(id);

        // ==================== FIN / CANCELAR ====================
        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> FinishAsync(int id, FinishMatchDto dto)
            => Task.FromResult<(bool, string?, object?, object?)>((true, null, dto, dto));

        public Task<(bool Success, string? Error, object? Data)> CancelAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));

        public Task<(bool Success, string? Error, object? Data)> SuspendAsync(int id)
            => Task.FromResult<(bool, string?, object?)>((true, null, null));
    }

    public class TeamResponse
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Color { get; set; }
        public string? Coach { get; set; }
        public string? City { get; set; }
    }
}
