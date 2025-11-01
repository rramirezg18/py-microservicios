using System.Text.Json;

namespace TournamentService.Services;

public class MatchesServiceHttpClient
{
    private readonly HttpClient _http;
    public MatchesServiceHttpClient(HttpClient http) => _http = http;

    public class MatchDto
    {
        public int Id { get; set; }
        public string? Status { get; set; }
        public int HomeTeamId { get; set; }
        public int AwayTeamId { get; set; }
        public int HomeScore { get; set; }
        public int AwayScore { get; set; }
        public DateTime? DateMatch { get; set; }
        public string? HomeTeamName { get; set; }   // si tu API ya lo trae…
        public string? AwayTeamName { get; set; }
    }

    public async Task<MatchDto?> GetAsync(int id, CancellationToken ct = default)
    {
        try
        {
            using var res = await _http.GetAsync($"/api/matches/{id}", ct);
            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync(ct);
            var dto = JsonSerializer.Deserialize<MatchDto>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return dto;
        }
        catch { return null; }
    }
}
