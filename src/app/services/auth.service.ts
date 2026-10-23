import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, User, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { BehaviorSubject, Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TienIchCacheService } from './tien-ich-cache.service';

export interface AuthState {
  ready: boolean;     // đã biết trạng thái đăng nhập (Firebase + KeToanBackEnd /api/auth/me)
  user: User | null;  // chỉ có khi email đã qua whitelist của BE
}

export interface GmailStatus {
  account: string;          // hộp thư hóa đơn (GMAIL_INVOICE_ACCOUNT)
  hasTokens: boolean;
  hasRefreshToken: boolean; // false → cần kết nối Gmail 1 lần (connectGmail)
}

const AUTH_APP_NAME = 'ketoan-auth';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const LOG = '[Auth]';

/** Lỗi HTTP từ BE → "HTTP 403 — Email không được phép truy cập" (để log / hiện cho người dùng). */
export function httpErrorText(e: any): string {
  const detail = e?.error?.detail || e?.error?.error || e?.message || '';
  return `HTTP ${e?.status ?? '?'}${detail ? ' — ' + detail : ''}`;
}

/**
 * ĐĂNG NHẬP GOOGLE — Firebase Auth project quanlysongminh (cùng project BanHang / Management → cùng uid).
 * Email phải qua whitelist của KeToanBackEnd (GET /api/auth/me). Mọi request lên BE gửi kèm X-Id-Token (authInterceptor).
 * Đăng nhập kiêm Gmail (gmail.readonly): access token ~1 giờ → POST /api/gmail/auth/save; refresh token lấy 1 lần qua connectGmail().
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private tienIchCache = inject(TienIchCacheService);
  private readonly api = environment.ketoanBackendUrl;
  private readonly app: FirebaseApp = getApps().some(a => a.name === AUTH_APP_NAME)
    ? getApp(AUTH_APP_NAME)
    : initializeApp(environment.firebaseGmail, AUTH_APP_NAME);
  private readonly auth: Auth = getAuth(this.app);
  private state$ = new BehaviorSubject<AuthState>({ ready: false, user: null });
  private verifying: { uid: string; promise: Promise<void> } | null = null;

  readonly authState$: Observable<AuthState> = this.state$.asObservable();

  constructor() {
    console.info(`${LOG} Khởi tạo: Firebase project=${environment.firebaseGmail.projectId}, BE=${this.api || '(cùng origin)'}`);
    onAuthStateChanged(this.auth, user => this.zone.run(() => this.onUserChanged(user)));
  }

  get currentUser(): User | null {
    return this.state$.value.user;
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.addScope(GMAIL_SCOPE);
    provider.setCustomParameters({ prompt: 'select_account' });
    console.info(`${LOG} Mở popup đăng nhập Google`);
    let result;
    try {
      result = await signInWithPopup(this.auth, provider);
    } catch (e: any) {
      console.warn(`${LOG} Popup Google lỗi: ${e?.code || e?.message || e}`);
      throw e;
    }
    const email = result.user.email || '';
    console.info(`${LOG} Google OK: ${email} (uid=${result.user.uid}) → kiểm whitelist ở BE`);
    try {
      await this.verifyWithBackend(result.user);
    } catch (e: any) {
      console.error(`${LOG} BE từ chối đăng nhập ${email}: ${httpErrorText(e)}`);
      if (e?.status === 403) {
        await signOut(this.auth);
        throw new Error(`Email ${email} không có trong danh sách được phép truy cập KeToan`);
      }
      if (e?.status === 401) {
        await signOut(this.auth);
        throw new Error(`Máy chủ KeToan không chấp nhận đăng nhập: ${e?.error?.detail || 'ID token không hợp lệ'}`);
      }
      throw new Error(`Không kiểm được đăng nhập — máy chủ KeToan không phản hồi (${httpErrorText(e)})`);
    }
    console.info(`${LOG} Đăng nhập thành công: ${email}`);
    this.state$.next({ ready: true, user: result.user });

    const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!accessToken) {
      console.warn(`${LOG} Popup Google không trả access token Gmail — bỏ qua bước lưu token`);
      return;
    }
    this.http.post<{ saved: boolean; reason?: string }>(`${this.api}/api/gmail/auth/save`, { accessToken }).subscribe({
      next: res => console.info(`${LOG} Lưu access token Gmail: ${res?.saved ? 'đã lưu' : 'bỏ qua — ' + (res?.reason || '')}`),
      error: err => console.warn(`${LOG} Lưu access token Gmail lỗi: ${httpErrorText(err)}`)
    });
  }

  async logout(): Promise<void> {
    console.info(`${LOG} Đăng xuất ${this.currentUser?.email || ''}`);
    await signOut(this.auth);
    await this.tienIchCache.clearAll();
    this.verifying = null;
    this.state$.next({ ready: true, user: null });
    this.router.navigate(['/login']);
  }

  /** ID token của phiên Firebase hiện tại (tự làm mới khi sắp hết hạn) — dùng cho authInterceptor. */
  async getIdToken(): Promise<string | null> {
    await this.auth.authStateReady();
    return this.auth.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  getGmailStatus(): Observable<GmailStatus> {
    return this.http.get<GmailStatus>(`${this.api}/api/gmail/auth/status`).pipe(
      tap({
        next: s => console.info(`${LOG} Gmail hộp thư ${s.account || '(chưa cấu hình)'}: hasTokens=${s.hasTokens}, hasRefreshToken=${s.hasRefreshToken}`),
        error: err => console.warn(`${LOG} Lấy trạng thái Gmail lỗi: ${httpErrorText(err)}`)
      })
    );
  }

  /**
   * Popup cấp quyền Gmail cho hộp thư hóa đơn (lấy refresh token, chỉ cần 1 lần). Gọi trực tiếp trong handler click
   * để trình duyệt không chặn popup. Kết quả cuối cùng: gọi lại getGmailStatus().
   */
  connectGmail(): Promise<boolean> {
    const popup = window.open('', 'gmail_auth', 'width=500,height=620,scrollbars=yes');
    if (!popup) {
      console.warn(`${LOG} Trình duyệt chặn popup kết nối Gmail`);
      return Promise.resolve(false);
    }
    console.info(`${LOG} Mở popup kết nối Gmail → lấy URL đồng ý từ BE`);
    return new Promise(resolve => {
      let done = false;
      const finish = (ok: boolean, why: string) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        clearInterval(timer);
        console.info(`${LOG} Kết nối Gmail kết thúc: ${why}`);
        resolve(ok);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source === popup && e.data?.type === 'GMAIL_AUTH_SUCCESS') finish(true, `nhận GMAIL_AUTH_SUCCESS từ ${e.origin}`);
      };
      window.addEventListener('message', onMessage);
      const timer = setInterval(() => { if (popup.closed) finish(false, 'popup đã đóng (chưa nhận tín hiệu thành công)'); }, 500);
      this.http.get<{ success: boolean; url: string }>(`${this.api}/api/gmail/auth/url`).subscribe({
        next: res => {
          if (res?.url) {
            popup.location.href = res.url;
          } else {
            popup.close();
            finish(false, 'BE không trả URL đồng ý');
          }
        },
        error: err => {
          console.error(`${LOG} Lấy URL kết nối Gmail lỗi: ${httpErrorText(err)}`);
          popup.close();
          finish(false, 'lỗi lấy URL đồng ý');
        }
      });
    });
  }

  private async onUserChanged(user: User | null): Promise<void> {
    if (!user) {
      console.info(`${LOG} Không có phiên Firebase (chưa đăng nhập / đã đăng xuất)`);
      this.verifying = null;
      this.state$.next({ ready: true, user: null });
      return;
    }
    console.info(`${LOG} Phiên Firebase: ${user.email} → kiểm với BE`);
    try {
      await this.verifyWithBackend(user);
      console.info(`${LOG} Phiên hợp lệ: ${user.email}`);
      this.state$.next({ ready: true, user });
    } catch (e: any) {
      console.warn(`${LOG} Phiên ${user.email} không qua BE: ${httpErrorText(e)}`);
      if (e?.status === 401 || e?.status === 403) await signOut(this.auth);
      this.state$.next({ ready: true, user: null });
    }
  }

  private verifyWithBackend(user: User): Promise<void> {
    if (this.verifying?.uid === user.uid) return this.verifying.promise;
    const promise = (async () => {
      const token = await user.getIdToken();
      console.debug(`${LOG} GET /api/auth/me (${user.email})`);
      await firstValueFrom(this.http.get(`${this.api}/api/auth/me`, { headers: { 'X-Id-Token': token } }));
    })();
    this.verifying = { uid: user.uid, promise };
    promise.catch(() => {
      if (this.verifying?.promise === promise) this.verifying = null;
    });
    return promise;
  }
}
