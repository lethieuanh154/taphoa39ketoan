import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Chờ biết trạng thái đăng nhập; chưa đăng nhập → /login?returnUrl=... */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.authState$.pipe(
    filter(s => s.ready),
    take(1),
    map(s => {
      if (s.user) return true;
      console.info(`[AuthGuard] Chưa đăng nhập → /login (returnUrl=${state.url})`);
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    })
  );
};

/** Đã đăng nhập thì không vào lại trang /login. */
export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.authState$.pipe(
    filter(s => s.ready),
    take(1),
    map(s => {
      if (!s.user) return true;
      console.info(`[AuthGuard] Đã đăng nhập (${s.user.email}) → /accountant-dashboard`);
      return router.createUrlTree(['/accountant-dashboard']);
    })
  );
};
