using System.Net.Http.Json;
using MatchesService.Models.DTOs;

namespace MatchesService.Clients;

public class PlayersClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PlayersClient> _logger;

    public PlayersClient(HttpClient httpClient, ILogger<PlayersClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PlayerDto>> GetPlayersByTeamAsync(string teamName, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/players/by-team/{Uri.EscapeDataString(teamName)}", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return Array.Empty<PlayerDto>();
            }

            var payload = await response.Content.ReadFromJsonAsync<LaravelCollectionResponse<PlayerDto>>(cancellationToken: cancellationToken);
            return payload?.Data ?? Array.Empty<PlayerDto>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch players for {TeamName}", teamName);
            return Array.Empty<PlayerDto>();
        }
    }

    private sealed class LaravelCollectionResponse<T>
    {
        public List<T>? Data { get; set; }
    }
}
