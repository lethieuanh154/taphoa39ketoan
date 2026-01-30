import { Component, OnInit, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const HDDT_TOKEN_KEY = 'hddt_token';

// Bookmarklet code để lấy JWT từ cookie của hoadondientu.gdt.gov.vn
const BOOKMARKLET_CODE = `javascript:(function(){var c=document.cookie.split(';').find(c=>c.trim().startsWith('jwt='));if(c){var t=c.split('=')[1];navigator.clipboard.writeText(t).then(()=>alert('Đã copy JWT Token!\\n\\nHãy quay lại TapHoa39 và paste token.')).catch(()=>{prompt('Copy token này:',t)})}else{alert('Không tìm thấy JWT token!\\nVui lòng đăng nhập trước.')}})();`;

@Component({
  selector: 'app-hddt-token-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (showDialog()) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        <div class="dialog-container">
          <div class="dialog-header">
            <h3>Nhập HDDT Token</h3>
            @if (hasExistingToken()) {
              <button class="close-btn" (click)="closeDialog()">&times;</button>
            }
          </div>
          <div class="dialog-body">
            <!-- Tab Navigation -->
            <div class="tab-nav">
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'bookmarklet'"
                (click)="activeTab.set('bookmarklet')"
              >
                Tự động (Bookmarklet)
              </button>
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'manual'"
                (click)="activeTab.set('manual')"
              >
                Thủ công
              </button>
            </div>

            <!-- Bookmarklet Tab -->
            @if (activeTab() === 'bookmarklet') {
              <div class="tab-content">
                <div class="instruction-steps">
                  <h4>Cách tạo Bookmark lấy token:</h4>
                  <ol>
                    <li>
                      <strong>Bước 1:</strong> Nhấn nút bên dưới để copy code:
                      <div class="bookmarklet-actions">
                        <button class="copy-code-btn" (click)="copyBookmarkletCode()">
                          {{ codeCopied() ? '✓ Đã copy!' : '📋 Copy Bookmarklet Code' }}
                        </button>
                      </div>
                    </li>
                    <li>
                      <strong>Bước 2:</strong> Tạo bookmark mới trong trình duyệt:
                      <ul class="sub-steps">
                        <li><strong>Chrome/Edge:</strong> Nhấn <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> → Click phải → "Thêm trang mới"</li>
                        <li><strong>Firefox:</strong> Nhấn <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> → Click phải → "Thêm dấu trang"</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Bước 3:</strong> Điền thông tin bookmark:
                      <ul class="sub-steps">
                        <li><strong>Tên:</strong> <code>Lấy HDDT Token</code></li>
                        <li><strong>URL:</strong> Paste code đã copy ở bước 1</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Bước 4:</strong> Mở tab mới, đăng nhập vào
                      <a href="https://hoadondientu.gdt.gov.vn/" target="_blank" rel="noopener">
                        hoadondientu.gdt.gov.vn
                      </a>
                    </li>
                    <li>
                      <strong>Bước 5:</strong> Click vào bookmark <strong>"Lấy HDDT Token"</strong> vừa tạo
                    </li>
                    <li>
                      <strong>Bước 6:</strong> Token sẽ được copy tự động, quay lại đây và paste vào ô bên dưới
                    </li>
                  </ol>
                </div>

                <div class="form-group">
                  <label for="hddt-token">Paste Token:</label>
                  <textarea
                    id="hddt-token"
                    [(ngModel)]="tokenValue"
                    placeholder="Paste token vào đây sau khi copy từ bookmarklet..."
                    rows="3"
                    class="token-input"
                  ></textarea>
                </div>
              </div>
            }

            <!-- Manual Tab -->
            @if (activeTab() === 'manual') {
              <div class="tab-content">
                <div class="instruction-steps">
                  <h4>Cách lấy token thủ công:</h4>
                  <ol>
                    <li>
                      Mở
                      <a href="https://hoadondientu.gdt.gov.vn/" target="_blank" rel="noopener">
                        hoadondientu.gdt.gov.vn
                      </a>
                      và đăng nhập
                    </li>
                    <li>Nhấn <kbd>F12</kbd> để mở DevTools</li>
                    <li>Chọn tab <strong>Application</strong> (hoặc <strong>Storage</strong>)</li>
                    <li>Mở rộng <strong>Cookies</strong> → chọn <code>https://hoadondientu.gdt.gov.vn</code></li>
                    <li>Tìm cookie có Name là <strong>jwt</strong></li>
                    <li>Copy giá trị trong cột <strong>Value</strong></li>
                  </ol>
                </div>

                <div class="form-group">
                  <label for="hddt-token-manual">Paste Token:</label>
                  <textarea
                    id="hddt-token-manual"
                    [(ngModel)]="tokenValue"
                    placeholder="Paste JWT token vào đây..."
                    rows="3"
                    class="token-input"
                  ></textarea>
                </div>
              </div>
            }
          </div>
          <div class="dialog-footer">
            @if (hasExistingToken()) {
              <button class="btn btn-secondary" (click)="closeDialog()">Hủy</button>
            }
            <button class="btn btn-primary" (click)="saveToken()" [disabled]="!tokenValue.trim()">
              Lưu Token
            </button>
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
      max-width: 500px;
      max-height: 90vh;
      overflow: auto;
    }

    .dialog-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
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

    .dialog-description {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    .dialog-description a {
      color: #1976d2;
      text-decoration: none;
    }

    .dialog-description a:hover {
      text-decoration: underline;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

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

    .dialog-footer {
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-primary {
      background: #1976d2;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

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

    .close-btn:hover {
      color: #333;
    }

    .dialog-header {
      position: relative;
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

    .tab-btn:hover {
      background: #f5f5f5;
      color: #333;
    }

    .tab-btn.active {
      background: #e3f2fd;
      color: #1976d2;
      border-bottom: 2px solid #1976d2;
      margin-bottom: -10px;
    }

    .tab-content {
      padding-top: 8px;
    }

    /* Instructions */
    .instruction-steps {
      margin-bottom: 16px;
    }

    .instruction-steps h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }

    .instruction-steps ol {
      margin: 0;
      padding-left: 20px;
    }

    .instruction-steps li {
      margin-bottom: 12px;
      line-height: 1.5;
      color: #555;
    }

    .instruction-steps a {
      color: #1976d2;
      text-decoration: none;
    }

    .instruction-steps a:hover {
      text-decoration: underline;
    }

    /* Bookmarklet */
    .bookmarklet-actions {
      margin-top: 8px;
    }

    .copy-code-btn {
      padding: 10px 16px;
      background: linear-gradient(135deg, #4caf50, #43a047);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-code-btn:hover {
      background: linear-gradient(135deg, #43a047, #388e3c);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
      transform: translateY(-1px);
    }

    .sub-steps {
      margin: 8px 0 0 0;
      padding-left: 20px;
      list-style-type: disc;
    }

    .sub-steps li {
      margin-bottom: 4px;
      font-size: 13px;
    }

    /* Keyboard key style */
    kbd {
      display: inline-block;
      padding: 3px 6px;
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
  `]
})
export class HddtTokenDialogComponent implements OnInit {
  showDialog = signal(false);
  activeTab = signal<'bookmarklet' | 'manual'>('bookmarklet');
  codeCopied = signal(false);
  tokenValue = '';

  // Bookmarklet code để kéo vào bookmark bar
  bookmarkletCode = BOOKMARKLET_CODE;

  tokenSaved = output<string>();

  ngOnInit(): void {
    this.checkToken();
  }

  private checkToken(): void {
    const existingToken = sessionStorage.getItem(HDDT_TOKEN_KEY);
    if (!existingToken) {
      this.showDialog.set(true);
    }
  }

  // Kiểm tra xem đã có token chưa (để cho phép đóng dialog)
  hasExistingToken(): boolean {
    return !!sessionStorage.getItem(HDDT_TOKEN_KEY);
  }

  // Đóng dialog (chỉ khi đã có token)
  closeDialog(): void {
    if (this.hasExistingToken()) {
      this.showDialog.set(false);
      this.tokenValue = '';
    }
  }

  // Copy bookmarklet code vào clipboard
  copyBookmarkletCode(): void {
    navigator.clipboard.writeText(BOOKMARKLET_CODE).then(() => {
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 3000);
    }).catch(() => {
      // Fallback cho trình duyệt không hỗ trợ clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = BOOKMARKLET_CODE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 3000);
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
    // Cho phép đóng nếu đã có token, nếu chưa thì bắt buộc phải nhập
    if (this.hasExistingToken()) {
      // Chỉ đóng khi click đúng vào overlay, không phải container
      if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
        this.closeDialog();
      }
    }
  }

  // Public method để mở lại dialog (nếu cần thay đổi token)
  openDialog(): void {
    this.tokenValue = sessionStorage.getItem(HDDT_TOKEN_KEY) || '';
    this.showDialog.set(true);
  }

  // Static method để lấy token từ bất kỳ đâu
  static getToken(): string | null {
    return sessionStorage.getItem(HDDT_TOKEN_KEY);
  }
}
