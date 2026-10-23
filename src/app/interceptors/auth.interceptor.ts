import { inject } from '@angular/core';
import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService, httpErrorText } from '../services/auth.service';

const LOG = '[AuthInterceptor]';

/** Gắn Firebase ID token (header X-Id-Token) cho mọi request lên TapHoa39KeToanBackEnd. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendUrl(req.url)) {
    return next(req);
  }
  const logAuthError = tap<HttpEvent<unknown>>({
    error: (err: any) => {
      if (err?.status === 401 || err?.status === 403) {
        console.warn(`${LOG} ${req.method} ${req.url}: BE từ chối — ${httpErrorText(err)}`);
      }
    }
  });
  if (req.headers.has('X-Id-Token')) {
    return next(req).pipe(logAuthError);
  }
  const authService = inject(AuthService);
  return from(authService.getIdToken()).pipe(
    switchMap(token => {
      if (!token) {
        console.warn(`${LOG} ${req.method} ${req.url}: chưa có ID token — gửi không kèm đăng nhập`);
        return next(req);
      }
      console.debug(`${LOG} ${req.method} ${req.url}: gắn X-Id-Token`);
      return next(req.clone({ setHeaders: { 'X-Id-Token': token } }));
    }),
    logAuthError
  );
};

function isBackendUrl(url: string): boolean {
  const bases = [environment.ketoanBackendUrl, environment.apiUrl, environment.domainUrl].filter(Boolean);
  return url.startsWith('/') || bases.some(base => url.startsWith(base));
}
