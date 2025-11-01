import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  TournamentSummary,
  TournamentViewModel,
  UpdateMatchRequest
} from '../../pages/tournaments/tournaments.models';

@Injectable({ providedIn: 'root' })
export class TournamentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/tournaments';

  listTournaments(refresh = false): Promise<TournamentSummary[]> {
    const suffix = refresh ? '?refresh=true' : '';
    return firstValueFrom(
      this.http.get<TournamentSummary[]>(`${this.base}${suffix}`)
    );
  }

  getTournament(id: string): Promise<TournamentViewModel> {
    const safeId = encodeURIComponent(id);
    return firstValueFrom(
      this.http.get<TournamentViewModel>(`${this.base}/${safeId}`)
    );
  }

  // Si tu backend actualiza un partido del bracket
  updateMatch(
    tournamentId: string,
    matchId: string,
    payload: UpdateMatchRequest
  ): Promise<TournamentViewModel> {
    const safeTid = encodeURIComponent(tournamentId);
    const safeMid = encodeURIComponent(matchId);
    return firstValueFrom(
      this.http.patch<TournamentViewModel>(
        `${this.base}/${safeTid}/matches/${safeMid}`,
        payload
      )
    );
  }

  // Asignar/Quitar partido a un slot del grupo
  assignMatchToSlot(
    tournamentId: string,
    groupId: string,
    slotIndex: number,
    matchId: number | null
  ): Promise<TournamentViewModel> {
    const safeTid = encodeURIComponent(tournamentId);
    const safeGid = encodeURIComponent(groupId);
    const safeSlot = Number(slotIndex);
    return firstValueFrom(
      this.http.put<TournamentViewModel>(
        `${this.base}/${safeTid}/groups/${safeGid}/slots/${safeSlot}`,
        { matchId }
      )
    );
  }
}
