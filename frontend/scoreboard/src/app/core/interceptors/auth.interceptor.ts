import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();

  if (!token) {
    return next(request);
  }

  const authorized = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authorized);
};
