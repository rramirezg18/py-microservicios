import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Player } from '../models/player';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {

  private apiUrl = '/api/players';
  // private apiUrl = 'http://localhost:5003/api/players';

  constructor(private http: HttpClient) {}

  /** Lista paginada con filtros (tu método original) */
  getPlayers(
    page: number,
    pageSize: number,
    teamId?: number,
    search?: string
  ): Observable<{ items: Player[]; totalCount: number }> {
    let url = `${this.apiUrl}?page=${page}&pageSize=${pageSize}`;
    if (teamId) url += `&teamId=${teamId}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search)}`;
    return this.http.get<{ items: Player[]; totalCount: number }>(url);
  }

  /** Helper: jugadores de un equipo (conveniente para selects/rosters) */
  getByTeam(teamId: number): Observable<Player[]> {
    // Pido una página grande. Si el backend limita, ajusta el pageSize
    return this.getPlayers(1, 1000, teamId).pipe(map(r => r.items));
  }

  getById(id: number): Observable<Player> {
    return this.http.get<Player>(`${this.apiUrl}/${id}`);
  }

  create(player: Player): Observable<Player> {
    return this.http.post<Player>(this.apiUrl, player);
  }

  update(id: number, player: Player): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, player);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
