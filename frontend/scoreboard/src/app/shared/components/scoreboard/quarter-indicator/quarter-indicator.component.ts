import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-quarter-indicator',
  standalone: true,
  templateUrl: './quarter-indicator.component.html',
  styleUrl: './quarter-indicator.component.css'
})
export class QuarterIndicatorComponent {
  @Input() quarter = 1;
}
