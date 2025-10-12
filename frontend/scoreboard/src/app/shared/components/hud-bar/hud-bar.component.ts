import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hud-bar',
  standalone: true,
  imports: [RouterLink, NgIf],
  templateUrl: './hud-bar.component.html',
  styleUrl: './hud-bar.component.css'
})
export class HudBarComponent {
  @Input() isAdmin = false;
  @Input() matchId?: string | null;
  @Output() readonly logout = new EventEmitter<void>();

  get controlLink(): string {
    return this.matchId ? `/control/${this.matchId}` : '/control';
  }

  onLogout(): void {
    this.logout.emit();
  }
}
