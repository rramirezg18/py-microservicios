// src/app/services/api/matches.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TeamSide = 'home' | 'away';

export interface MatchModel {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  foulsHome: number;
  foulsAway: number;
  quarter: number;
  timeRemaining: number;
  timerRunning: boolean;
  status: string;
  dateTime: string;
}

export interface ProgramMatchPayload {
  homeTeamId: number;
  awayTeamId: number;
  /** Fecha en formato YYYY-MM-DD (input type="date") */
  date: string;
  /** Hora en formato HH:mm (input type="time") */
  time: string;
  quarterDurationSeconds?: number;
}

// DTO interno para lo que espera el backend
interface ProgramMatchDto {
  homeTeamId: number;
  awayTeamId: number;
  /** ISO local sin Z: 2025-11-02T15:00:00 */
  dateMatch: string;
  quarterDurationSeconds?: number;
}

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/matches';

  getMatches(): Observable<MatchModel[]> {
    return this.http.get<MatchModel[]>(this.baseUrl);
  }

  getMatch(matchId: number): Observable<MatchModel> {
    return this.http.get<MatchModel>(`${this.baseUrl}/${matchId}`);
  }

  /**
   * Combina date(YYYY-MM-DD) y time(HH:mm) a `dateMatch` (YYYY-MM-DDTHH:mm:00)
   * y lo envía al endpoint que ahora lo exige en ISO 8601.
   */
  programMatch(payload: ProgramMatchPayload): Observable<MatchModel> {
    const { date, time, homeTeamId, awayTeamId, quarterDurationSeconds } = payload;

    // Validación simple
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      throw new Error('Fecha u hora inválida. Usa YYYY-MM-DD y HH:mm');
    }

    // Construimos ISO local (sin 'Z' para evitar conversiones a UTC)
    const dateMatch = `${date}T${time}:00`;

    const body: ProgramMatchDto = {
      homeTeamId,
      awayTeamId,
      dateMatch,
      quarterDurationSeconds
    };

    return this.http.post<MatchModel>(`${this.baseUrl}/programar`, body);
  }

  // --- Resto de endpoints que ya tenías ---

  addScore(matchId: number, team: TeamSide, points: number): Observable<MatchModel> {
    return this.http.post<MatchModel>(`${this.baseUrl}/${matchId}/score`, { team, points });
  }

  addFoul(matchId: number, team: TeamSide, amount: number = 1): Observable<MatchModel> {
    return this.http.post<MatchModel>(`${this.baseUrl}/${matchId}/foul`, { team, amount });
  }

  updateTimer(
    matchId: number,
    action: 'start' | 'pause' | 'resume' | 'reset' | 'set',
    timeRemaining?: number
  ): Observable<MatchModel> {
    const body: any = { action };
    if (typeof timeRemaining === 'number') {
      body.timeRemaining = timeRemaining;
    }
    return this.http.patch<MatchModel>(`${this.baseUrl}/${matchId}/timer`, body);
  }

  nextQuarter(matchId: number): Observable<MatchModel> {
    return this.http.patch<MatchModel>(`${this.baseUrl}/${matchId}/quarter`, {});
  }

  finishMatch(
    matchId: number,
    scores?: { homeScore?: number; awayScore?: number }
  ): Observable<MatchModel> {
    return this.http.patch<MatchModel>(`${this.baseUrl}/${matchId}/finish`, scores ?? {});
  }
}
