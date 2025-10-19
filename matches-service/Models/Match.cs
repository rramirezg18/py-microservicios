// Models/Match.cs
namespace MatchesService.Models
{
    public class Match
    {
        public int Id { get; set; }

        public int HomeTeamId { get; set; }
        public int AwayTeamId { get; set; }

        public int HomeScore { get; set; }
        public int AwayScore { get; set; }
        public int Period { get; set; } = 1;
        public string Status { get; set; } = "Scheduled";
        public DateTime DateMatch { get; set; }
        public int QuarterDurationSeconds { get; set; } = 600;

        public ICollection<ScoreEvent> ScoreEvents { get; set; } = new List<ScoreEvent>();
        public ICollection<Foul> Fouls { get; set; } = new List<Foul>();
    }
}
