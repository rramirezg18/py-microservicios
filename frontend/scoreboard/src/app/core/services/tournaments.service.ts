import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Tournament {
  id: number;
  name: string;
  season?: string;
  status?: string; // Scheduled | Live | Finished | etc
}

export interface Page<T> {
  items: T[];
  totalCount: number;
}

export interface TournamentsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class TournamentsService {
  private apiUrl = '/api/tournaments';

  constructor(private http: HttpClient) {}

  list(query: TournamentsQuery): Observable<Page<Tournament>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 10));

    if (query.q) params = params.set('q', query.q);

    return this.http.get<Page<Tournament> | Tournament[]>(this.apiUrl, { params })
      .pipe(
        map(res =>
          Array.isArray(res)
            ? { items: res, totalCount: res.length }
            : { items: res.items ?? [], totalCount: res.totalCount ?? (res.items?.length ?? 0) }
        )
      );
  }
}
