using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MatchesService.Hubs
{
    [AllowAnonymous]
    public class ScoreHub : Hub
    {
        public static string GroupName(int matchId) => $"match:{matchId}";

        public override async Task OnConnectedAsync()
        {
            var http = Context.GetHttpContext();
            var idStr = http?.Request.Query["matchId"].ToString();

            if (int.TryParse(idStr, out var matchId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(matchId));
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var http = Context.GetHttpContext();
            var idStr = http?.Request.Query["matchId"].ToString();

            if (int.TryParse(idStr, out var matchId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(matchId));
            }

            await base.OnDisconnectedAsync(exception);
        }

        public Task JoinMatch(int matchId)
            => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(matchId));

        public Task LeaveMatch(int matchId)
            => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(matchId));
    }
}
