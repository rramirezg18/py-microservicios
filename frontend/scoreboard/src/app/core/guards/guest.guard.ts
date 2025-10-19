import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';
import { isJwtExpired } from '../utils/jwt';

export const guestGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;

  const token = auth.getToken();
  if (token && !isJwtExpired(token, 60)) {
    router.navigate([ auth.isAdmin() ? '/admin' : '/score/1' ]);
    return false;
  }
  return true;
};
