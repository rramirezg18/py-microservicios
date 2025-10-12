import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import {
  MatchDetailDto,
  MatchesApiService,
  MatchTimerDto
} from './matches-api.service';

export type Possession = 'home' | 'away' | 'none';
export type TimerMode = 'period' | 'timeout';

export interface TeamState {
  id?: string;
  name: string;
  score: number;
  fouls: number;
  timeouts: number;
}

export interface TimerState {
  periodDuration: number;
  periodRemaining: number;
  running: boolean;
  mode: TimerMode;
  timeoutRemaining: number;
  timeoutDuration: number;
}

export interface ScoreboardState {
  home: TeamState;
  away: TeamState;
  quarter: number;
  maxQuarters: number;
  possession: Possession;
  timer: TimerState;
  gameOver: boolean;
}

const STORAGE_KEY = 'scoreboard.state';
const DEFAULT_PERIOD = 10 * 60;

const defaultState: ScoreboardState = {
  home: { name: 'Local', score: 0, fouls: 0, timeouts: 0 },
  away: { name: 'Visitante', score: 0, fouls: 0, timeouts: 0 },
  quarter: 1,
  maxQuarters: 4,
  possession: 'none',
  timer: {
    periodDuration: DEFAULT_PERIOD,
    periodRemaining: DEFAULT_PERIOD,
    running: false,
    mode: 'period',
    timeoutRemaining: 0,
    timeoutDuration: 0
  },
  gameOver: false
};

type Action =
  | { type: 'set-state'; payload: ScoreboardState }
  | { type: 'reset' }
  | { type: 'set-team-name'; payload: { team: 'home' | 'away'; name: string } }
  | { type: 'adjust-score'; payload: { team: 'home' | 'away'; delta: number } }
  | { type: 'adjust-fouls'; payload: { team: 'home' | 'away'; delta: number } }
  | { type: 'set-quarter'; payload: number }
  | { type: 'change-quarter'; payload: number }
  | { type: 'set-possession'; payload: Possession }
  | { type: 'start-period' }
  | { type: 'resume-timer' }
  | { type: 'stop-timer' }
  | { type: 'reset-timer' }
  | { type: 'start-timeout'; payload: number }
  | { type: 'tick' }
  | { type: 'set-game-over'; payload: boolean };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mergeState(stored: ScoreboardState): ScoreboardState {
  return {
    ...defaultState,
    ...stored,
    home: { ...defaultState.home, ...stored.home },
    away: { ...defaultState.away, ...stored.away },
    timer: { ...defaultState.timer, ...stored.timer }
  };
}

function reducer(state: ScoreboardState, action: Action): ScoreboardState {
  switch (action.type) {
    case 'set-state':
      return { ...action.payload };
    case 'reset':
      return { ...defaultState };
    case 'set-team-name': {
      const { team, name } = action.payload;
      return {
        ...state,
        [team]: { ...state[team], name }
      };
    }
    case 'adjust-score': {
      const { team, delta } = action.payload;
      const score = Math.max(0, state[team].score + delta);
      return {
        ...state,
        [team]: { ...state[team], score }
      };
    }
    case 'adjust-fouls': {
      const { team, delta } = action.payload;
      const fouls = Math.max(0, state[team].fouls + delta);
      return {
        ...state,
        [team]: { ...state[team], fouls }
      };
    }
    case 'set-quarter':
      return {
        ...state,
        quarter: clamp(action.payload, 1, state.maxQuarters),
        gameOver: false
      };
    case 'change-quarter':
      return {
        ...state,
        quarter: clamp(state.quarter + action.payload, 1, state.maxQuarters),
        gameOver: false
      };
    case 'set-possession':
      return {
        ...state,
        possession: action.payload
      };
    case 'start-period':
      return {
        ...state,
        possession: 'none',
        gameOver: false,
        timer: {
          ...state.timer,
          mode: 'period',
          running: true,
          periodRemaining: state.timer.periodDuration,
          timeoutRemaining: 0,
          timeoutDuration: 0
        }
      };
    case 'resume-timer':
      return {
        ...state,
        timer: {
          ...state.timer,
          mode: 'period',
          running: state.timer.periodRemaining > 0
        }
      };
    case 'stop-timer':
      return {
        ...state,
        timer: { ...state.timer, running: false }
      };
    case 'reset-timer':
      return {
        ...state,
        timer: {
          ...state.timer,
          running: false,
          mode: 'period',
          periodRemaining: state.timer.periodDuration,
          timeoutRemaining: 0,
          timeoutDuration: 0
        },
        possession: 'none',
        gameOver: false
      };
    case 'start-timeout':
      return {
        ...state,
        timer: {
          ...state.timer,
          mode: 'timeout',
          running: true,
          timeoutDuration: action.payload,
          timeoutRemaining: action.payload
        },
        gameOver: false
      };
    case 'tick': {
      if (!state.timer.running) {
        return state;
      }
      if (state.timer.mode === 'timeout') {
        const next = Math.max(0, state.timer.timeoutRemaining - 1);
        return {
          ...state,
          timer: {
            ...state.timer,
            timeoutRemaining: next,
            running: next > 0,
            mode: next > 0 ? 'timeout' : 'period'
          }
        };
      }
      const next = Math.max(0, state.timer.periodRemaining - 1);
      const finished = next === 0;
      return {
        ...state,
        timer: {
          ...state.timer,
          periodRemaining: next,
          running: next > 0
        },
        gameOver: finished && state.quarter >= state.maxQuarters ? true : state.gameOver
      };
    }
    case 'set-game-over':
      return {
        ...state,
        gameOver: action.payload
      };
    default:
      return state;
  }
}

