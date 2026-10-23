import { Component, Input } from '@angular/core';

/**
 * VÒNG XOAY "ĐANG TẢI" CHO BẢNG DỮ LIỆU (23/10/2026) — dùng chung các trang Tiện ích.
 * - Mặc định (chưa có bảng): khối giữa vùng bảng, cao tối thiểu 160px.
 * - `overlay` (đang tải lại khi đã có bảng): phủ mờ lên bảng cũ — phần tử cha phải `position: relative`.
 */
@Component({
  selector: 'app-table-loading',
  standalone: true,
  template: `
    <div class="tl" [class.overlay]="overlay" role="status" aria-live="polite">
      <span class="ring" aria-hidden="true"></span>
      <span class="txt">{{ text }}</span>
    </div>`,
  styles: [`
    .tl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.7rem; min-height: 160px;
      padding: 1.5rem; color: #475569; font-size: 0.82rem; }
    .tl.overlay { position: absolute; inset: 0; min-height: 0; z-index: 5; background: rgba(255, 255, 255, 0.72); border-radius: inherit; }
    .ring { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #dbeafe; border-top-color: #2563eb;
      animation: tl-spin 0.8s linear infinite; }
    @keyframes tl-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ring { animation-duration: 2s; } }
  `]
})
export class TableLoadingComponent {
  @Input() text = 'Đang tải dữ liệu...';
  @Input() overlay = false;
}
