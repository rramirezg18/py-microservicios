import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';   // 👈 HABILITA <mat-icon>

import { TeamService } from '../../../services/team.service';
import { Team } from '../../../models/team';
import { AuthenticationService } from '../../../core/services/authentication.service';

@Component({
  selector: 'app-team-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule, // 👈 NECESARIO PARA <mat-icon>
  ],
  templateUrl: './team-form.html',
  styleUrls: ['./team-form.scss']
})
export class TeamFormComponent implements OnInit {
  team: Team = { id: 0, name: '', color: '' };
  isEdit = false;

  constructor(
    private teamService: TeamService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthenticationService, // 👈 para logout del header
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.teamService.getById(+id).subscribe(team => (this.team = team));
    }
  }

  save() {
    if (this.isEdit) {
      this.teamService.update(this.team.id!, this.team).subscribe(() => {
        this.router.navigate(['/teams']);
      });
    } else {
      this.teamService.create(this.team).subscribe(() => {
        this.router.navigate(['/teams']);
      });
    }
  }

  // 👇 usado por el botón "Logout" del header
  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
