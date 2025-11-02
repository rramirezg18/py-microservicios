import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private hub?: signalR.HubConnection;
  private tick?: any;

  private readonly isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined';

  // ============ 🧮 Estado general ============
  score = signal<{ home: number; away: number }>({ home: 0, away: 0 });
  timeLeft = signal(0);
  timerRunning = signal(false);
  quarter = signal(1);
  fouls = signal<{ home: number; away: number }>({ home: 0, away: 0 });

  timeoutLeft = signal(0);
  timeoutRunning = signal(false);

  gameOver = signal<{
    home: number;
    away: number;
    winner: 'home' | 'away' | 'draw';
  } | null>(null);

  private endsAt?: number;
  private timeoutEndsAt?: number;
  private timeoutTick?: any;
  private audioCtx?: AudioContext;

  // ==================================================
  // 🧭 UTILIDADES
  // ==================================================
  public beep() {
    this.playBuzzer();
  }

  private playBuzzer() {
    if (!this.isBrowser) return;
    try {
      this.audioCtx ??= new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch {
      /* ignore */
    }
  }

  // ==================================================
  // ⏱️ TIMER PRINCIPAL
  // ==================================================
  private startTick() {
    this.stopTick();
    this.tick = setInterval(() => {
      if (!this.timerRunning() || !this.endsAt) return;
      const secs = Math.max(0, Math.floor((this.endsAt - Date.now()) / 1000));
      this.timeLeft.set(secs);
      if (secs === 0) {
        this.timerRunning.set(false);
        this.stopTick();
        this.endsAt = undefined;
        if (this.quarter() === 4) {
          const { home, away } = this.score();
          const winner = home === away ? 'draw' : home > away ? 'home' : 'away';
          this.gameOver.set({ home, away, winner });
        }
      }
    }, 200);
  }

  private stopTick() {
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = undefined;
    }
  }

  // ==================================================
  // 🕐 TIMEOUTS
  // ==================================================
  startTimeout(seconds: number, onDone?: () => void) {
    this.stopTimeout();
    if (seconds <= 0) return;
    this.timeoutLeft.set(seconds);
    this.timeoutRunning.set(true);
    this.timeoutEndsAt = Date.now() + seconds * 1000;

    this.timeoutTick = setInterval(() => {
      const s = Math.max(0, Math.floor((this.timeoutEndsAt! - Date.now()) / 1000));
      this.timeoutLeft.set(s);
      if (s === 0) {
        this.stopTimeout();
        onDone?.();
      }
    }, 200);
  }

  private stopTimeout() {
    if (this.timeoutTick) clearInterval(this.timeoutTick);
    this.timeoutTick = undefined;
    this.timeoutEndsAt = undefined;
    this.timeoutLeft.set(0);
    this.timeoutRunning.set(false);
  }

  // ==================================================
  // 💾 HIDRATAR SNAPSHOT
  // ==================================================
  hydrateTimerFromSnapshot(snap?: {
    running: boolean;
    remainingSeconds: number;
    quarterEndsAtUtc?: string | null;
    quarter?: number;
  }) {
    if (!snap) return;
    this.stopTimeout();
    this.gameOver.set(null);

    if (typeof snap.quarter === 'number') this.quarter.set(snap.quarter);

    const secs = snap.remainingSeconds ?? 0;
    this.timeLeft.set(secs);

    if (snap.running && secs > 0) {
      this.timerRunning.set(true);
      this.endsAt = Date.now() + secs * 1000;
      this.startTick();
    } else {
      this.timerRunning.set(false);
      this.endsAt = undefined;
      this.stopTick();
    }
  }

  hydrateFoulsFromSnapshot(snap?: { home: number; away: number }) {
    if (!snap) return;
    this.fouls.set({ home: snap.home ?? 0, away: snap.away ?? 0 });
  }

  // ==================================================
  // 🌐 SIGNALR HUB
  // ==================================================
  get hubConnection() {
    return this.hub;
  }

  async connect(matchId: number) {
    if (!this.isBrowser) return;
    if (this.hub) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`/hub/matches?matchId=${matchId}`, {
        withCredentials: false,
        // accessTokenFactory: () => localStorage.getItem('token') || ''
      })
      .configureLogging(signalR.LogLevel.Information)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    // 📡 Eventos del ciclo de vida
    this.hub.onreconnecting(err =>
      console.warn('[SignalR] 🔄 Reconectando...', err)
    );
    this.hub.onreconnected(id => {
      console.log('[SignalR] 🔁 Reconexion completa', id);
    });
    this.hub.onclose(err => console.warn('[SignalR] ❌ Conexión cerrada', err));

    // 📢 Eventos del backend
    this.hub.on('scoreUpdated', (s: { homeScore: number; awayScore: number }) => {
      this.score.set({ home: s.homeScore, away: s.awayScore });
    });

    this.hub.on('timerStarted', (t: { remainingSeconds: number }) => {
      this.stopTimeout();
      this.timeLeft.set(t.remainingSeconds);
      this.timerRunning.set(true);
      this.endsAt = Date.now() + t.remainingSeconds * 1000;
      this.startTick();
    });

    this.hub.on('timerPaused', (t: { remainingSeconds: number }) => {
      this.timeLeft.set(t.remainingSeconds);
      this.timerRunning.set(false);
      this.stopTick();
      this.endsAt = undefined;
    });

    this.hub.on('timerResumed', (t: { remainingSeconds: number }) => {
      this.stopTimeout();
      this.timeLeft.set(t.remainingSeconds);
      this.timerRunning.set(true);
      this.endsAt = Date.now() + t.remainingSeconds * 1000;
      this.startTick();
    });

    this.hub.on('timerReset', (t: { remainingSeconds: number }) => {
      this.stopTimeout();
      this.timeLeft.set(t.remainingSeconds);
      this.timerRunning.set(false);
      this.stopTick();
      this.endsAt = undefined;
    });

    this.hub.on('matchUpdated', (p: { quarter?: number }) => {
      if (typeof p?.quarter === 'number') this.quarter.set(p.quarter);
    });

    this.hub.on('quarterChanged', (p: { quarter: number }) => {
      if (typeof p.quarter === 'number') this.quarter.set(p.quarter);
    });

    // 🚫 Faltas
    this.hub.on('foulsUpdated', (p: any) => {
      const home = p.homeFouls ?? p.foulsHome ?? p.home ?? 0;
      const away = p.awayFouls ?? p.foulsAway ?? p.away ?? 0;
      this.fouls.set({ home, away });
      console.log('[SignalR] ⚠️ foulsUpdated recibido', { home, away });
    });

    // 🔔 Buzzer / fin
    this.hub.on('buzzer', () => this.playBuzzer());
    this.hub.on('gameEnded', (p: { home: number; away: number; winner: 'home' | 'away' | 'draw' }) => {
      this.gameOver.set(p);
    });

    // Conectar
    await this.hub.start();

    try {
      await this.hub.invoke('JoinMatch', matchId);
      console.log(`[SignalR] ✅ joined match group match-${matchId}`);
    } catch (e) {
      console.error('[SignalR] JoinMatch failed', e);
    }
  }

  async disconnect() {
    this.stopTick();
    this.stopTimeout();
    if (this.hub) {
      try {
        await this.hub.stop();
        console.log('[SignalR] 🔌 Desconectado');
      } finally {
        this.hub = undefined;
      }
    }
  }
}
