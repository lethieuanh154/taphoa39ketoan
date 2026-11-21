/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMPLOYEE PAGE COMPONENT - DANH MỤC NHÂN VIÊN
 * ═══════════════════════════════════════════════════════════════════════════════
 * Dữ liệu thật ở ledger-rs `/api/ledger/partners` (vai EMPLOYEE, spec 002-danh-muc-doi-tuong). Mã để trống → BE tự cấp NV0001…;
 * MST trùng cùng vai / mã trùng / sai định dạng do BE kiểm → hiện đúng lý do BE trả về.
 * Log chỉ mã + số lượng — KHÔNG log MST, SĐT, địa chỉ, từ khóa tìm kiếm.
 */

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, switchMap, takeUntil, catchError, of, tap } from 'rxjs';

import { PartnerService } from '../../services/partner.service';
import { httpErrorText } from '../../services/auth.service';
import {
  Partner,
  PartnerHistoryEntry,
  PartnerPatch,
  PartnerStatus,
  PARTNER_CODE_RE,
  TAX_CODE_RE,
  getPartnerRoleName,
  getPartnerStatusName,
  normalizeTaxCode
} from '../../models/partner.models';

const LOG = '[EmployeePage]';
const ROLE = 'EMPLOYEE' as const;

interface PartnerForm {
  code: string;
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  status: PartnerStatus;
  note: string;
}

const EMPTY_FORM: PartnerForm = { code: '', name: '', taxCode: '', address: '', phone: '', email: '', status: 'ACTIVE', note: '' };

const FIELD_LABELS: Record<string, string> = {
  code: 'Mã', role: 'Vai', name: 'Tên', tax_code: 'MST', address: 'Địa chỉ', phone: 'Điện thoại', email: 'Email',
  note: 'Ghi chú', status: 'Trạng thái', bank_account_no: 'Số tài khoản', bank_name: 'Ngân hàng', bank_branch: 'Chi nhánh'
};

@Component({
  selector: 'app-employee-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-page.component.html',
  styleUrl: './employee-page.component.css'
})
export class EmployeePageComponent implements OnInit, OnDestroy {
  private partnerService = inject(PartnerService);
  private destroy$ = new Subject<void>();
  /** chỉ phát khi có từ khóa (gọi BE); lọc trạng thái làm tại máy */
  private searchChange$ = new Subject<void>();
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  /** toàn bộ NV (cho thống kê) */
  allEmployees: Partner[] = [];
  /** kết quả lọc ở BE */
  employees: Partner[] = [];
  loading = false;
  saving = false;

  search = '';
  statusFilter: PartnerStatus | '' = '';

  errorMessage = '';
  successMessage = '';
  formError = '';

  selected: Partner | null = null;
  showFormModal = false;
  showDetailModal = false;
  showDeleteConfirm = false;
  isEditMode = false;
  form: PartnerForm = { ...EMPTY_FORM };

  /** MST đang nhập đã có ở vai khác → gợi ý điền sẵn (R3) */
  taxSuggestion: Partner | null = null;
  /** MST đang nhập đã có ở NV khác → BE sẽ từ chối */
  taxDuplicate: Partner | null = null;

  history: PartnerHistoryEntry[] = [];
  historyLoading = false;
  historyError = '';

  get stats() {
    const active = this.allEmployees.filter(s => s.status === 'ACTIVE').length;
    return {
      total: this.allEmployees.length,
      active,
      inactive: this.allEmployees.length - active,
      withTax: this.allEmployees.filter(s => !!s.taxCode).length
    };
  }

  get hasFilter(): boolean {
    return !!this.search.trim() || !!this.statusFilter;
  }

