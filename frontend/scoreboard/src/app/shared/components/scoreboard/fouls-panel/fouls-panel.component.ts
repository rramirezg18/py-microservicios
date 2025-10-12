import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-fouls-panel',
  standalone: true,
  templateUrl: './fouls-panel.component.html',
  styleUrl: './fouls-panel.component.css'
})
export class FoulsPanelComponent {
  @Input() fouls = 0;
}
