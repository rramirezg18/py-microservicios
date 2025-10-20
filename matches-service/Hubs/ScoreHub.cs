using Microsoft.AspNetCore.SignalR;

namespace MatchesService.Hubs;

/// <summary>
/// Hub de SignalR que maneja la comunicación en tiempo real
/// entre el servidor y los clientes conectados a un partido.
/// </summary>
public class ScoreHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();

        // Verifica si se envió el ID del partido al conectar
        var matchId = http?.Request.Query["matchId"].ToString();

        if (!string.IsNullOrWhiteSpace(matchId))
        {
            // El cliente se une al grupo correspondiente al partido
            await Groups.AddToGroupAsync(Context.ConnectionId, $"match-{matchId}");

            // Notifica a los clientes del grupo que alguien se conectó
            await Clients.Group($"match-{matchId}")
                .SendAsync("userJoined", new { connectionId = Context.ConnectionId });
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var http = Context.GetHttpContext();
        var matchId = http?.Request.Query["matchId"].ToString();

        if (!string.IsNullOrWhiteSpace(matchId))
        {
            // Notifica al grupo que el cliente salió
            await Clients.Group($"match-{matchId}")
                .SendAsync("userLeft", new { connectionId = Context.ConnectionId });
        }

        await base.OnDisconnectedAsync(exception);
    }
}