@Injectable({ providedIn: 'root' })
export class ScoreboardService {
  private readonly matchesApi = inject(MatchesApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<ScoreboardState>(this.loadInitialState());
  private readonly matchIdSignal = signal<number | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly snapshot = this.state.asReadonly();
  readonly home = computed(() => this.state().home);
  readonly away = computed(() => this.state().away);
  readonly timer = computed(() => this.state().timer);
  readonly quarter = computed(() => this.state().quarter);
  readonly possession = computed(() => this.state().possession);
  readonly gameOver = computed(() => this.state().gameOver);
  readonly matchId = this.matchIdSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly isRemote = computed(() => this.matchIdSignal() !== null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const current = this.state();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      });

      const intervalId = window.setInterval(() => this.dispatch({ type: 'tick' }), 1000);
      this.destroyRef.onDestroy(() => window.clearInterval(intervalId));
    }
  }

  async loadMatch(matchId: string | number | null): Promise<void> {
    if (matchId === null || matchId === undefined || matchId === '') {
      this.matchIdSignal.set(null);
      this.errorSignal.set(null);
      this.dispatch({ type: 'reset' });
      return;
    }

    const numeric = Number(matchId);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      this.errorSignal.set('Identificador de partido inválido.');
      this.matchIdSignal.set(null);
      this.dispatch({ type: 'reset' });
      return;
    }

    this.loadingSignal.set(true);
    try {
      const detail = await this.matchesApi.getMatch(numeric);
      this.matchIdSignal.set(numeric);
      this.applyRemoteDetail(detail);
      this.errorSignal.set(null);
    } catch (error) {
      console.error('Failed to load match', error);
      this.errorSignal.set('No se pudo cargar el partido seleccionado.');
      this.matchIdSignal.set(null);
      this.dispatch({ type: 'reset' });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async refreshMatch(): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      return;
    }

    try {
      const detail = await this.matchesApi.getMatch(matchId);
      this.applyRemoteDetail(detail);
    } catch (error) {
      console.error('Failed to refresh match', error);
    }
  }

  getState(): ScoreboardState {
    return this.state();
  }

  setState(next: ScoreboardState): void {
    this.dispatch({ type: 'set-state', payload: next });
  }

  resetAll(): void {
    if (this.isRemote()) {
      void this.refreshMatch();
      return;
    }
    this.dispatch({ type: 'reset' });
  }

  setTeamName(team: 'home' | 'away', name: string): void {
    this.dispatch({ type: 'set-team-name', payload: { team, name } });
  }

  async adjustScore(team: 'home' | 'away', delta: number): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'adjust-score', payload: { team, delta } });
      return;
    }

    const teamId = this.resolveTeamId(team);
    if (!teamId) {
      return;
    }

    try {
      const detail = await this.matchesApi.adjustScore(matchId, { teamId, delta });
      this.applyRemoteDetail(detail);
    } catch (error) {
      console.error('Failed to adjust score', error);
    }
  }

  async adjustFouls(team: 'home' | 'away', delta: number): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'adjust-fouls', payload: { team, delta } });
      return;
    }

    const teamId = this.resolveTeamId(team);
    if (!teamId) {
      return;
    }

    try {
      const detail = await this.matchesApi.adjustFouls(matchId, { teamId, delta });
      this.applyRemoteDetail(detail);
    } catch (error) {
      console.error('Failed to adjust fouls', error);
    }
  }

  async setQuarter(quarter: number): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'set-quarter', payload: quarter });
      return;
    }

    try {
      const detail = await this.matchesApi.setQuarter(matchId, { quarter });
      this.applyRemoteDetail(detail);
    } catch (error) {
      console.error('Failed to set quarter', error);
    }
  }

  async changeQuarter(delta: number): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'change-quarter', payload: delta });
      return;
    }

    const currentQuarter = this.state().quarter;
    await this.setQuarter(currentQuarter + delta);
  }

  setPossession(possession: Possession): void {
    this.dispatch({ type: 'set-possession', payload: possession });
  }

  async startPeriod(): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'start-period' });
      return;
    }

    try {
      const periodDuration = this.state().timer.periodDuration;
      const timer = await this.matchesApi.startTimer(matchId, { quarterDurationSeconds: periodDuration });
      this.applyTimerSnapshot(timer);
      await this.refreshMatch();
    } catch (error) {
      console.error('Failed to start match timer', error);
    }
  }

  async resumeTimer(): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'resume-timer' });
      return;
    }

    try {
      const timer = await this.matchesApi.resumeTimer(matchId);
      this.applyTimerSnapshot(timer);
      await this.refreshMatch();
    } catch (error) {
      console.error('Failed to resume timer', error);
    }
  }

  async stopTimer(): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'stop-timer' });
      return;
    }

    try {
      const response = await this.matchesApi.pauseTimer(matchId);
      this.state.update((current) => ({
        ...current,
        timer: {
          ...current.timer,
          running: false,
          mode: 'period',
          periodRemaining: Math.max(0, response.remainingSeconds),
          timeoutRemaining: 0,
          timeoutDuration: 0
        }
      }));
    } catch (error) {
      console.error('Failed to pause timer', error);
    }
  }

  async resetTimer(): Promise<void> {
    const matchId = this.matchIdSignal();
    if (!matchId) {
      this.dispatch({ type: 'reset-timer' });
      return;
    }

    try {
      const timer = await this.matchesApi.resetTimer(matchId);
      this.applyTimerSnapshot(timer);
      await this.refreshMatch();
    } catch (error) {
      console.error('Failed to reset timer', error);
    }
  }

  startTimeout(seconds: number): void {
    this.dispatch({ type: 'start-timeout', payload: seconds });
  }

  setGameOver(gameOver: boolean): void {
    this.dispatch({ type: 'set-game-over', payload: gameOver });
  }

  private resolveTeamId(team: 'home' | 'away'): number | null {
    const state = this.state();
    const id = team === 'home' ? state.home.id : state.away.id;
    if (!id) {
      return null;
    }
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private applyRemoteDetail(detail: MatchDetailDto): void {
    const current = this.state();
    this.state.set({
      ...current,
      home: {
        ...current.home,
        id: String(detail.home.id),
        name: detail.home.name,
        score: detail.homeScore,
        fouls: detail.homeFouls
      },
      away: {
        ...current.away,
        id: String(detail.away.id),
        name: detail.away.name,
        score: detail.awayScore,
        fouls: detail.awayFouls
      },
      quarter: detail.period,
      timer: {
        ...current.timer,
        periodDuration: detail.quarterDurationSeconds,
        periodRemaining: detail.timer.remainingSeconds,
        running: detail.timer.running,
        mode: 'period',
        timeoutRemaining: 0,
        timeoutDuration: 0
      },
      gameOver: detail.status === 'Finished'
    });
  }

  private applyTimerSnapshot(timer: MatchTimerDto): void {
    this.state.update((current) => ({
      ...current,
      timer: {
        ...current.timer,
        running: timer.running,
        periodRemaining: timer.remainingSeconds,
        mode: 'period',
        timeoutRemaining: 0,
        timeoutDuration: 0
      }
    }));
  }

  private dispatch(action: Action): void {
    this.state.update((current) => reducer(current, action));
  }

  private loadInitialState(): ScoreboardState {
    if (!isPlatformBrowser(this.platformId)) {
      return { ...defaultState };
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return mergeState(JSON.parse(stored) as ScoreboardState);
      }
    } catch (error) {
      console.warn('Failed to parse scoreboard state', error);
      window.localStorage.removeItem(STORAGE_KEY);
    }

    return { ...defaultState };
  }
}
