import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { formatSeconds } from '../../../../core/utils/time';
import { TimerMode } from '../../../../core/services/scoreboard.service';

@Component({
  selector: 'app-timer-display',
  standalone: true,
  imports: [NgClass],
  templateUrl: './timer-display.component.html',
  styleUrl: './timer-display.component.css'
})
export class TimerDisplayComponent {
  @Input() seconds = 0;
  @Input() mode: TimerMode = 'period';

  protected get timerClass(): string {
    return this.mode === 'timeout' ? 'led led-yellow' : 'led led-green';
  }

  protected get formatted(): string {
    return formatSeconds(this.seconds);
  }
}
