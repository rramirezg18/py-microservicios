using Microsoft.EntityFrameworkCore;
using MatchesService.Data;
using MatchesService.Models;

namespace MatchesService.Repositories
{
    /// <summary>
    /// Repositorio que implementa las operaciones de acceso a datos para la entidad Match.
    /// Esta versión no depende del modelo Team local, ya que los equipos se gestionan desde el microservicio teams-service.
    /// </summary>
    public class MatchRepository : IMatchRepository
    {
        private readonly MatchesDbContext _context;

        public MatchRepository(MatchesDbContext context)
        {
            _context = context;
        }

        // ==========================================================
        // 📋 LISTAR PARTIDOS (con filtros y paginación)
        // ==========================================================
        public async Task<IEnumerable<Match>> GetAllAsync(
            int page,
            int pageSize,
            string? status,
            int? teamId,
            DateTime? from,
            DateTime? to)
        {
            var query = _context.Matches.AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(m => m.Status == status);

            if (teamId.HasValue)
                query = query.Where(m => m.HomeTeamId == teamId || m.AwayTeamId == teamId);

            if (from.HasValue)
                query = query.Where(m => m.DateMatch >= from.Value);

            if (to.HasValue)
                query = query.Where(m => m.DateMatch <= to.Value);

            return await query
                .OrderByDescending(m => m.DateMatch)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        // ==========================================================
        // 🔢 CONTAR PARTIDOS (para paginación)
        // ==========================================================
        public async Task<int> CountAsync(string? status, int? teamId, DateTime? from, DateTime? to)
        {
            var query = _context.Matches.AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(m => m.Status == status);

            if (teamId.HasValue)
                query = query.Where(m => m.HomeTeamId == teamId || m.AwayTeamId == teamId);

            if (from.HasValue)
                query = query.Where(m => m.DateMatch >= from.Value);

            if (to.HasValue)
                query = query.Where(m => m.DateMatch <= to.Value);

            return await query.CountAsync();
        }

        // ==========================================================
        // 🔍 OBTENER UN PARTIDO POR ID
        // ==========================================================
        public async Task<Match?> GetByIdAsync(int id)
        {
            return await _context.Matches
                .Include(m => m.ScoreEvents)
                .Include(m => m.Fouls)
                .FirstOrDefaultAsync(m => m.Id == id);
        }

        // ==========================================================
        // ➕ AGREGAR NUEVO PARTIDO
        // ==========================================================
        public async Task AddAsync(Match match)
        {
            await _context.Matches.AddAsync(match);
        }

        // ==========================================================
        // 🔄 ACTUALIZAR PARTIDO
        // ==========================================================
        public async Task UpdateAsync(Match match)
        {
            _context.Matches.Update(match);
            await Task.CompletedTask;
        }

        // ==========================================================
        // ❌ ELIMINAR PARTIDO
        // ==========================================================
        public async Task DeleteAsync(Match match)
        {
            _context.Matches.Remove(match);
            await Task.CompletedTask;
        }

        // ==========================================================
        // 💾 GUARDAR CAMBIOS
        // ==========================================================
        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }

        // ==========================================================
        // ⏰ OBTENER PRÓXIMOS PARTIDOS
        // ==========================================================
        public async Task<IEnumerable<Match>> GetUpcomingAsync()
        {
            return await _context.Matches
                .Where(m => m.Status == "Scheduled" && m.DateMatch > DateTime.UtcNow)
                .OrderBy(m => m.DateMatch)
                .Take(10)
                .ToListAsync();
        }

        // ==========================================================
        // 📅 PARTIDOS POR RANGO DE FECHAS
        // ==========================================================
        public async Task<IEnumerable<Match>> GetByRangeAsync(DateTime from, DateTime to)
        {
            return await _context.Matches
                .Where(m => m.DateMatch >= from && m.DateMatch <= to)
                .OrderBy(m => m.DateMatch)
                .ToListAsync();
        }

        // ==========================================================
        // 🚨 CONTAR FALTAS POR EQUIPO EN UN PARTIDO
        // ==========================================================
        public async Task<int> GetFoulCountAsync(int matchId, int teamId)
        {
            return await _context.Fouls
                .CountAsync(f => f.MatchId == matchId && f.TeamId == teamId);
        }
    }
}
