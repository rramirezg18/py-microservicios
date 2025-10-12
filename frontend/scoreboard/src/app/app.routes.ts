import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'scoreboard' },
      {
        path: 'scoreboard',
        loadComponent: () =>
          import('./features/scoreboard/scoreboard.component').then((m) => m.ScoreboardComponent)
      },
      {
        path: 'scoreboard/:matchId',
        loadComponent: () =>
          import('./features/scoreboard/scoreboard.component').then((m) => m.ScoreboardComponent)
      },
      {
        path: 'control',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'control'] },
        loadComponent: () =>
          import('./features/control/control-panel.component').then((m) => m.ControlPanelComponent)
      },
      {
        path: 'control/:matchId',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'control'] },
        loadComponent: () =>
          import('./features/control/control-panel.component').then((m) => m.ControlPanelComponent)
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent)
      },
      {
        path: 'players',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/players/players.component').then((m) => m.PlayersComponent)
      },
      {
        path: 'teams',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/teams/teams.component').then((m) => m.TeamsComponent)
      },
      {
        path: 'matches',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/matches/matches-admin.component').then((m) => m.MatchesAdminComponent)
      },
      {
        path: 'tournaments',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/tournaments/tournaments.component').then((m) => m.TournamentsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'scoreboard' }
];
