import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return next(req);

  const token = auth.getToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError(err => {
      if (err?.status === 401) {
        const returnUrl = location.pathname + location.search;
        console.warn('[interceptor 401] redirect -> /login?returnUrl=', returnUrl);
        // 👇 sólo redirigir, NO logout
        router.navigate(['/login'], { queryParams: { returnUrl } });
      }
      return throwError(() => err);
    })
  );
};