  ngOnInit(): void {
    // Có từ khóa → gọi BE (tìm không dấu bằng unaccent ở Postgres). Không có → lọc trạng thái tại máy trên allEmployees (0 request).
    this.searchChange$.pipe(
      debounceTime(300),
      tap(() => this.loading = true),
      switchMap(() => this.partnerService.getPartners({
        role: ROLE,
        search: this.search,
        status: this.statusFilter || undefined
      }).pipe(catchError(err => {
        this.errorMessage = this.reasonText(err, 'Tìm nhân viên');
        return of(null);
      }))),
      takeUntil(this.destroy$)
    ).subscribe(rows => {
      this.loading = false;
      // đã xóa từ khóa trong lúc chờ BE → bỏ kết quả cũ (bảng đang lọc tại máy)
      if (!rows || !this.search.trim()) return;
      this.employees = rows;
      console.info(`${LOG} tìm (gọi BE): ${rows.length} dòng`);
    });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  /** Tải toàn bộ nhân viên 1 lần (thống kê + bảng) rồi áp lại bộ lọc đang chọn */
  reload(): void {
    this.loading = true;
    this.partnerService.getPartners({ role: ROLE }).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        this.allEmployees = rows;
        this.loading = false;
        this.applyFilter();
      },
      error: err => {
        this.loading = false;
        this.errorMessage = this.reasonText(err, 'Tải danh sách nhân viên');
      }
    });
  }

  /** Không có từ khóa → lọc trạng thái tại máy; có từ khóa → gọi BE (debounce 300ms) */
  private applyFilter(): void {
    if (this.search.trim()) {
      this.searchChange$.next();
      return;
    }
    this.employees = this.statusFilter ? this.allEmployees.filter(p => p.status === this.statusFilter) : this.allEmployees;
    console.debug(`${LOG} lọc tại máy: ${this.employees.length}/${this.allEmployees.length}`);
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  clearSearch(): void {
    this.search = '';
    this.statusFilter = '';
    this.applyFilter();
  }

  // ─── THÊM / SỬA ────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.isEditMode = false;
    this.selected = null;
    this.form = { ...EMPTY_FORM };
    this.resetFormHints();
    this.showFormModal = true;
  }

  openEditModal(p: Partner): void {
    this.isEditMode = true;
    this.selected = p;
    this.form = {
      code: p.code, name: p.name, taxCode: p.taxCode ?? '', address: p.address, phone: p.phone,
      email: p.email, status: p.status, note: p.note
    };
    this.resetFormHints();
    this.showDetailModal = false;
    this.showFormModal = true;
  }

  closeFormModal(): void {
    if (this.saving) return;
    this.showFormModal = false;
    this.resetFormHints();
  }

  private resetFormHints(): void {
    this.formError = '';
    this.taxSuggestion = null;
    this.taxDuplicate = null;
  }

  /** Rời ô MST: tìm đối tượng cùng MST (vai khác → gợi ý điền sẵn; cùng vai → cảnh báo trùng) */
  onTaxCodeBlur(): void {
    const tax = normalizeTaxCode(this.form.taxCode);
    this.taxSuggestion = null;
    this.taxDuplicate = null;
    if (!TAX_CODE_RE.test(tax) || (this.isEditMode && tax === (this.selected?.taxCode ?? ''))) return;
    this.partnerService.getPartners({ search: tax }).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => {
        const same = rows.filter(r => r.taxCode === tax && r.code !== this.selected?.code);
        this.taxDuplicate = same.find(r => r.role === ROLE) ?? null;
        this.taxSuggestion = this.taxDuplicate ? null : (same.find(r => r.role !== ROLE) ?? null);
        if (same.length) console.info(`${LOG} MST đang nhập đã có ở ${same.map(r => r.code).join(', ')}`);
      },
      error: err => console.warn(`${LOG} kiểm MST trùng lỗi — ${httpErrorText(err)}`)
    });
  }

  /** Điền sẵn tên / địa chỉ / SĐT / email từ đối tượng vai khác cùng MST */
  applySuggestion(): void {
    const s = this.taxSuggestion;
    if (!s) return;
    this.form = { ...this.form, name: this.form.name || s.name, address: this.form.address || s.address,
      phone: this.form.phone || s.phone, email: this.form.email || s.email };
    console.info(`${LOG} điền sẵn từ ${s.code}`);
    this.taxSuggestion = null;
  }

  roleName(p: Partner): string {
    return getPartnerRoleName(p.role);
  }

  private validate(): string {
    if (!this.form.name.trim()) return 'Nhập tên nhân viên.';
    const code = this.form.code.trim().toUpperCase();
    if (!this.isEditMode && code && !PARTNER_CODE_RE.test(code)) {
      return 'Mã chỉ gồm chữ A–Z, số, "-", "_", tối đa 20 ký tự (để trống = tự cấp).';
    }
    const tax = normalizeTaxCode(this.form.taxCode);
    if (tax && !TAX_CODE_RE.test(tax)) return 'MST gồm 10 số, 10 số-3 số (chi nhánh) hoặc 12 số (cá nhân).';
    const email = this.form.email.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Email không đúng định dạng.';
    return '';
  }

  save(): void {
    if (this.saving) return;
    this.formError = this.validate();
    if (this.formError) {
      console.warn(`${LOG} form không hợp lệ: ${this.formError}`);
      return;
    }
    this.saving = true;
    const f = this.form;
    if (this.isEditMode && this.selected) {
      const before = this.selected;
      const changes: PartnerPatch = {};
      const set = <K extends keyof PartnerPatch>(k: K, now: PartnerPatch[K], old: PartnerPatch[K]) => { if (now !== old) changes[k] = now; };
      set('name', f.name.trim(), before.name);
      set('taxCode', normalizeTaxCode(f.taxCode), before.taxCode ?? '');
      set('address', f.address.trim(), before.address);
      set('phone', f.phone.trim(), before.phone);
      set('email', f.email.trim(), before.email);
      set('status', f.status, before.status);
      set('note', f.note.trim(), before.note);
      if (!Object.keys(changes).length) {
        this.saving = false;
        this.showFormModal = false;
        return;
      }
      this.partnerService.updatePartner(before.code, changes).pipe(takeUntil(this.destroy$)).subscribe({
        next: p => this.afterSave(`Đã lưu ${p.code}.`),
        error: err => this.failSave(err, `Sửa ${before.code}`)
      });
    } else {
      this.partnerService.addPartner({
        role: ROLE, code: f.code.trim().toUpperCase(), name: f.name.trim(), taxCode: normalizeTaxCode(f.taxCode),
        address: f.address, phone: f.phone, email: f.email, status: f.status, note: f.note
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: p => this.afterSave(`Đã thêm nhân viên ${p.code}.`),
        error: err => this.failSave(err, 'Thêm nhân viên')
      });
    }
  }

  private afterSave(msg: string): void {
    this.saving = false;
    this.showFormModal = false;
    this.showSuccess(msg);
    this.reload();
  }

  private failSave(err: unknown, action: string): void {
    this.saving = false;
    this.formError = this.reasonText(err, action);
  }

  // ─── NGỪNG DÙNG / XÓA ──────────────────────────────────────────────────────

  toggleStatus(p: Partner): void {
    const status: PartnerStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.partnerService.updatePartner(p.code, { status }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showSuccess(`${p.code}: ${getPartnerStatusName(status).toLowerCase()}.`);
        this.reload();
      },
      error: err => this.errorMessage = this.reasonText(err, `Đổi trạng thái ${p.code}`)
    });
  }

  confirmDelete(p: Partner): void {
    this.selected = p;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  deleteSelected(): void {
    const p = this.selected;
    if (!p || this.saving) return;
    this.saving = true;
    this.partnerService.deletePartner(p.code).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.showDeleteConfirm = false;
        this.selected = null;
        this.showSuccess(`Đã xóa ${p.code}.`);
        this.reload();
      },
      error: err => {
        this.saving = false;
        this.showDeleteConfirm = false;
        this.errorMessage = this.reasonText(err, `Xóa ${p.code}`);
      }
    });
  }

  // ─── CHI TIẾT + LỊCH SỬ ───────────────────────────────────────────────────

  viewDetail(p: Partner): void {
    this.selected = p;
    this.history = [];
    this.historyError = '';
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
  }

  loadHistory(): void {
    const p = this.selected;
    if (!p) return;
    this.historyLoading = true;
    this.historyError = '';
    this.partnerService.getHistory(p.code).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => { this.history = rows; this.historyLoading = false; },
      error: err => { this.historyError = this.reasonText(err, 'Tải lịch sử'); this.historyLoading = false; }
    });
  }

  getActionLabel(a: PartnerHistoryEntry['action']): string {
    return a === 'INSERT' ? 'Thêm' : a === 'UPDATE' ? 'Sửa' : 'Xóa';
  }

  getFieldLabel(f: string): string {
    return FIELD_LABELS[f] ?? f;
  }

  formatValue(field: string, v: unknown): string {
    if (v === null || v === undefined || v === '') return '(trống)';
    if (field === 'status') return getPartnerStatusName(v as PartnerStatus);
    return String(v);
  }

  // ─── XUẤT EXCEL ────────────────────────────────────────────────────────────

  exportExcel(): void {
    this.partnerService.exportExcel(ROLE).pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nhan-vien-${stamp}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: err => this.errorMessage = this.reasonText(err, 'Xuất Excel')
    });
  }

  // ─── ĐÓNG MODAL KHI BẤM NỀN ────────────────────────────────────────────────
  // Chỉ đóng khi CẢ mousedown lẫn click đều trên nền: bôi đen chữ trong ô nhập rồi thả chuột ra ngoài modal
  // sinh sự kiện click trên nền → trước đây modal tự đóng, mất dữ liệu đang nhập.

  private backdropDown = false;

  onBackdropDown(e: MouseEvent): void {
    this.backdropDown = e.target === e.currentTarget;
  }

  onBackdropClick(e: MouseEvent, which: 'form' | 'detail' | 'delete'): void {
    const close = this.backdropDown && e.target === e.currentTarget;
    this.backdropDown = false;
    if (!close) return;
    if (which === 'form') this.closeFormModal();
    else if (which === 'detail') this.closeDetailModal();
    else this.cancelDelete();
  }

  // ─── THÔNG BÁO ─────────────────────────────────────────────────────────────

  dismissError(): void {
    this.errorMessage = '';
  }

  getStatusLabel(s: PartnerStatus): string {
    return getPartnerStatusName(s);
  }

  getStatusClass(s: PartnerStatus): string {
    return s === 'ACTIVE' ? 'status-active' : 'status-inactive';
  }

  private showSuccess(msg: string): void {
    this.errorMessage = '';
    this.successMessage = msg;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.successMessage = '', 4000);
  }

  /** Lý do cho người dùng: mất kết nối / hết phiên / không quyền / lỗi máy chủ / lý do BE (vd "MST … đã dùng cho NV0003") */
  private reasonText(err: unknown, action: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return `${action}: không kết nối được máy chủ ledger — kiểm tra mạng / ledger-rs.`;
      if (err.status === 401) return `${action}: phiên đăng nhập hết hạn — đăng nhập lại.`;
      if (err.status === 403) return `${action}: email này không có quyền dùng kế toán chi tiết.`;
      if (err.status >= 500) return `${action}: lỗi máy chủ, thử lại sau.`;
      return `${action}: ${err.error?.detail || httpErrorText(err)}`;
    }
    console.error(`${LOG} ${action}: lỗi không mong đợi`, err);
    return `${action}: ${(err as Error)?.message || err}`;
  }
}
