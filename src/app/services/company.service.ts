import { Injectable, signal } from '@angular/core';

/**
 * MST CÔNG TY DÙNG CHUNG (23/10/2026) — nhập 1 lần qua popup ở MainLayout (hiện ở góc dưới sidebar cạnh Gmail, bấm vào để đổi).
 * Các trang Tiện ích dùng làm MST công ty thay cho việc tự nhận từ XML (Đối soát hóa đơn XML, Kiểm tra số lượng hóa đơn).
 * Lưu localStorage theo trình duyệt (không phải bí mật, không xóa khi đăng xuất).
 */
const LOG = '[Company]';
const STORAGE_KEY = 'ketoan_company_mst';
/** 10 số (doanh nghiệp) hoặc 10 số + "-" + 3 số (chi nhánh) */
const MST_RE = /^\d{10}(-\d{3})?$/;

export function normalizeMst(v: string): string {
  return (v || '').replace(/\s+/g, '').trim();
}

export function mstError(v: string): string {
  const m = normalizeMst(v);
  if (!m) return 'Nhập MST công ty';
  return MST_RE.test(m) ? '' : 'MST gồm 10 chữ số (chi nhánh: 10 số + "-" + 3 số)';
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly state = signal<string>(this.load());

  readonly mst = this.state.asReadonly();

  /** Trả về lý do lỗi hoặc '' nếu đã lưu */
  setMst(value: string): string {
    const err = mstError(value);
    if (err) {
      console.warn(`${LOG} MST không hợp lệ: "${value}"`);
      return err;
    }
    const m = normalizeMst(value);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch (e) {
      console.warn(`${LOG} Không lưu được MST vào localStorage (chỉ giữ trong phiên này):`, e);
    }
    console.info(`${LOG} MST công ty: ${this.state() || '(chưa có)'} → ${m}`);
    this.state.set(m);
    return '';
  }

  private load(): string {
    try {
      const m = normalizeMst(localStorage.getItem(STORAGE_KEY) || '');
      if (m && !mstError(m)) return m;
      if (m) console.warn(`${LOG} MST đã lưu không hợp lệ "${m}" → bỏ, hỏi lại`);
    } catch (e) {
      console.warn(`${LOG} Không đọc được localStorage:`, e);
    }
    return '';
  }
}
