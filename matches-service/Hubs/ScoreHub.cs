using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MatchesService.Hubs;

[Authorize]
public class ScoreHub : Hub
{
    private static string GroupName(int matchId) => $"match-{matchId}";

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }

    public async Task JoinMatch(int matchId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(matchId));
    }

    public async Task LeaveMatch(int matchId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(matchId));
    }
}
