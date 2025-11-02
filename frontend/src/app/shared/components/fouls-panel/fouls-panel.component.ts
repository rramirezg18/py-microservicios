import { CommonModule } from '@angular/common';
import { Component, Input, signal, computed, effect, inject } from '@angular/core';
import { RealtimeService } from '@app/services/realtime.service';

@Component({
  selector: 'app-fouls-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fouls-panel.component.html',
  styleUrls: ['./fouls-panel.component.css']
})
export class FoulsPanelComponent {
  private rt = inject(RealtimeService);

  /** Lado (home o away) */
  @Input({ required: true }) side: 'home' | 'away' = 'home';

  /** Señales de faltas */
  foulsHome = computed(() => this.rt.fouls().home);
  foulsAway = computed(() => this.rt.fouls().away);

  /** Valor mostrado según lado */
  value = computed(() => {
    return this.side === 'home' ? this.foulsHome() : this.foulsAway();
  });
}
