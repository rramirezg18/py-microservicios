import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data?.['roles'] as Role | Role[] | undefined;

  if (!roles) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (auth.hasRole(roles)) {
    return true;
  }

  return router.createUrlTree(['/scoreboard']);
};
