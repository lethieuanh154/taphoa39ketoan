import { Component, OnInit, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
            <h3>Nhập HDDT Token</h3>
          </div>
          <div class="dialog-body">
            <p class="dialog-description">
              Vui lòng đăng nhập vào
              <a href="https://hoadondientu.gdt.gov.vn/" target="_blank" rel="noopener">
                hoadondientu.gdt.gov.vn
              </a>
              và lấy token sau khi đăng nhập thành công.
            </p>
            <div class="form-group">
              <label for="hddt-token">HDDT Token</label>
              <textarea
                id="hddt-token"
                [(ngModel)]="tokenValue"
                placeholder="Paste token vào đây..."
                rows="4"
                class="token-input"
              ></textarea>
            </div>
          </div>
          <div class="dialog-footer">
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
  `]
})
export class HddtTokenDialogComponent implements OnInit {
  showDialog = signal(false);
  tokenValue = '';

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

  saveToken(): void {
    const token = this.tokenValue.trim();
    if (token) {
      sessionStorage.setItem(HDDT_TOKEN_KEY, token);
      this.showDialog.set(false);
      this.tokenSaved.emit(token);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    // Không cho đóng khi click overlay - bắt buộc phải nhập token
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
