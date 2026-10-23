import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/**
 * TRANG ĐĂNG NHẬP — Google (Firebase Auth quanlysongminh), email phải trong whitelist KeToanBackEnd.
 * Đăng nhập xong mà hộp thư hóa đơn chưa có refresh token Gmail → mời kết nối Gmail 1 lần.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = false;
  error = '';
  needGmail = false;
  gmailAccount = '';

  async login(): Promise<void> {
    this.loading = true;
    this.error = '';
    console.info('[Login] Bấm đăng nhập Google');
    try {
      await this.authService.signInWithGoogle();
      const status = await firstValueFrom(this.authService.getGmailStatus()).catch(() => null);
      if (status && !status.hasRefreshToken) {
        console.info(`[Login] Hộp thư ${status.account} chưa có refresh token → bước kết nối Gmail`);
        this.gmailAccount = status.account;
        this.needGmail = true;
      } else {
        this.goToApp();
      }
    } catch (e: any) {
      console.warn(`[Login] Đăng nhập lỗi: ${e?.code || ''} ${e?.message || e}`);
      this.error = this.loginErrorMessage(e);
    } finally {
      this.loading = false;
    }
  }

  async connectGmail(): Promise<void> {
    this.loading = true;
    this.error = '';
    console.info(`[Login] Bấm kết nối Gmail ${this.gmailAccount}`);
    await this.authService.connectGmail();
    const status = await firstValueFrom(this.authService.getGmailStatus()).catch(() => null);
    this.loading = false;
    if (status?.hasRefreshToken) {
      this.goToApp();
    } else {
      console.warn(`[Login] Kết nối Gmail chưa xong (hasRefreshToken=${status?.hasRefreshToken ?? 'không rõ'})`);
      this.error = `Chưa kết nối được Gmail ${this.gmailAccount}. Có thể thử lại sau ở menu tài khoản (cuối thanh bên).`;
    }
  }

  skipGmail(): void {
    console.info('[Login] Bỏ qua kết nối Gmail (để sau)');
    this.goToApp();
  }

  private goToApp(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '';
    const safe = returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/login');
    const target = safe ? returnUrl : '/accountant-dashboard';
    console.info(`[Login] Vào app → ${target}`);
    this.router.navigateByUrl(target);
  }

  private loginErrorMessage(e: any): string {
    switch (e?.code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return '';
      case 'auth/popup-blocked':
        return 'Trình duyệt đã chặn cửa sổ đăng nhập — cho phép popup rồi thử lại.';
      case 'auth/unauthorized-domain':
        return 'Tên miền này chưa được thêm vào Firebase Auth (Authorized domains).';
      default:
        return e?.message || 'Đăng nhập thất bại.';
    }
  }
}
