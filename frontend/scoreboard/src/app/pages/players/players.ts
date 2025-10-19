import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule],
  template: `<h2>👥 Gestión de Jugadores</h2>`,
})
export class PlayersComponent {}
