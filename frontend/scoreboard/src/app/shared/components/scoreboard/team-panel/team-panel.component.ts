import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-team-panel',
  standalone: true,
  templateUrl: './team-panel.component.html',
  styleUrl: './team-panel.component.css'
})
export class TeamPanelComponent {
  @Input() label = '';
  @Input() score = 0;
}
