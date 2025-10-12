using MatchesService.Hubs;
using MatchesService.Models.DTOs;
using MatchesService.Models.Enums;
using MatchesService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace MatchesService.Controllers;

[Authorize]
[ApiController]
[Route("api/matches")]
public class MatchesController : ControllerBase
{
    private readonly MatchesApplicationService _service;
    private readonly IHubContext<ScoreHub> _hub;
    private readonly ILogger<MatchesController> _logger;

    public MatchesController(MatchesApplicationService service, IHubContext<ScoreHub> hub, ILogger<MatchesController> logger)
    {
        _service = service;
        _hub = hub;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(MatchListResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] long? teamId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _service.ListAsync(page, pageSize, status, teamId, from, to, cancellationToken);
        return Ok(result);
    }

    [HttpGet("upcoming")]
    [ProducesResponseType(typeof(IReadOnlyList<MatchListItem>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Upcoming(CancellationToken cancellationToken = default)
    {
        var items = await _service.UpcomingAsync(cancellationToken);
        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(int id, CancellationToken cancellationToken = default)
    {
        var match = await _service.GetAsync(id, cancellationToken);
        if (match is null)
        {
            return NotFound();
        }

        return Ok(match);
    }

    [HttpGet("{id:int}/rosters")]
    [ProducesResponseType(typeof(MatchRostersResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Rosters(int id, CancellationToken cancellationToken = default)
    {
        var rosters = await _service.GetRostersAsync(id, cancellationToken);
        if (rosters is null)
        {
            return NotFound();
        }

        return Ok(rosters);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status201Created)]
    public Task<IActionResult> Program([FromBody] ProgramMatchRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.ProgramAsync(request, cancellationToken);
            _logger.LogInformation(
                "Match {MatchId} scheduled: {Home} vs {Away} on {Date}",
                detail.Id,
                detail.Home.Name,
                detail.Away.Name,
                detail.DateMatchUtc);
            return CreatedAtAction(nameof(Get), new { id = detail.Id }, detail);
        },
        "schedule-match",
        new { request.HomeTeamId, request.AwayTeamId, request.DateMatchUtc });

    [HttpPut("{id:int}/reschedule")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Reprogram(int id, [FromBody] ReprogramMatchRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.ReprogramAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            return Ok(detail);
        },
        "reschedule-match",
        new { MatchId = id, request.NewDateMatchUtc });

    [HttpPost("{id:int}/start")]
    [HttpPost("{id:int}/timer/start")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchTimerDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartTimer(int id, [FromBody] StartTimerRequest request, CancellationToken cancellationToken = default)
    {
        var timer = await _service.StartTimerAsync(id, request, cancellationToken);
        if (timer is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("timerStarted", new
        {
            quarterEndsAtUtc = timer.QuarterEndsAtUtc,
            remainingSeconds = timer.RemainingSeconds
        }, cancellationToken);

        var detail = await _service.GetAsync(id, cancellationToken);
        if (detail is not null)
        {
            await _hub.Clients.Group(GroupName(id)).SendAsync("quarterChanged", new { quarter = detail.Period }, cancellationToken);
        }
        await _hub.Clients.Group(GroupName(id)).SendAsync("buzzer", new { reason = "quarter-start" }, cancellationToken);

        return Ok(timer);
    }

    [HttpPost("{id:int}/timer/pause")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> PauseTimer(int id, CancellationToken cancellationToken = default)
    {
        var remaining = await _service.PauseTimerAsync(id, cancellationToken);
        if (remaining is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("timerPaused", new { remainingSeconds = remaining }, cancellationToken);
        return Ok(new { remainingSeconds = remaining });
    }

    [HttpPost("{id:int}/timer/resume")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchTimerDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResumeTimer(int id, CancellationToken cancellationToken = default)
    {
        var timer = await _service.ResumeTimerAsync(id, cancellationToken);
        if (timer is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("timerResumed", new
        {
            quarterEndsAtUtc = timer.QuarterEndsAtUtc,
            remainingSeconds = timer.RemainingSeconds
        }, cancellationToken);

        return Ok(timer);
    }

    [HttpPost("{id:int}/timer/reset")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchTimerDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetTimer(int id, CancellationToken cancellationToken = default)
    {
        var timer = await _service.ResetTimerAsync(id, cancellationToken);
        if (timer is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("timerReset", new { remainingSeconds = timer.RemainingSeconds }, cancellationToken);
        return Ok(timer);
    }

    [HttpPost("{id:int}/score")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> AddScore(int id, [FromBody] ScoreEventRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.AddScoreEventAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await BroadcastScoreAsync(id, detail, cancellationToken);
            return Ok(detail);
        },
        "add-score",
        new { MatchId = id, request.TeamId, request.Points });

    [HttpPost("{id:int}/score/adjust")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> AdjustScore(int id, [FromBody] AdjustScoreRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.AdjustScoreAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await BroadcastScoreAsync(id, detail, cancellationToken);
            return Ok(detail);
        },
        "adjust-score",
        new { MatchId = id, request.TeamId, request.Delta });

    [HttpPost("{id:int}/fouls")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> AddFoul(int id, [FromBody] FoulRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.AddFoulAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await BroadcastFoulsAsync(id, detail, cancellationToken);
            return Ok(detail);
        },
        "add-foul",
        new { MatchId = id, request.TeamId, request.Type });

    [HttpPost("{id:int}/fouls/adjust")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> AdjustFouls(int id, [FromBody] AdjustFoulRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.AdjustFoulsAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await BroadcastFoulsAsync(id, detail, cancellationToken);
            return Ok(detail);
        },
        "adjust-fouls",
        new { MatchId = id, request.TeamId, request.Delta });

    [HttpPost("{id:int}/quarters/advance")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public async Task<IActionResult> AdvanceQuarter(int id, CancellationToken cancellationToken = default)
    {
        var detail = await _service.AdvanceQuarterAsync(id, false, cancellationToken);
        if (detail is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("quarterChanged", new { quarter = detail.Period }, cancellationToken);
        await _hub.Clients.Group(GroupName(id)).SendAsync("buzzer", new { reason = "quarter-end" }, cancellationToken);

        if (detail.Status == MatchStatus.Finished)
        {
            await BroadcastGameEndedAsync(id, detail, cancellationToken);
        }

        return Ok(detail);
    }

    [HttpPost("{id:int}/quarters/set")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetQuarter(int id, [FromBody] SetQuarterRequest request, CancellationToken cancellationToken = default)
    {
        var detail = await _service.SetQuarterAsync(id, request.Quarter, cancellationToken);
        if (detail is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("quarterChanged", new { quarter = detail.Period }, cancellationToken);
        return Ok(detail);
    }

    [HttpPost("{id:int}/quarters/auto-advance")]
    [Authorize(Roles = "Control,Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public async Task<IActionResult> AutoAdvanceQuarter(int id, CancellationToken cancellationToken = default)
    {
        var detail = await _service.AdvanceQuarterAsync(id, true, cancellationToken);
        if (detail is null)
        {
            return NotFound();
        }

        await _hub.Clients.Group(GroupName(id)).SendAsync("quarterChanged", new { quarter = detail.Period }, cancellationToken);
        await _hub.Clients.Group(GroupName(id)).SendAsync("buzzer", new { reason = "quarter-end" }, cancellationToken);

        if (detail.Status == MatchStatus.Finished)
        {
            await BroadcastGameEndedAsync(id, detail, cancellationToken);
        }

        return Ok(detail);
    }

    [HttpPost("{id:int}/finish")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> Finish(int id, [FromBody] FinishMatchRequest request, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.FinishAsync(id, request, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await BroadcastGameEndedAsync(id, detail, cancellationToken);
            return Ok(detail);
        },
        "finish-match",
        new { MatchId = id, request.HomeScore, request.AwayScore });

    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> Cancel(int id, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.CancelAsync(id, MatchStatus.Canceled, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await _hub.Clients.Group(GroupName(id)).SendAsync("gameCanceled", new { status = detail.Status }, cancellationToken);
            return Ok(detail);
        },
        "cancel-match",
        new { MatchId = id });

    [HttpPost("{id:int}/suspend")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(MatchDetail), StatusCodes.Status200OK)]
    public Task<IActionResult> Suspend(int id, CancellationToken cancellationToken = default)
        => HandleAsync(async () =>
        {
            var detail = await _service.CancelAsync(id, MatchStatus.Suspended, cancellationToken);
            if (detail is null)
            {
                return NotFound();
            }

            await _hub.Clients.Group(GroupName(id)).SendAsync("gameSuspended", new { status = detail.Status }, cancellationToken);
            return Ok(detail);
        },
        "suspend-match",
        new { MatchId = id });

    private async Task<IActionResult> HandleAsync(Func<Task<IActionResult>> action, string operation, object? context = null)
    {
        try
        {
            return await action();
        }
        catch (InvalidOperationException ex)
        {
            if (context is null)
            {
                _logger.LogWarning(ex, "Invalid request for {Operation}: {Message}", operation, ex.Message);
            }
            else
            {
                _logger.LogWarning(ex, "Invalid request for {Operation}. Context: {@Context}", operation, context);
            }

            return BadRequest(new { error = ex.Message });
        }
    }

    private static string GroupName(int matchId) => $"match-{matchId}";

    private async Task BroadcastScoreAsync(int matchId, MatchDetail detail, CancellationToken cancellationToken)
    {
        await _hub.Clients.Group(GroupName(matchId)).SendAsync("scoreUpdated", new
        {
            homeScore = detail.HomeScore,
            awayScore = detail.AwayScore
        }, cancellationToken);
    }

    private async Task BroadcastFoulsAsync(int matchId, MatchDetail detail, CancellationToken cancellationToken)
    {
        await _hub.Clients.Group(GroupName(matchId)).SendAsync("foulsUpdated", new
        {
            homeFouls = detail.HomeFouls,
            awayFouls = detail.AwayFouls
        }, cancellationToken);
    }

    private async Task BroadcastGameEndedAsync(int matchId, MatchDetail detail, CancellationToken cancellationToken)
    {
        await _hub.Clients.Group(GroupName(matchId)).SendAsync("gameEnded", new
        {
            home = detail.HomeScore,
            away = detail.AwayScore,
            winner = detail.HomeScore == detail.AwayScore
                ? "draw"
                : detail.HomeScore > detail.AwayScore
                    ? "home"
                    : "away"
        }, cancellationToken);
    }
}
