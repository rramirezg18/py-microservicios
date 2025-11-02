using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MatchesService.Hubs
{
    [AllowAnonymous]
    public class ScoreHub : Hub
    {
     
        public static string GroupName(int matchId) => $"match-{matchId}";

        public override async Task OnConnectedAsync()
        {
            var http = Context.GetHttpContext();

           
            string? idStr = http?.Request.Query["matchId"].ToString();

           
            if (string.IsNullOrWhiteSpace(idStr))
                idStr = http?.Request.Headers["X-Match-Id"].ToString();

            
            if (string.IsNullOrWhiteSpace(idStr) && http?.Request.Path.HasValue == true)
            {
                var path = http.Request.Path.Value ?? "";
                if (path.Contains("matchId="))
                {
                    var parts = path.Split("matchId=");
                    if (parts.Length > 1)
                        idStr = parts[1].Split('&')[0];
                }
            }

            if (int.TryParse(idStr, out var matchId))
            {
                var group = GroupName(matchId);
                await Groups.AddToGroupAsync(Context.ConnectionId, group);
                Console.WriteLine($"✅ Cliente conectado a grupo {group} ({Context.ConnectionId})");
            }
            else
            {
                Console.WriteLine($"⚠️ Cliente conectado sin matchId válido. Valor recibido: '{idStr ?? "null"}'");
            }

            await base.OnConnectedAsync();
        }


        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var http = Context.GetHttpContext();
            string? idStr = http?.Request.Query["matchId"].ToString();

            if (string.IsNullOrWhiteSpace(idStr))
                idStr = http?.Request.Headers["X-Match-Id"].ToString();

            if (int.TryParse(idStr, out var matchId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(matchId));
                Console.WriteLine($"❌ Cliente desconectado de grupo {GroupName(matchId)}");
            }

            await base.OnDisconnectedAsync(exception);
        }


        public async Task BroadcastFouls(int matchId, int homeFouls, int awayFouls)
        {
            var group = GroupName(matchId);
            await Clients.Group(group).SendAsync("foulsUpdated", new
            {
                foulsHome = homeFouls,
                foulsAway = awayFouls
            });

            Console.WriteLine($"📢 Emitido foulsUpdated → {group}: L={homeFouls}, V={awayFouls}");
        }


        public async Task JoinMatch(int matchId)
        {
            var group = GroupName(matchId);
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
            Console.WriteLine($"➕ Cliente se une manualmente a grupo {group}");
        }


        public async Task LeaveMatch(int matchId)
        {
            var group = GroupName(matchId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
            Console.WriteLine($"➖ Cliente abandona grupo {group}");
        }
    }
}
