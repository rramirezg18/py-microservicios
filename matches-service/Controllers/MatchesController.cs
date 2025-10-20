using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MatchesService.Hubs;
using MatchesService.Models.DTOs;
using MatchesService.Services;

namespace MatchesService.Controllers;

[ApiController]
[Route("api/matches")]
public class MatchesController(IMatchService matchService, IHubContext<ScoreHub> hub) : ControllerBase
{
    // ✅ Listar partidos
    [HttpGet]
    [HttpGet("list")]
    public async Task<IActionResult> Listar(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] int? teamId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var result = await matchService.ListarAsync(page, pageSize, status, teamId, from, to);
        return Ok(result);
    }

    // ✅ Obtener detalle de un partido
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var result = await matchService.GetMatchAsync(id);
        if (result is null) return NotFound();
        return Ok(result);
    }

    // ✅ Programar partido
    [HttpPost("programar")]
    //[Authorize(Roles = "Admin")]
    public async Task<IActionResult> Programar([FromBody] ProgramarPartidoDto dto)
    {
        var result = await matchService.ProgramarAsync(dto);
        return result.Success ? Ok(result.Data) : BadRequest(result.Error);
    }

    // ✅ Reprogramar partido
    [HttpPut("{id:int}/reprogramar")]
    //[Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reprogramar(int id, [FromBody] ReprogramarDto dto)
    {
        var result = await matchService.ReprogramarAsync(id, dto);
        return result.Success ? Ok(result.Data) : BadRequest(result.Error);
    }

    // ✅ Próximos partidos
    [HttpGet("proximos")]
    public async Task<IActionResult> Proximos()
    {
        var result = await matchService.ProximosAsync();
        return Ok(result);
    }

    // ✅ Partidos por rango de fecha
    [HttpGet("rango")]
    public async Task<IActionResult> Rango([FromQuery] DateTime from, [FromQuery] DateTime to)
    {
        var result = await matchService.RangoAsync(from, to);
        return result.Success ? Ok(result.Data) : BadRequest(result.Error);
    }

    // ✅ Crear partido con nombres nuevos
    [HttpPost("new")]
    //[Authorize(Roles = "Admin")]
    public async Task<IActionResult> NewGame([FromBody] NewGameDto dto)
    {
        var result = await matchService.NewGameAsync(dto);
        return result.Success ? Ok(result.Data) : BadRequest(result.Error);
    }

    // ✅ Crear partido con equipos existentes
    [HttpPost("new-by-teams")]
    //[Authorize(Roles = "Admin")]
    public async Task<IActionResult> NewByTeams([FromBody] NewGameByTeamsDto dto)
    {
        var result = await matchService.NewByTeamsAsync(dto);
        return result.Success ? Ok(result.Data) : BadRequest(result.Error);
    }

    // ✅ Puntuaciones
    [HttpPost("{id:int}/score")]
    public async Task<IActionResult> AddScore(int id, [FromBody] AddScoreDto dto)
    {
        var result = await matchService.AddScoreAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("scoreUpdated", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/score/adjust")]
    public async Task<IActionResult> AdjustScore(int id, [FromBody] AdjustScoreDto dto)
    {
        var result = await matchService.AdjustScoreAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("scoreUpdated", result.Data);
        return Ok(result.Data);
    }

    // ✅ Faltas
    [HttpPost("{id:int}/fouls")]
    public async Task<IActionResult> AddFoul(int id, [FromBody] AddFoulDto dto)
    {
        var result = await matchService.AddFoulAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("foulsUpdated", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/fouls/adjust")]
    public async Task<IActionResult> AdjustFoul(int id, [FromBody] AdjustFoulDto dto)
    {
        var result = await matchService.AdjustFoulAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("foulsUpdated", result.Data);
        return Ok(result.Data);
    }

    // ✅ Temporizador
    [HttpPost("{id:int}/start")]
    [HttpPost("{id:int}/timer/start")]
    //[Authorize(Roles = "Control")]
    public async Task<IActionResult> StartTimer(int id, [FromBody] StartTimerDto? dto)
    {
        var result = await matchService.StartTimerAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("timerStarted", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/timer/pause")]
    public async Task<IActionResult> PauseTimer(int id)
    {
        var result = await matchService.PauseTimerAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("timerPaused", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/timer/resume")]
    public async Task<IActionResult> ResumeTimer(int id)
    {
        var result = await matchService.ResumeTimerAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("timerResumed", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/timer/reset")]
    public async Task<IActionResult> ResetTimer(int id)
    {
        var result = await matchService.ResetTimerAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("timerReset", result.Data);
        return Ok(result.Data);
    }

    // ✅ Cuartos
    [HttpPost("{id:int}/quarters/advance")]
    public async Task<IActionResult> AdvanceQuarter(int id)
    {
        var result = await matchService.AdvanceQuarterAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("quarterChanged", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/quarters/auto-advance")]
    public async Task<IActionResult> AutoAdvanceQuarter(int id)
    {
        var result = await matchService.AutoAdvanceQuarterAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("quarterChanged", result.Data);

        if (result.GameEnded != null)
            await hub.Clients.Group($"match-{id}").SendAsync("gameEnded", result.GameEnded);

        return Ok(result.Data);
    }

    // ✅ Finalizar, cancelar, suspender
    [HttpPost("{id:int}/finish")]
    public async Task<IActionResult> Finish(int id, [FromBody] FinishMatchDto dto)
    {
        var result = await matchService.FinishAsync(id, dto);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("gameEnded", result.GameEnded);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var result = await matchService.CancelAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("gameCanceled", result.Data);
        return Ok(result.Data);
    }

    [HttpPost("{id:int}/suspend")]
    public async Task<IActionResult> Suspend(int id)
    {
        var result = await matchService.SuspendAsync(id);
        if (!result.Success) return BadRequest(result.Error);

        await hub.Clients.Group($"match-{id}")
            .SendAsync("gameSuspended", result.Data);
        return Ok(result.Data);
    }
}
