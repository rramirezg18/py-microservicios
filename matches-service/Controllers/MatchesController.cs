using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MatchesService.Hubs;
using MatchesService.Models.DTOs;
using MatchesService.Services;

namespace MatchesService.Controllers
{
    [ApiController]
    [Route("api/matches")]
    [Produces("application/json")]
    public class MatchesController : ControllerBase
    {
        private readonly IMatchService matchService;
        private readonly IHubContext<ScoreHub> hub;

        public MatchesController(IMatchService matchService, IHubContext<ScoreHub> hub)
        {
            this.matchService = matchService;
            this.hub = hub;
        }


        [HttpGet("health")]
        public IActionResult Health() => Ok("OK");


        //istar partidos
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

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var result = await matchService.GetMatchAsync(id);
            if (result is null) return NotFound(new { error = "Partido no encontrado" });
            return Ok(result);
        }

        //prograa
        [HttpPost("programar")]
        public async Task<IActionResult> Programar([FromBody] ProgramarPartidoDto dto)
        {
            var result = await matchService.ProgramarAsync(dto);
            return result.Success ? Ok(result.Data) : BadRequest(new { error = result.Error });
        }

        //Próximos
        [HttpGet("proximos")]
        public async Task<IActionResult> Proximos()
        {
            var result = await matchService.ProximosAsync();
            return Ok(result);
        }

        //Rango
        [HttpGet("rango")]
        public async Task<IActionResult> Rango([FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            var result = await matchService.RangoAsync(from, to);
            return result.Success ? Ok(result.Data) : BadRequest(new { error = result.Error });
        }

        // marcador
        [HttpPost("{id:int}/score")]
        public async Task<IActionResult> AddScore(int id, [FromBody] AddScoreDto dto)
        {
            var result = await matchService.AddScoreAsync(id, dto);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("scoreUpdated", result.Data);
            return Ok(result.Data);
        }

        //ajustar faltas
        [HttpPost("{id:int}/foul")]
        [HttpPost("{id:int}/fouls")]
        public async Task<IActionResult> AddFoul(int id, [FromBody] AddFoulDto dto)
        {
            var result = await matchService.AddFoulAsync(id, dto);
            if (!result.Success) return BadRequest(new { error = result.Error });

            if (result.Data != null)
            {
                var foulsHome = (int)(result.Data.GetType().GetProperty("FoulsHome")?.GetValue(result.Data) ?? 0);
                var foulsAway = (int)(result.Data.GetType().GetProperty("FoulsAway")?.GetValue(result.Data) ?? 0);

                await hub.Clients.Group($"match-{id}")
                    .SendAsync("foulsUpdated", new { homeFouls = foulsHome, awayFouls = foulsAway });

                Console.WriteLine($"📢 Emitido foulsUpdated → match-{id}: L={foulsHome}, V={foulsAway}");
            }

            return Ok(result.Data);
        }

        [HttpPost("{id:int}/foul/adjust")]
        [HttpPost("{id:int}/fouls/adjust")]
        public async Task<IActionResult> AdjustFoul(int id, [FromBody] AdjustFoulDto dto)
        {
            var result = await matchService.AdjustFoulAsync(id, dto);
            if (!result.Success) return BadRequest(new { error = result.Error });

            if (result.Data != null)
            {
                var foulsHome = (int)(result.Data.GetType().GetProperty("FoulsHome")?.GetValue(result.Data) ?? 0);
                var foulsAway = (int)(result.Data.GetType().GetProperty("FoulsAway")?.GetValue(result.Data) ?? 0);

                await hub.Clients.Group($"match-{id}")
                    .SendAsync("foulsUpdated", new { homeFouls = foulsHome, awayFouls = foulsAway });

                Console.WriteLine($"📢 Emitido foulsUpdated → match-{id}: L={foulsHome}, V={foulsAway}");
            }

            return Ok(result.Data);
        }

        // post para iniciar un partido se cambia el estado a live
        [HttpPost("{id:int}/timer/start")]
        public async Task<IActionResult> StartTimer(int id, [FromBody] StartTimerDto? dto)
        {
            var result = await matchService.StartTimerAsync(id, dto);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("timerStarted", result.Data);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/timer/pause")]
        public async Task<IActionResult> PauseTimer(int id)
        {
            var result = await matchService.PauseTimerAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("timerPaused", result.Data);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/timer/resume")]
        public async Task<IActionResult> ResumeTimer(int id)
        {
            var result = await matchService.ResumeTimerAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("timerResumed", result.Data);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/timer/reset")]
        public async Task<IActionResult> ResetTimer(int id)
        {
            var result = await matchService.ResetTimerAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("timerReset", result.Data);
            return Ok(result.Data);
        }

        //avanzar periodo
        [HttpPost("{id:int}/quarters/advance")]
        public async Task<IActionResult> AdvanceQuarter(int id)
        {
            var result = await matchService.AdvanceQuarterAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("quarterChanged", result.Data);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/quarters/auto-advance")]
        public async Task<IActionResult> AutoAdvanceQuarter(int id)
        {
            var result = await matchService.AutoAdvanceQuarterAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("quarterChanged", result.Data);
            if (result.GameEnded != null)
                await hub.Clients.Group($"match-{id}").SendAsync("gameEnded", result.GameEnded);

            return Ok(result.Data);
        }

        //post que finaliza el partido 
        [HttpPost("{id:int}/finish")]
        public async Task<IActionResult> Finish(int id, [FromBody] FinishMatchDto dto)
        {
            var result = await matchService.FinishAsync(id, dto);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("gameEnded", result.GameEnded);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            var result = await matchService.CancelAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("gameCanceled", result.Data);
            return Ok(result.Data);
        }

        [HttpPost("{id:int}/suspend")]
        public async Task<IActionResult> Suspend(int id)
        {
            var result = await matchService.SuspendAsync(id);
            if (!result.Success) return BadRequest(new { error = result.Error });

            await hub.Clients.Group($"match-{id}").SendAsync("gameSuspended", result.Data);
            return Ok(result.Data);
        }
    }
}
