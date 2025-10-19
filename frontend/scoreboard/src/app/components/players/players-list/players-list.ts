import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { PlayerService } from '../../../services/player.service';
import { Player } from '../../../models/player';
import { AuthenticationService } from '../../../core/services/authentication.service';

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './players-list.html',
  styleUrls: ['./players-list.scss']
})
export class PlayersListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'number', 'name', 'teamName', 'actions'];
  dataSource: Player[] = [];

  totalItems = 0;
  page = 1;
  pageSize = 10;

  teamId: number | null = null;
  search = '';

  private playerService = inject(PlayerService);
  private auth = inject(AuthenticationService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadPlayers();
  }

  loadPlayers(): void {
    this.playerService.getPlayers(this.page, this.pageSize).subscribe(res => {
      let players = res.items ?? [];

      if (this.teamId) {
        players = players.filter(p => p.teamId === this.teamId);
      }
      if (this.search?.trim()) {
        const q = this.search.toLowerCase();
        players = players.filter(p =>
          (p.name ?? '').toLowerCase().includes(q) ||
          String(p.number ?? '').includes(q)
        );
      }

      this.dataSource = players;
      this.totalItems = res.totalCount ?? players.length;
    });
  }

  applyFilter(): void {
    this.page = 1;
    this.loadPlayers();
  }

  onPageChange(e: PageEvent): void {
    this.page = e.pageIndex + 1;
    this.pageSize = e.pageSize;
    this.loadPlayers();
  }

  deletePlayer(id: number): void {
    if (!confirm('¿Eliminar jugador?')) return;
    this.playerService.delete(id).subscribe(() => this.loadPlayers());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
