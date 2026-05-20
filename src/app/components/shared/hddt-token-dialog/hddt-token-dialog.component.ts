import { Component, OnInit, OnDestroy, signal, output, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HddtService, HddtCaptchaResponse } from '../../../services/hddt.service';

const HDDT_TOKEN_KEY = 'hddt_token';

@Component({
  selector: 'app-hddt-token-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (showDialog()) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        <div class="dialog-container">
          <div class="dialog-header">
            <h3>Kết nối Hóa Đơn Điện Tử</h3>
            @if (hasExistingToken()) {
              <button class="close-btn" (click)="closeDialog()">&times;</button>
            }
          </div>
          <div class="dialog-body">
            <!-- Tab Navigation -->
            <div class="tab-nav">
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'login'"
                (click)="activeTab.set('login')"
              >
                Dang nhap
              </button>
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'manual'"
                (click)="activeTab.set('manual')"
              >
                Nhap Token
              </button>
            </div>

            <!-- Login Tab -->
            @if (activeTab() === 'login') {
              <div class="tab-content">
                <!-- Gmail connection (required) -->
                <div class="gmail-section">
                  <div class="gmail-section-label">
                    Gmail
                    @if (!gmailEmail()) { <span class="gmail-required">(bat buoc)</span> }
                  </div>
                  @if (gmailEmail()) {
                    <div class="gmail-row connected">
                      <span class="gmail-check">&#10003;</span>
                      <span class="gmail-addr">{{ gmailEmail() }}</span>
                      <button class="btn-gmail-disconnect" (click)="disconnectGmail()">Ngat</button>
                    </div>
                  } @else {
                    <button class="btn-gmail" (click)="connectGmail()" [disabled]="gmailConnecting()">
                      {{ gmailConnecting() ? 'Dang ket noi...' : 'Ket noi Gmail' }}
                    </button>
                  }
                </div>

                <!-- Profile info khi đã đăng nhập HDDT -->
                @if (profileName()) {
                  <div class="profile-info">
                    <span class="profile-label">Da ket noi:</span>
                    <strong>{{ profileName() }}</strong>
                  </div>
                }

                <div class="login-form">
                  <div class="form-row">
                    <div class="form-group half">
                      <label>Ma so thue</label>
                      <input
                        type="text"
                        [(ngModel)]="username"
                        placeholder="VD: 0401836257"
                        maxlength="19"
                        class="form-input"
                        [disabled]="isLoggingIn()"
                      />
                    </div>
                    <div class="form-group half">
                      <label>Mat khau</label>
                      <input
                        type="password"
                        [(ngModel)]="password"
                        placeholder="Nhap mat khau"
                        class="form-input"
                        [disabled]="isLoggingIn()"
                        (keydown.enter)="doLogin()"
                      />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group half">
                      <label>Ma captcha</label>
                      <div class="captcha-container">
                        @if (captchaLoading()) {
                          <div class="captcha-loading">Dang tai...</div>
                        } @else if (captchaData()) {
                          <div class="captcha-image" [innerHTML]="captchaData()!.content"></div>
                        } @else {
                          <div class="captcha-error">Khong tai duoc</div>
                        }
                        <button
                          class="captcha-refresh"
                          (click)="loadCaptcha()"
                          [disabled]="captchaLoading()"
                          title="Tai lai captcha"
                        >
                          &#8635;
                        </button>
                      </div>
                    </div>
                    <div class="form-group half">
                      <label>Nhap ma captcha</label>
                      <div class="captcha-input-row">
                        <input
                          type="text"
                          [(ngModel)]="captchaValue"
                          placeholder="Ma captcha"
                          class="form-input"
                          [disabled]="isLoggingIn()"
                          (keydown.enter)="doLogin()"
                        />
                        @if (captchaData()?.solved) {
                          <span class="captcha-auto">(Tu dong)</span>
                        }
                      </div>
                    </div>
                  </div>

                  @if (loginError()) {
                    <div class="error-message">{{ loginError() }}</div>
                  }

                  @if (loginSuccess()) {
                    <div class="success-message">{{ loginSuccess() }}</div>
                  }
                </div>
              </div>
            }

            <!-- Manual Token Tab -->
            @if (activeTab() === 'manual') {
              <div class="tab-content">
                <div class="instruction-steps">
                  <h4>Cach lay token thu cong:</h4>
                  <ol>
                    <li>
                      Mo
                      <a href="https://hoadondientu.gdt.gov.vn/" target="_blank" rel="noopener">
                        hoadondientu.gdt.gov.vn
                      </a>
                      va dang nhap
                    </li>
                    <li>Nhan <kbd>F12</kbd> de mo DevTools</li>
                    <li>Chon tab <strong>Application</strong></li>
                    <li>Mo rong <strong>Cookies</strong> &rarr; chon <code>hoadondientu.gdt.gov.vn</code></li>
                    <li>Tim cookie <strong>jwt</strong> &rarr; copy <strong>Value</strong></li>
                  </ol>
                </div>

                <div class="form-group">
                  <label for="hddt-token-manual">Paste Token:</label>
                  <textarea
                    id="hddt-token-manual"
                    [(ngModel)]="tokenValue"
                    placeholder="Paste JWT token vao day..."
                    rows="3"
                    class="token-input"
                  ></textarea>
                </div>
              </div>
            }
          </div>
          <div class="dialog-footer">
            @if (hasExistingToken()) {
              <button class="btn btn-secondary" (click)="closeDialog()">Huy</button>
            }
            @if (activeTab() === 'login') {
              <button
                class="btn btn-primary"
                (click)="doLogin()"
                [disabled]="!canLogin() || isLoggingIn()"
              >
                {{ isLoggingIn() ? 'Dang dang nhap...' : 'Dang nhap' }}
              </button>
            } @else if (activeTab() === 'manual') {
              <button class="btn btn-primary" (click)="saveToken()" [disabled]="!tokenValue.trim()">
                Luu Token
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .dialog-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 520px;
      max-height: 90vh;
      overflow: auto;
    }

    .dialog-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      position: relative;
    }

    .dialog-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .dialog-body {
      padding: 20px;
    }

    .dialog-footer {
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Tab Navigation */
    .tab-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 8px;
    }

    .tab-btn {
      padding: 8px 16px;
      border: none;
      background: none;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      cursor: pointer;
      border-radius: 4px 4px 0 0;
      transition: all 0.2s;
    }

    .tab-btn:hover { background: #f5f5f5; color: #333; }

    .tab-btn.active {
      background: #e3f2fd;
      color: #1976d2;
      border-bottom: 2px solid #1976d2;
      margin-bottom: -10px;
    }

    .tab-content { padding-top: 8px; }

    /* Login Form */
    .login-form { }

    .form-row {
      display: flex;
      gap: 12px;
      margin-bottom: 4px;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group.half {
      flex: 1;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
      font-size: 13px;
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }

    .form-input:disabled {
      background: #f5f5f5;
      color: #999;
    }

    /* Captcha */
    .captcha-container {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 42px;
    }

    .captcha-image {
      flex: 1;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      overflow: hidden;
    }

    .captcha-image :deep(svg) {
      max-width: 100%;
      height: 100%;
    }

    .captcha-loading, .captcha-error {
      flex: 1;
      text-align: center;
      font-size: 12px;
      color: #999;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .captcha-error { color: #c62828; }

    .captcha-refresh {
      width: 36px;
      height: 36px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .captcha-refresh:hover { background: #f0f0f0; }
    .captcha-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

    .captcha-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .captcha-input-row .form-input {
      flex: 1;
    }

    .captcha-auto {
      font-size: 11px;
      color: #4caf50;
      white-space: nowrap;
    }

    /* Profile info */
    .profile-info {
      background: #e8f5e9;
      border: 1px solid #c8e6c9;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #2e7d32;
    }

    .profile-label {
      margin-right: 4px;
    }

    /* Messages */
    .error-message {
      background: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 4px;
      padding: 10px 14px;
      color: #c62828;
      font-size: 13px;
      margin-top: 8px;
    }

    .success-message {
      background: #e8f5e9;
      border: 1px solid #c8e6c9;
      border-radius: 4px;
      padding: 10px 14px;
      color: #2e7d32;
      font-size: 13px;
      margin-top: 8px;
    }

    /* Buttons */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-primary { background: #1976d2; color: white; }
    .btn-primary:hover:not(:disabled) { background: #1565c0; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
    }

    .btn-secondary:hover { background: #e0e0e0; }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      line-height: 1;
      padding: 4px;
    }

    .close-btn:hover { color: #333; }

    /* Manual tab */
    .token-input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: monospace;
      resize: vertical;
      box-sizing: border-box;
    }

    .token-input:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }

    .instruction-steps { margin-bottom: 16px; }
    .instruction-steps h4 { margin: 0 0 12px 0; font-size: 14px; color: #333; }
    .instruction-steps ol { margin: 0; padding-left: 20px; }
    .instruction-steps li { margin-bottom: 8px; line-height: 1.5; color: #555; font-size: 13px; }
    .instruction-steps a { color: #1976d2; text-decoration: none; }
    .instruction-steps a:hover { text-decoration: underline; }

    kbd {
      display: inline-block;
      padding: 2px 5px;
      font-size: 12px;
      font-family: monospace;
      background: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 3px;
      box-shadow: 0 1px 0 #ccc;
    }

    code {
      display: inline-block;
      padding: 2px 6px;
      font-size: 12px;
      font-family: monospace;
      background: #f5f5f5;
      border-radius: 3px;
      color: #c62828;
    }

    /* Gmail section (inline in login tab) */
    .gmail-section {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .gmail-section-label {
      font-size: 12px;
      font-weight: 600;
      color: #555;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .gmail-required { color: #e53935; font-weight: 400; margin-left: 4px; }
    .gmail-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gmail-row.connected { }
    .gmail-check { color: #4caf50; font-size: 16px; flex-shrink: 0; }
    .gmail-addr { flex: 1; font-size: 13px; font-weight: 500; color: #333; word-break: break-all; }
    .btn-gmail-disconnect {
      font-size: 12px;
      padding: 3px 8px;
      border: 1px solid #ccc;
      border-radius: 3px;
      background: #fff;
      color: #666;
      cursor: pointer;
      flex-shrink: 0;
    }
    .btn-gmail-disconnect:hover { background: #f5f5f5; color: #333; }
    .btn-gmail {
      background: #fff;
      border: 1px solid #dadce0;
      color: #3c4043;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-gmail:hover:not(:disabled) { background: #f8f9fa; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .btn-gmail:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class HddtTokenDialogComponent implements OnInit, OnDestroy {
  private hddtService = inject(HddtService);

  showDialog = signal(false);
  activeTab = signal<'login' | 'manual'>('login');
  profileName = signal('');

  // Gmail connection state
  gmailEmail = signal('');
  gmailConnecting = signal(false);
  private gmailMessageListener!: (e: MessageEvent) => void;

  // Login form
  username = '';
  password = '';
  captchaValue = '';
  tokenValue = '';

  // Captcha state
  captchaData = signal<HddtCaptchaResponse | null>(null);
  captchaLoading = signal(false);

  // Login state
  isLoggingIn = signal(false);
  loginError = signal('');
  loginSuccess = signal('');

  tokenSaved = output<string>();

  ngOnInit(): void {
    this.checkToken();
    const email = localStorage.getItem('gmail_email');
    if (email) this.gmailEmail.set(email);
    this.gmailMessageListener = (e: MessageEvent) => {
      if (e.data?.type === 'GMAIL_AUTH_SUCCESS') {
        const { uid, email: connectedEmail } = e.data;
        localStorage.setItem('gmail_uid', uid);
        localStorage.setItem('gmail_email', connectedEmail);
        this.gmailEmail.set(connectedEmail);
        this.gmailConnecting.set(false);
      }
    };
    window.addEventListener('message', this.gmailMessageListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.gmailMessageListener);
  }

  private checkToken(): void {
    const existingToken = sessionStorage.getItem(HDDT_TOKEN_KEY);
    if (!existingToken) {
      this.showDialog.set(true);
      this.loadCaptcha();
    }
    // Load profile name nếu có
    const profile = this.hddtService.getProfile();
    if (profile?.name) {
      this.profileName.set(profile.name);
    }
  }

  hasExistingToken(): boolean {
    return !!sessionStorage.getItem(HDDT_TOKEN_KEY);
  }

  closeDialog(): void {
    if (this.hasExistingToken()) {
      this.showDialog.set(false);
      this.resetForm();
    }
  }

  canLogin(): boolean {
    return !!(this.username.trim() && this.password.trim() && this.captchaValue.trim());
  }

  loadCaptcha(): void {
    this.captchaLoading.set(true);
    this.captchaData.set(null);
    this.captchaValue = '';

    this.hddtService.getCaptcha().subscribe({
      next: (data) => {
        this.captchaData.set(data);
        this.captchaLoading.set(false);
        // Tự động điền captcha nếu giải được
        if (data.solved) {
          this.captchaValue = data.solved;
        }
      },
      error: () => {
        this.captchaLoading.set(false);
      }
    });
  }

  doLogin(): void {
    if (!this.canLogin() || this.isLoggingIn()) return;

    this.isLoggingIn.set(true);
    this.loginError.set('');
    this.loginSuccess.set('');

    const captchaKey = this.captchaData()?.key || '';

    this.hddtService.login({
      username: this.username.trim(),
      password: this.password,
      ckey: captchaKey,
      cvalue: this.captchaValue.trim()
    }).subscribe({
      next: (response) => {
        this.isLoggingIn.set(false);
        if (response.token) {
          const name = response.profile?.name || this.username;
          this.profileName.set(name);
          this.loginSuccess.set(`Dang nhap thanh cong: ${name}`);
          this.tokenSaved.emit(response.token);
          // Đóng dialog sau 1s
          setTimeout(() => {
            this.showDialog.set(false);
            this.resetForm();
          }, 1000);
        }
      },
      error: (error) => {
        this.isLoggingIn.set(false);
        const detail = error.error?.detail || error.error?.error || 'Dang nhap that bai. Vui long thu lai.';
        this.loginError.set(detail);
        // Reload captcha khi lỗi
        this.loadCaptcha();
      }
    });
  }

  saveToken(): void {
    const token = this.tokenValue.trim();
    if (token) {
      sessionStorage.setItem(HDDT_TOKEN_KEY, token);
      this.showDialog.set(false);
      this.tokenSaved.emit(token);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.hasExistingToken()) {
      if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
        this.closeDialog();
      }
    }
  }

  openDialog(): void {
    this.tokenValue = sessionStorage.getItem(HDDT_TOKEN_KEY) || '';
    this.showDialog.set(true);
    this.loginError.set('');
    this.loginSuccess.set('');
    // Load profile nếu có
    const profile = this.hddtService.getProfile();
    if (profile?.name) {
      this.profileName.set(profile.name);
    }
    // Load captcha khi mở dialog
    if (!this.captchaData()) {
      this.loadCaptcha();
    }
  }

  private resetForm(): void {
    this.loginError.set('');
    this.loginSuccess.set('');
    this.captchaValue = '';
  }

  connectGmail(): void {
    this.gmailConnecting.set(true);
    const url = `${environment.ketoanBackendUrl}/api/gmail/auth/url`;
    const popup = window.open(url, 'gmail_auth', 'width=500,height=620,scrollbars=yes');
    if (!popup) {
      this.gmailConnecting.set(false);
      return;
    }
    const check = setInterval(() => {
      if (popup.closed) {
        clearInterval(check);
        this.gmailConnecting.set(false);
      }
    }, 500);
  }

  disconnectGmail(): void {
    localStorage.removeItem('gmail_uid');
    localStorage.removeItem('gmail_email');
    this.gmailEmail.set('');
  }

  static getToken(): string | null {
    return sessionStorage.getItem(HDDT_TOKEN_KEY);
  }
}
