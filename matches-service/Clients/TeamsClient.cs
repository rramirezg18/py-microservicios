using System.Net;
using System.Net.Http.Json;
using MatchesService.Models.DTOs;

namespace MatchesService.Clients;

public class TeamsClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TeamsClient> _logger;

    public TeamsClient(HttpClient httpClient, ILogger<TeamsClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<TeamDto?> GetTeamAsync(long teamId, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/api/teams/{teamId}", cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<TeamDto>(cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch team {TeamId}", teamId);
            return null;
        }
    }

    public async Task<IReadOnlyList<PlayerDto>> GetPlayersAsync(long teamId, CancellationToken cancellationToken = default)
    {
        try
        {
            var players = await _httpClient.GetFromJsonAsync<List<PlayerDto>>($"/api/teams/{teamId}/players", cancellationToken);
            return players ?? Array.Empty<PlayerDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch players for team {TeamId}", teamId);
            return Array.Empty<PlayerDto>();
        }
    }
}
