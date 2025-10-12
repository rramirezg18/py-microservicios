import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TournamentMatchTeamSlot, TournamentMatchView } from '../../tournaments.models';

@Component({
  selector: 'app-tournament-match-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-card.component.html',
  styleUrl: './match-card.component.css'
})
export class MatchCardComponent {
  @Input({ required: true }) match!: TournamentMatchView;
  @Input() highlightTeamId: string | null = null;

  @Output() teamFocus = new EventEmitter<string | null>();

  protected statusClass(): string {
    switch (this.match.status) {
      case 'live':
        return 'is-live';
      case 'finished':
        return 'is-finished';
      default:
        return 'is-scheduled';
    }
  }

  protected isWinner(slot: TournamentMatchTeamSlot): boolean {
    return Boolean(slot.id && !slot.isPlaceholder && this.match.winnerId === slot.id);
  }

  protected isHighlighted(slot: TournamentMatchTeamSlot): boolean {
    return Boolean(slot.id && slot.id === this.highlightTeamId);
  }

  protected displayScore(slot: TournamentMatchTeamSlot): string {
    if (slot.score === null || slot.score === undefined) {
      return '—';
    }

    return String(slot.score);
  }

  protected handleFocus(slot: TournamentMatchTeamSlot): void {
    if (!slot.id || slot.isPlaceholder) {
      return;
    }

    this.teamFocus.emit(slot.id);
  }
}
