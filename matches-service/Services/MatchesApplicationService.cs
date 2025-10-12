using Microsoft.EntityFrameworkCore;
using MatchesService.Clients;
using MatchesService.Infrastructure;
using MatchesService.Models.DTOs;
using MatchesService.Models.Entities;
using MatchesService.Models.Enums;

namespace MatchesService.Services;

public class MatchesApplicationService
{
    private readonly MatchesDbContext _db;
    private readonly IMatchRuntime _runtime;
    private readonly TeamsClient _teamsClient;
    private readonly PlayersClient _playersClient;
    private readonly ILogger<MatchesApplicationService> _logger;

    public MatchesApplicationService(
        MatchesDbContext db,
        IMatchRuntime runtime,
        TeamsClient teamsClient,
        PlayersClient playersClient,
        ILogger<MatchesApplicationService> logger)
    {
        _db = db;
        _runtime = runtime;
        _teamsClient = teamsClient;
        _playersClient = playersClient;
        _logger = logger;
    }

    public async Task<MatchListResponse> ListAsync(
        int page,
        int pageSize,
        string? status,
        long? teamId,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        if (page <= 0)
        {
            page = 1;
        }

        if (pageSize is <= 0 or > 200)
        {
            pageSize = 20;
        }

        var query = _db.Matches.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<MatchStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(m => m.Status == parsedStatus);
        }

        if (teamId.HasValue && teamId.Value > 0)
        {
            query = query.Where(m => m.HomeTeamId == teamId.Value || m.AwayTeamId == teamId.Value);
        }

        if (fromUtc.HasValue)
        {
            query = query.Where(m => m.DateMatchUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(m => m.DateMatchUtc <= toUtc.Value);
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(m => m.DateMatchUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => MatchDtoMapper.ToListItem(m))
            .ToListAsync(cancellationToken);

        return new MatchListResponse(items, total, page, pageSize);
    }

    public async Task<IReadOnlyList<MatchListItem>> UpcomingAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return await _db.Matches.AsNoTracking()
            .Where(m => m.Status == MatchStatus.Scheduled && m.DateMatchUtc >= now)
            .OrderBy(m => m.DateMatchUtc)
            .Select(m => MatchDtoMapper.ToListItem(m))
            .ToListAsync(cancellationToken);
    }

