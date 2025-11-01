using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MatchesService.Data;              // DbContext
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
    /// <summary>
    /// Lógica de negocio de partidos. Integra teams-service vía HTTP.
    /// Emite eventos a SignalR para sincronizar Scoreboard/Control.
    /// </summary>
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

        // -------- Helpers --------
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
            catch { /* best-effort */ }

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
                    return (false, "dateMatch es obligatorio y debe venir en ISO 8601, ej: 2025-11-02T15:00:00", null);

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

        // ==================== CREAR RÁPIDO ====================
        public async Task<(bool Success, string? Error, object? Data)> NewGameAsync(NewGameDto dto)
        {
            var home = new { name = dto.HomeName };
            var away = new { name = dto.AwayName };

            var homeRes = await _http.PostAsJsonAsync(_teamsApiBase, home);
            var awayRes = await _http.PostAsJsonAsync(_teamsApiBase, away);

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
            var homeExists = await _http.GetAsync($"{_teamsApiBase}/{dto.HomeTeamId}");
            var awayExists = await _http.GetAsync($"{_teamsApiBase}/{dto.AwayTeamId}");
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

                var ev = new ScoreEvent
                {
                    MatchId = match.Id,
                    TeamId = dto.TeamId,
                    PlayerId = dto.PlayerId,
                    Points = dto.Points,
                    DateRegister = DateTime.UtcNow,
                    Note = null
                };

                await _repo.AddScoreEventAsync(ev);
                await _repo.UpdateAsync(match);
                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var payload = new
                {
                    matchId = match.Id,
                    homeScore = match.HomeScore,
                    awayScore = match.AwayScore
                };

                await BroadcastAsync(match.Id, "scoreUpdated", payload);
                return (true, null, payload);
            }
            catch (DbUpdateException ex)
            {
                await tx.RollbackAsync();
                return (false, ex.InnerException?.Message ?? ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Error, object? Data)> AdjustScoreAsync(int id, AdjustScoreDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            if (dto.TeamId != match.HomeTeamId && dto.TeamId != match.AwayTeamId)
                return (false, "El TeamId no pertenece a este partido", null);

            if (dto.Delta == 0)
            {
                await BroadcastAsync(id, "scoreUpdated", new { homeScore = match.HomeScore, awayScore = match.AwayScore });
                return (true, null, new { matchId = id, match.HomeScore, match.AwayScore });
            }

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                int remaining = dto.Delta;
                var now = DateTime.UtcNow;

                while (remaining != 0)
                {
                    int step = Math.Clamp(remaining, -3, 3);
                    if (dto.TeamId == match.HomeTeamId)
                        match.HomeScore = Math.Max(0, match.HomeScore + step);
                    else
                        match.AwayScore = Math.Max(0, match.AwayScore + step);

                    var ev = new ScoreEvent
                    {
                        MatchId = match.Id,
                        TeamId = dto.TeamId,
                        PlayerId = null,
                        Points = step,
                        Note = "adjust",
                        DateRegister = now
                    };
                    await _repo.AddScoreEventAsync(ev);
                    remaining -= step;
                }

                await _repo.UpdateAsync(match);
                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var payload = new { matchId = match.Id, homeScore = match.HomeScore, awayScore = match.AwayScore };
                await BroadcastAsync(match.Id, "scoreUpdated", payload);
                return (true, null, payload);
            }
            catch (DbUpdateException ex)
            {
                await tx.RollbackAsync();
                return (false, ex.InnerException?.Message ?? ex.Message, null);
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
                var foul = new Foul
                {
                    MatchId = match.Id,
                    TeamId = dto.TeamId,
                    PlayerId = dto.PlayerId,
                    Type = string.IsNullOrWhiteSpace(dto.Type) ? null : dto.Type!.Trim(),
                    DateRegister = DateTime.UtcNow
                };

                await _repo.AddFoulAsync(foul);
                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var homeFouls = await _repo.GetFoulCountAsync(match.Id, match.HomeTeamId);
                var awayFouls = await _repo.GetFoulCountAsync(match.Id, match.AwayTeamId);

                var payload = new { homeFouls, awayFouls };
                await BroadcastAsync(match.Id, "foulsUpdated", payload);

                return (true, null, new
                {
                    matchId = match.Id,
                    foul = new { foul.Id, foul.TeamId, foul.PlayerId, foul.Type, foul.DateRegister },
                    totals = new { homeTeamId = match.HomeTeamId, homeFouls, awayTeamId = match.AwayTeamId, awayFouls }
                });
            }
            catch (DbUpdateException ex)
            {
                await tx.RollbackAsync();
                return (false, ex.InnerException?.Message ?? ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Error, object? Data)> AdjustFoulAsync(int id, AdjustFoulDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            if (dto.TeamId != match.HomeTeamId && dto.TeamId != match.AwayTeamId)
                return (false, "El TeamId no pertenece a este partido", null);

            if (dto.Delta == 0)
            {
                var homeF = await _repo.GetFoulCountAsync(match.Id, match.HomeTeamId);
                var awayF = await _repo.GetFoulCountAsync(match.Id, match.AwayTeamId);
                var snap = new { homeFouls = homeF, awayFouls = awayF };
                await BroadcastAsync(match.Id, "foulsUpdated", snap);
                return (true, null, new { matchId = match.Id, totals = snap });
            }

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                if (dto.Delta > 0)
                {
                    var now = DateTime.UtcNow;
                    for (int i = 0; i < dto.Delta; i++)
                    {
                        var foul = new Foul
                        {
                            MatchId = match.Id,
                            TeamId = dto.TeamId,
                            PlayerId = null,
                            Type = "Adjust",
                            DateRegister = now
                        };
                        await _repo.AddFoulAsync(foul);
                    }
                }
                else
                {
                    await _repo.RemoveLastFoulsAsync(match.Id, dto.TeamId, Math.Abs(dto.Delta));
                }

                await _repo.SaveChangesAsync();
                await tx.CommitAsync();

                var homeFouls = await _repo.GetFoulCountAsync(match.Id, match.HomeTeamId);
                var awayFouls = await _repo.GetFoulCountAsync(match.Id, match.AwayTeamId);

                var payload = new { homeFouls, awayFouls };
                await BroadcastAsync(match.Id, "foulsUpdated", payload);

                return (true, null, new
                {
                    matchId = match.Id,
                    teamId = dto.TeamId,
                    totals = new { homeTeamId = match.HomeTeamId, homeFouls, awayTeamId = match.AwayTeamId, awayFouls }
                });
            }
            catch (DbUpdateException ex)
            {
                await tx.RollbackAsync();
                return (false, ex.InnerException?.Message ?? ex.Message, null);
            }
        }

        // ==================== TIMER / PERIODOS / FIN ====================
        public async Task<(bool Success, string? Error, object? Data)> StartTimerAsync(int id, StartTimerDto? dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            int seconds = 0;

            // Evita conversiones implícitas de int? → int
            if (dto is not null)
            {
                var q = dto.QuarterDurationSeconds;
                if (q.HasValue && q.Value > 0)
                {
                    seconds = q.Value;
                }
                else
                {
                    var s = dto.Seconds;
                    if (s.HasValue && s.Value > 0)
                        seconds = s.Value;
                }
            }

            if (seconds <= 0)
                seconds = match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 600;

            match.Status = "Live";
            if (match.QuarterDurationSeconds <= 0)
                match.QuarterDurationSeconds = seconds;

            await _repo.UpdateAsync(match);
            await _repo.SaveChangesAsync();

            _timers[id] = new TimerState
            {
                Running = true,
                StartedAtUtc = DateTime.UtcNow,
                RemainingSecondsAtStart = seconds
            };

            await BroadcastAsync(id, "timerStarted", new
            {
                quarterEndsAtUtc = DateTime.UtcNow.AddSeconds(seconds).ToString("o"),
                remainingSeconds = seconds
            });

            return (true, null, new
            {
                id = match.Id,
                status = match.Status,
                quarter = match.Period,
                homeScore = match.HomeScore,
                awayScore = match.AwayScore,
                timerRunning = true,
                timeRemaining = seconds,
                remainingSeconds = seconds
            });
        }


        public async Task<(bool Success, string? Error, object? Data)> PauseTimerAsync(int id)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            int secondsDefault = match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 600;

            var state = _timers.GetOrAdd(id, _ => new TimerState
            {
                Running = false,
                StartedAtUtc = DateTime.UtcNow,
                RemainingSecondsAtStart = secondsDefault
            });

            var remaining = CalcRemainingSeconds(state);
            state.Running = false;
            state.RemainingSecondsAtStart = remaining;
            state.StartedAtUtc = DateTime.UtcNow;

            await BroadcastAsync(id, "timerPaused", new { remainingSeconds = remaining });

            return (true, null, new
            {
                id = match.Id,
                status = match.Status,
                quarter = match.Period,
                homeScore = match.HomeScore,
                awayScore = match.AwayScore,
                timerRunning = false,
                timeRemaining = remaining,
                remainingSeconds = remaining
            });
        }

        public async Task<(bool Success, string? Error, object? Data)> ResumeTimerAsync(int id)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            int defaultSeconds = match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 600;

            var state = _timers.AddOrUpdate(
                id,
                _ => new TimerState
                {
                    Running = true,
                    StartedAtUtc = DateTime.UtcNow,
                    RemainingSecondsAtStart = defaultSeconds
                },
                (_, s) =>
                {
                    var remaining = CalcRemainingSeconds(s);
                    s.Running = true;
                    s.StartedAtUtc = DateTime.UtcNow;
                    s.RemainingSecondsAtStart = remaining <= 0 ? defaultSeconds : remaining;
                    return s;
                });

            var nowRemaining = CalcRemainingSeconds(state);

            await BroadcastAsync(id, "timerResumed", new
            {
                quarterEndsAtUtc = DateTime.UtcNow.AddSeconds(nowRemaining).ToString("o"),
                remainingSeconds = nowRemaining
            });

            return (true, null, new
            {
                id = match.Id,
                status = match.Status,
                quarter = match.Period,
                homeScore = match.HomeScore,
                awayScore = match.AwayScore,
                timerRunning = true,
                timeRemaining = nowRemaining,
                remainingSeconds = nowRemaining
            });
        }

        public async Task<(bool Success, string? Error, object? Data)> ResetTimerAsync(int id)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null);

            int seconds = match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 600;

            _timers[id] = new TimerState
            {
                Running = false,
                StartedAtUtc = DateTime.UtcNow,
                RemainingSecondsAtStart = seconds
            };

            await BroadcastAsync(id, "timerReset", new { remainingSeconds = seconds });

            return (true, null, new
            {
                id = match.Id,
                status = match.Status,
                quarter = match.Period,
                homeScore = match.HomeScore,
                awayScore = match.AwayScore,
                timerRunning = false,
                timeRemaining = seconds,
                remainingSeconds = seconds
            });
        }

        public async Task<(bool Success, string? Error, object? Data, object? GameEnded)> AdvanceQuarterAsync(int id)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null, null);

            if (match.Period < 4) match.Period++;
            await _repo.UpdateAsync(match);
            await _repo.SaveChangesAsync();

            int seconds = match.QuarterDurationSeconds > 0 ? match.QuarterDurationSeconds : 600;
            _timers[id] = new TimerState
            {
                Running = false,
                StartedAtUtc = DateTime.UtcNow,
                RemainingSecondsAtStart = seconds
            };

            await BroadcastAsync(id, "buzzer", new { });
            await BroadcastAsync(id, "quarterChanged", new { quarter = match.Period });
            await BroadcastAsync(id, "timerReset", new { remainingSeconds = seconds });

            var payload = new
            {
                id = match.Id,
                status = match.Status,
                quarter = match.Period,
                homeScore = match.HomeScore,
                awayScore = match.AwayScore,
                timerRunning = false,
                timeRemaining = seconds
            };

            return (true, null, payload, null);
        }

        public Task<(bool Success, string? Error, object? Data, object? GameEnded)> AutoAdvanceQuarterAsync(int id)
            => AdvanceQuarterAsync(id);

        public async Task<(bool Success, string? Error, object? Data, object? GameEnded)> FinishAsync(int id, FinishMatchDto dto)
        {
            var match = await _repo.GetByIdAsync(id);
            if (match is null) return (false, "Partido no encontrado", null, null);

            if (match.Status is "Finished" or "Canceled" or "Suspended")
                return (false, $"No se puede finalizar un partido en estado '{match.Status}'", null, null);

            if (dto.HomeScore < 0 || dto.AwayScore < 0)
                return (false, "Los puntajes no pueden ser negativos", null, null);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                if (dto.ScoreEvents is not null)
                {
                    foreach (var ev in dto.ScoreEvents)
                    {
                        if (ev.TeamId != match.HomeTeamId && ev.TeamId != match.AwayTeamId) continue;

                        _db.ScoreEvents.Add(new ScoreEvent
                        {
                            MatchId = match.Id,
                            TeamId = ev.TeamId,
                            PlayerId = ev.PlayerId,
                            Points = ev.Points,
                            DateRegister = ev.DateRegister
                        });
                    }
                }

                if (dto.Fouls is not null)
                {
                    foreach (var f in dto.Fouls)
                    {
                        if (f.TeamId != match.HomeTeamId && f.TeamId != match.AwayTeamId) continue;

                        _db.Fouls.Add(new Foul
                        {
                            MatchId = match.Id,
                            TeamId = f.TeamId,
                            PlayerId = f.PlayerId,
                            Type = null,
                            DateRegister = f.DateRegister
                        });
                    }
                }

                match.HomeScore = dto.HomeScore;
                match.AwayScore = dto.AwayScore;
                match.Status = "Finished";

                await _repo.UpdateAsync(match);
                await _repo.SaveChangesAsync();

                int? winnerTeamId = null;
                if (match.HomeScore > match.AwayScore) winnerTeamId = match.HomeTeamId;
                else if (match.AwayScore > match.HomeScore) winnerTeamId = match.AwayTeamId;

                if (winnerTeamId.HasValue)
                {
                    _db.TeamWins.Add(new TeamWin
                    {
                        MatchId = match.Id,
                        TeamId = winnerTeamId.Value,
                        DateRegistered = DateTime.UtcNow
                    });
                    await _db.SaveChangesAsync();
                }

                await tx.CommitAsync();

                var payload = new
                {
                    id = match.Id,
                    status = match.Status,
                    homeScore = match.HomeScore,
                    awayScore = match.AwayScore,
                    winnerTeamId = winnerTeamId
                };

                var winner =
                    match.HomeScore == match.AwayScore ? "draw" :
                    (match.HomeScore > match.AwayScore ? "home" : "away");

                await BroadcastAsync(match.Id, "gameEnded", new { home = match.HomeScore, away = match.AwayScore, winner });

                return (true, null, payload, payload);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return (false, ex.Message, null, null);
            }
        }

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
