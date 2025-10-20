using MatchesService.Models;
using MatchesService.Models.DTOs;

namespace MatchesService.Repositories
{
    /// <summary>
    /// Define las operaciones de acceso a datos para la entidad Match.
    /// Este repositorio gestiona únicamente los datos locales del microservicio de partidos.
    /// La información de los equipos (Team) se obtiene externamente desde el teams-service.
    /// </summary>
    public interface IMatchRepository
    {
        // 🔹 Operaciones principales CRUD
        Task<IEnumerable<Match>> GetAllAsync(
            int page,
            int pageSize,
            string? status,
            int? teamId,
            DateTime? from,
            DateTime? to);

        Task<Match?> GetByIdAsync(int id);
        Task<int> CountAsync(string? status, int? teamId, DateTime? from, DateTime? to);

        Task AddAsync(Match match);
        Task UpdateAsync(Match match);
        Task DeleteAsync(Match match);
        Task SaveChangesAsync();

        // 🔹 Consultas personalizadas
        Task<IEnumerable<Match>> GetUpcomingAsync();
        Task<IEnumerable<Match>> GetByRangeAsync(DateTime from, DateTime to);

        // 🔹 Estadísticas / faltas / puntuaciones
        Task<int> GetFoulCountAsync(int matchId, int teamId);
    }
}
