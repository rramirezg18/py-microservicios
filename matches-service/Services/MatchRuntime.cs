using System.Collections.Concurrent;

namespace MatchesService.Services;

public interface IMatchRuntime
{
    MatchTimerSnapshot GetOrCreate(int matchId, int periodDurationSeconds);
    MatchTimerSnapshot Get(int matchId);
    MatchTimerSnapshot Start(int matchId, int periodDurationSeconds);
    int Pause(int matchId);
    MatchTimerSnapshot Resume(int matchId);
    void Reset(int matchId);
}

public record MatchTimerSnapshot(bool IsRunning, int RemainingSeconds, DateTime? EndsAtUtc);

internal sealed class MatchRuntime : IMatchRuntime
{
    private record TimerState(bool Running, int RemainingSeconds, DateTime? EndsAtUtc);

    private readonly ConcurrentDictionary<int, TimerState> _timers = new();

    public MatchTimerSnapshot GetOrCreate(int matchId, int periodDurationSeconds)
    {
        var state = _timers.GetOrAdd(matchId, _ => new TimerState(false, periodDurationSeconds, null));
        return ToSnapshot(state);
    }

    public MatchTimerSnapshot Get(int matchId)
    {
        return ToSnapshot(_timers.GetOrAdd(matchId, _ => new TimerState(false, 0, null)));
    }

    public MatchTimerSnapshot Start(int matchId, int periodDurationSeconds)
    {
        var endsAt = DateTime.UtcNow.AddSeconds(periodDurationSeconds);
        var state = new TimerState(true, periodDurationSeconds, endsAt);
        _ = _timers.AddOrUpdate(matchId, state, (_, _) => state);
        return ToSnapshot(state);
    }

    public int Pause(int matchId)
    {
        var state = _timers.GetOrAdd(matchId, _ => new TimerState(false, 0, null));
        if (!state.Running)
        {
            return state.RemainingSeconds;
        }

        var remaining = Math.Max(0, (int)Math.Ceiling((state.EndsAtUtc - DateTime.UtcNow)?.TotalSeconds ?? 0));
        var updated = state with { Running = false, RemainingSeconds = remaining, EndsAtUtc = null };
        _ = _timers.AddOrUpdate(matchId, updated, (_, _) => updated);
        return remaining;
    }

    public MatchTimerSnapshot Resume(int matchId)
    {
        var state = _timers.GetOrAdd(matchId, _ => new TimerState(false, 0, null));
        if (state.RemainingSeconds <= 0)
        {
            return ToSnapshot(state);
        }

        var endsAt = DateTime.UtcNow.AddSeconds(state.RemainingSeconds);
        var updated = state with { Running = true, EndsAtUtc = endsAt };
        _ = _timers.AddOrUpdate(matchId, updated, (_, _) => updated);
        return ToSnapshot(updated);
    }

    public void Reset(int matchId)
    {
        var reset = new TimerState(false, 0, null);
        _timers.AddOrUpdate(matchId, reset, (_, _) => reset);
    }

    private static MatchTimerSnapshot ToSnapshot(TimerState state)
    {
        var remaining = state.Running
            ? Math.Max(0, (int)Math.Ceiling((state.EndsAtUtc - DateTime.UtcNow)?.TotalSeconds ?? state.RemainingSeconds))
            : state.RemainingSeconds;
        return new MatchTimerSnapshot(state.Running, remaining, state.Running ? state.EndsAtUtc : null);
    }
}