    public async Task<MatchDetail?> GetAsync(int id, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        var timer = _runtime.GetOrCreate(match.Id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail> ProgramAsync(ProgramMatchRequest request, CancellationToken cancellationToken)
    {
        if (request.HomeTeamId <= 0 || request.AwayTeamId <= 0 || request.HomeTeamId == request.AwayTeamId)
        {
            throw new InvalidOperationException("Selecciona equipos válidos y distintos.");
        }

        var homeTeam = await _teamsClient.GetTeamAsync(request.HomeTeamId, cancellationToken);
        var awayTeam = await _teamsClient.GetTeamAsync(request.AwayTeamId, cancellationToken);

        if (homeTeam is null || awayTeam is null)
        {
            _logger.LogWarning(
                "Attempted to schedule match with invalid teams {HomeTeamId} vs {AwayTeamId}",
                request.HomeTeamId,
                request.AwayTeamId);
            throw new InvalidOperationException("Equipo inválido.");
        }

        var duration = request.QuarterDurationSeconds is > 0 ? request.QuarterDurationSeconds.Value : 600;
        var whenUtc = DateTime.SpecifyKind(request.DateMatchUtc, DateTimeKind.Utc);

        var match = new Match
        {
            HomeTeamId = homeTeam.Id,
            HomeTeamName = homeTeam.Name,
            AwayTeamId = awayTeam.Id,
            AwayTeamName = awayTeam.Name,
            Status = MatchStatus.Scheduled,
            QuarterDurationSeconds = duration,
            HomeScore = 0,
            AwayScore = 0,
            HomeFouls = 0,
            AwayFouls = 0,
            Period = 1,
            DateMatchUtc = whenUtc,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _db.Matches.Add(match);
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(match.Id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> ReprogramAsync(int id, ReprogramMatchRequest request, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (match.Status is MatchStatus.Live or MatchStatus.Finished)
        {
            throw new InvalidOperationException("No se puede reprogramar un partido en vivo o finalizado.");
        }

        var newDate = DateTime.SpecifyKind(request.NewDateMatchUtc, DateTimeKind.Utc);
        if (newDate < DateTime.UtcNow.AddMinutes(-1))
        {
            throw new InvalidOperationException("La nueva fecha (UTC) debe ser futura.");
        }

        match.DateMatchUtc = newDate;
        match.Status = MatchStatus.Scheduled;
        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        _runtime.Reset(id);
        var timer = _runtime.GetOrCreate(match.Id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchTimerDto?> StartTimerAsync(int id, StartTimerRequest request, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (request.QuarterDurationSeconds is > 0)
        {
            match.QuarterDurationSeconds = request.QuarterDurationSeconds.Value;
        }

        match.Status = MatchStatus.Live;
        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var snapshot = _runtime.Start(id, match.QuarterDurationSeconds);
        return ToTimer(snapshot);
    }

    public async Task<int?> PauseTimerAsync(int id, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        return _runtime.Pause(id);
    }

    public async Task<MatchTimerDto?> ResumeTimerAsync(int id, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        var snapshot = _runtime.Resume(id);
        return ToTimer(snapshot);
    }

    public async Task<MatchTimerDto?> ResetTimerAsync(int id, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        _runtime.Reset(id);
        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var snapshot = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToTimer(snapshot);
    }

    public async Task<MatchDetail?> AdjustScoreAsync(int id, AdjustScoreRequest request, CancellationToken cancellationToken)
    {
        if (request.Delta == 0)
        {
            return await GetAsync(id, cancellationToken);
        }

        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (request.TeamId == match.HomeTeamId)
        {
            var next = match.HomeScore + request.Delta;
            if (next < 0)
            {
                throw new InvalidOperationException("Score cannot be negative");
            }

            match.HomeScore = next;
        }
        else if (request.TeamId == match.AwayTeamId)
        {
            var next = match.AwayScore + request.Delta;
            if (next < 0)
            {
                throw new InvalidOperationException("Score cannot be negative");
            }

            match.AwayScore = next;
        }
        else
        {
            throw new InvalidOperationException("Invalid teamId for this match");
        }

        if (request.Delta != 0)
        {
            var ev = new ScoreEvent
            {
                MatchId = id,
                TeamId = request.TeamId,
                Points = request.Delta,
                RegisteredAtUtc = DateTime.UtcNow
            };
            _db.ScoreEvents.Add(ev);
        }

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> AddScoreEventAsync(int id, ScoreEventRequest request, CancellationToken cancellationToken)
    {
        if (request.Points is not (1 or 2 or 3))
        {
            throw new InvalidOperationException("Points must be 1,2,3");
        }

        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (match.Status != MatchStatus.Live)
        {
            throw new InvalidOperationException("Match must be live to add score");
        }

        if (request.TeamId == match.HomeTeamId)
        {
            match.HomeScore += request.Points;
        }
        else if (request.TeamId == match.AwayTeamId)
        {
            match.AwayScore += request.Points;
        }
        else
        {
            throw new InvalidOperationException("Invalid teamId for this match");
        }

        _db.ScoreEvents.Add(new ScoreEvent
        {
            MatchId = id,
            TeamId = request.TeamId,
            PlayerId = request.PlayerId,
            Points = request.Points,
            RegisteredAtUtc = request.RegisteredAtUtc ?? DateTime.UtcNow
        });

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> AddFoulAsync(int id, FoulRequest request, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (request.TeamId != match.HomeTeamId && request.TeamId != match.AwayTeamId)
        {
            throw new InvalidOperationException("Invalid teamId for this match");
        }

        _db.Fouls.Add(new Foul
        {
            MatchId = id,
            TeamId = request.TeamId,
            PlayerId = request.PlayerId,
            Type = request.Type,
            RegisteredAtUtc = request.RegisteredAtUtc ?? DateTime.UtcNow
        });

        if (request.TeamId == match.HomeTeamId)
        {
            match.HomeFouls += 1;
        }
        else
        {
            match.AwayFouls += 1;
        }

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> AdjustFoulsAsync(int id, AdjustFoulRequest request, CancellationToken cancellationToken)
    {
        if (request.Delta == 0)
        {
            return await GetAsync(id, cancellationToken);
        }

        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (request.TeamId != match.HomeTeamId && request.TeamId != match.AwayTeamId)
        {
            throw new InvalidOperationException("Invalid teamId for this match");
        }

        if (request.Delta > 0)
        {
            for (var i = 0; i < request.Delta; i++)
            {
                _db.Fouls.Add(new Foul
                {
                    MatchId = id,
                    TeamId = request.TeamId,
                    RegisteredAtUtc = DateTime.UtcNow
                });
            }
        }
        else
        {
            var toRemove = await _db.Fouls
                .Where(f => f.MatchId == id && f.TeamId == request.TeamId)
                .OrderByDescending(f => f.Id)
                .Take(Math.Abs(request.Delta))
                .ToListAsync(cancellationToken);

            if (toRemove.Count == 0)
            {
                throw new InvalidOperationException("No fouls to remove");
            }

            _db.Fouls.RemoveRange(toRemove);
        }

        if (request.TeamId == match.HomeTeamId)
        {
            match.HomeFouls = Math.Max(0, match.HomeFouls + request.Delta);
        }
        else
        {
            match.AwayFouls = Math.Max(0, match.AwayFouls + request.Delta);
        }

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> AdvanceQuarterAsync(int id, bool auto, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        if (match.Status == MatchStatus.Finished)
        {
            return await GetAsync(id, cancellationToken);
        }

        _logger.LogInformation("Advancing quarter for match {MatchId} (auto: {Auto})", id, auto);

        if (match.Period < 4)
        {
            match.Period += 1;
        }
        else
        {
            match.Status = MatchStatus.Finished;
            await RecordWinIfFinishedAsync(match, cancellationToken);
        }

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> SetQuarterAsync(int id, int quarter, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        var clamped = Math.Max(1, quarter);
        match.Period = clamped;
        if (match.Status == MatchStatus.Finished)
        {
            match.Status = MatchStatus.Live;
        }

        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> FinishAsync(int id, FinishMatchRequest request, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.Include(m => m.Fouls).Include(m => m.ScoreEvents)
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        match.HomeScore = request.HomeScore;
        match.AwayScore = request.AwayScore;

        await SyncFoulsAsync(match, match.HomeTeamId, request.HomeFouls, cancellationToken);
        await SyncFoulsAsync(match, match.AwayTeamId, request.AwayFouls, cancellationToken);

        if (request.ScoreEvents is { Count: > 0 })
        {
            foreach (var score in request.ScoreEvents)
            {
                _db.ScoreEvents.Add(new ScoreEvent
                {
                    MatchId = id,
                    TeamId = score.TeamId,
                    PlayerId = score.PlayerId,
                    Points = score.Points,
                    RegisteredAtUtc = score.RegisteredAtUtc ?? DateTime.UtcNow
                });
            }
        }

        if (request.Fouls is { Count: > 0 })
        {
            foreach (var foul in request.Fouls)
            {
                _db.Fouls.Add(new Foul
                {
                    MatchId = id,
                    TeamId = foul.TeamId,
                    PlayerId = foul.PlayerId,
                    Type = foul.Type,
                    RegisteredAtUtc = foul.RegisteredAtUtc ?? DateTime.UtcNow
                });
            }
        }

        match.Status = MatchStatus.Finished;
        match.UpdatedAtUtc = DateTime.UtcNow;
        await RecordWinIfFinishedAsync(match, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        _runtime.Reset(id);
        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchDetail?> CancelAsync(int id, MatchStatus status, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        match.Status = status;
        match.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var timer = _runtime.GetOrCreate(id, match.QuarterDurationSeconds);
        return ToDetail(match, timer);
    }

    public async Task<MatchRostersResponse?> GetRostersAsync(int id, CancellationToken cancellationToken)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (match is null)
        {
            return null;
        }

        var homePlayers = await _playersClient.GetPlayersByTeamAsync(match.HomeTeamName, cancellationToken);
        if (homePlayers.Count == 0)
        {
            homePlayers = await _teamsClient.GetPlayersAsync(match.HomeTeamId, cancellationToken);
        }

        var awayPlayers = await _playersClient.GetPlayersByTeamAsync(match.AwayTeamName, cancellationToken);
        if (awayPlayers.Count == 0)
        {
            awayPlayers = await _teamsClient.GetPlayersAsync(match.AwayTeamId, cancellationToken);
        }

        return new MatchRostersResponse(
            new TeamRoster(new TeamSummary(match.HomeTeamId, match.HomeTeamName), homePlayers),
            new TeamRoster(new TeamSummary(match.AwayTeamId, match.AwayTeamName), awayPlayers)
        );
    }

    private async Task SyncFoulsAsync(Match match, long teamId, int targetCount, CancellationToken cancellationToken)
    {
        var currentCount = await _db.Fouls.CountAsync(f => f.MatchId == match.Id && f.TeamId == teamId, cancellationToken);
        if (targetCount > currentCount)
        {
            for (var i = 0; i < targetCount - currentCount; i++)
            {
                _db.Fouls.Add(new Foul
                {
                    MatchId = match.Id,
                    TeamId = teamId,
                    RegisteredAtUtc = DateTime.UtcNow
                });
            }
        }
        else if (targetCount < currentCount)
        {
            var toRemove = await _db.Fouls
                .Where(f => f.MatchId == match.Id && f.TeamId == teamId)
                .OrderByDescending(f => f.Id)
                .Take(currentCount - targetCount)
                .ToListAsync(cancellationToken);
            _db.Fouls.RemoveRange(toRemove);
        }

        if (teamId == match.HomeTeamId)
        {
            match.HomeFouls = targetCount;
        }
        else
        {
            match.AwayFouls = targetCount;
        }
    }

    private async Task RecordWinIfFinishedAsync(Match match, CancellationToken cancellationToken)
    {
        if (match.Status != MatchStatus.Finished)
        {
            return;
        }

        if (match.HomeScore == match.AwayScore)
        {
            return;
        }

        var winner = match.HomeScore > match.AwayScore ? match.HomeTeamId : match.AwayTeamId;
        var exists = await _db.TeamWins.AnyAsync(w => w.MatchId == match.Id && w.TeamId == winner, cancellationToken);
        if (!exists)
        {
            _db.TeamWins.Add(new TeamWin
            {
                MatchId = match.Id,
                TeamId = winner,
                RegisteredAtUtc = DateTime.UtcNow
            });
        }
    }

    private static MatchDetail ToDetail(Match match, MatchTimerSnapshot timer)
    {
        return new MatchDetail(
            match.Id,
            new TeamSummary(match.HomeTeamId, match.HomeTeamName),
            new TeamSummary(match.AwayTeamId, match.AwayTeamName),
            match.Status,
            match.Period,
            match.QuarterDurationSeconds,
            ToTimer(timer),
            match.HomeScore,
            match.AwayScore,
            match.HomeFouls,
            match.AwayFouls,
            match.DateMatchUtc
        );
    }

    private static MatchTimerDto ToTimer(MatchTimerSnapshot snapshot)
        => new(snapshot.IsRunning, snapshot.RemainingSeconds, snapshot.EndsAtUtc);
}
