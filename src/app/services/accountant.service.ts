import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Ledger1DoanhThu,
  Ledger2VatLieu,
  Ledger3ChiPhi,
  Ledger4ANhanVienChinhThuc,
  Ledger4BNhanVienKhoan,
  Ledger5CongNo,
  Ledger6QuyTienMat,
  Ledger7TienNganHang,
  MonthYearFilter,
  AllLedgerTypes,
} from '../models/ledger.models';

/**
 * AccountantService
 * Manages all 7 ledger data using local storage
 * Follows Circular 88/2021/TT-BTC for household business accounting
 */
@Injectable({
  providedIn: 'root',
})
export class AccountantService {
  // Observable subjects for each ledger
  private ledger1$ = new BehaviorSubject<Ledger1DoanhThu[]>(
    this.loadFromStorage('ledger1') || []
  );
  private ledger2$ = new BehaviorSubject<Ledger2VatLieu[]>(
    this.loadFromStorage('ledger2') || []
  );
  private ledger3$ = new BehaviorSubject<Ledger3ChiPhi[]>(
    this.loadFromStorage('ledger3') || []
  );
  private ledger4a$ = new BehaviorSubject<Ledger4ANhanVienChinhThuc[]>(
    this.loadFromStorage('ledger4a') || []
  );
  private ledger4b$ = new BehaviorSubject<Ledger4BNhanVienKhoan[]>(
    this.loadFromStorage('ledger4b') || []
  );
  private ledger5$ = new BehaviorSubject<Ledger5CongNo[]>(
    this.loadFromStorage('ledger5') || []
  );
  private ledger6$ = new BehaviorSubject<Ledger6QuyTienMat[]>(
    this.loadFromStorage('ledger6') || []
  );
  private ledger7$ = new BehaviorSubject<Ledger7TienNganHang[]>(
    this.loadFromStorage('ledger7') || []
  );

  constructor() {}

  // ========== LEDGER 1: DOANH THU ==========
  getLedger1(): Observable<Ledger1DoanhThu[]> {
    return this.ledger1$.asObservable();
  }

  addLedger1(record: Ledger1DoanhThu): void {
    record.id = this.generateId();
    record.tongTienThanhToan = record.doanhThuChuaVAT + record.thueVAT;
    const data = [...this.ledger1$.value, record];
    this.ledger1$.next(data);
    this.saveToStorage('ledger1', data);
  }

  updateLedger1(id: string, record: Partial<Ledger1DoanhThu>): void {
    const data = this.ledger1$.value.map((item) =>
      item.id === id
        ? {
            ...item,
            ...record,
            tongTienThanhToan: (record.doanhThuChuaVAT ?? item.doanhThuChuaVAT) +
              (record.thueVAT ?? item.thueVAT),
          }
        : item
    );
    this.ledger1$.next(data);
    this.saveToStorage('ledger1', data);
  }

  deleteLedger1(id: string): void {
    const data = this.ledger1$.value.filter((item) => item.id !== id);
    this.ledger1$.next(data);
    this.saveToStorage('ledger1', data);
  }

  // ========== LEDGER 2: VẬT LIỆU - HÀNG HÓA ==========
  getLedger2(): Observable<Ledger2VatLieu[]> {
    return this.ledger2$.asObservable();
  }

  addLedger2(record: Ledger2VatLieu): void {
    record.id = this.generateId();
    record.tonCuoiKy =
      record.tonDauKy +
      record.nhapTrongKy -
      record.xuatTrongKy -
      (record.haoHutHuy || 0);
    const data = [...this.ledger2$.value, record];
    this.ledger2$.next(data);
    this.saveToStorage('ledger2', data);
  }

  updateLedger2(id: string, record: Partial<Ledger2VatLieu>): void {
    const data = this.ledger2$.value.map((item) => {
      if (item.id === id) {
        const updated = { ...item, ...record };
        updated.tonCuoiKy =
          updated.tonDauKy +
          updated.nhapTrongKy -
          updated.xuatTrongKy -
          (updated.haoHutHuy || 0);
        return updated;
      }
      return item;
    });
    this.ledger2$.next(data);
    this.saveToStorage('ledger2', data);
  }

  deleteLedger2(id: string): void {
    const data = this.ledger2$.value.filter((item) => item.id !== id);
    this.ledger2$.next(data);
    this.saveToStorage('ledger2', data);
  }

  // ========== LEDGER 3: CHI PHÍ ==========
  getLedger3(): Observable<Ledger3ChiPhi[]> {
    return this.ledger3$.asObservable();
  }

  addLedger3(record: Ledger3ChiPhi): void {
    record.id = this.generateId();
    record.tongTien = record.soTienChuaVAT + record.vatKhauTru;
    const data = [...this.ledger3$.value, record];
    this.ledger3$.next(data);
    this.saveToStorage('ledger3', data);
  }

  updateLedger3(id: string, record: Partial<Ledger3ChiPhi>): void {
    const data = this.ledger3$.value.map((item) =>
      item.id === id
        ? {
            ...item,
            ...record,
            tongTien: (record.soTienChuaVAT ?? item.soTienChuaVAT) +
              (record.vatKhauTru ?? item.vatKhauTru),
          }
        : item
    );
    this.ledger3$.next(data);
    this.saveToStorage('ledger3', data);
  }

  deleteLedger3(id: string): void {
    const data = this.ledger3$.value.filter((item) => item.id !== id);
    this.ledger3$.next(data);
    this.saveToStorage('ledger3', data);
  }

  // ========== LEDGER 4A: NHÂN VIÊN CHÍNH THỨC ==========
  getLedger4A(): Observable<Ledger4ANhanVienChinhThuc[]> {
    return this.ledger4a$.asObservable();
  }

  addLedger4A(record: Ledger4ANhanVienChinhThuc): void {
    record.id = this.generateId();
    record.tongLuong = record.luongCoBan + record.phuCap;
    record.thucLinh =
      record.tongLuong - record.bhxhNLD - record.bhxhChuHo;
    const data = [...this.ledger4a$.value, record];
    this.ledger4a$.next(data);
    this.saveToStorage('ledger4a', data);
  }

  updateLedger4A(id: string, record: Partial<Ledger4ANhanVienChinhThuc>): void {
    const data = this.ledger4a$.value.map((item) => {
      if (item.id === id) {
        const updated = { ...item, ...record };
        updated.tongLuong = updated.luongCoBan + updated.phuCap;
        updated.thucLinh =
          updated.tongLuong - updated.bhxhNLD - updated.bhxhChuHo;
        return updated;
      }
      return item;
    });
    this.ledger4a$.next(data);
    this.saveToStorage('ledger4a', data);
  }

  deleteLedger4A(id: string): void {
    const data = this.ledger4a$.value.filter((item) => item.id !== id);
    this.ledger4a$.next(data);
    this.saveToStorage('ledger4a', data);
  }

  // ========== LEDGER 4B: NHÂN VIÊN KHOÁN ==========
  getLedger4B(): Observable<Ledger4BNhanVienKhoan[]> {
    return this.ledger4b$.asObservable();
  }

  addLedger4B(record: Ledger4BNhanVienKhoan): void {
    record.id = this.generateId();
    // If tiền khoán < 2,000,000, TNCN must be 0
    if (record.soTienKhoan < 2000000) {
      record.thueTNCNKhauTru = 0;
    }
    record.soTienThucTra = record.soTienKhoan - record.thueTNCNKhauTru;
    const data = [...this.ledger4b$.value, record];
    this.ledger4b$.next(data);
    this.saveToStorage('ledger4b', data);
  }

  updateLedger4B(id: string, record: Partial<Ledger4BNhanVienKhoan>): void {
    const data = this.ledger4b$.value.map((item) => {
      if (item.id === id) {
        const updated = { ...item, ...record };
        // Validate tax rule
        if (updated.soTienKhoan < 2000000) {
          updated.thueTNCNKhauTru = 0;
        }
        updated.soTienThucTra =
          updated.soTienKhoan - updated.thueTNCNKhauTru;
        return updated;
      }
      return item;
    });
    this.ledger4b$.next(data);
    this.saveToStorage('ledger4b', data);
  }

  deleteLedger4B(id: string): void {
    const data = this.ledger4b$.value.filter((item) => item.id !== id);
    this.ledger4b$.next(data);
    this.saveToStorage('ledger4b', data);
  }

  // ========== LEDGER 5: CÔNG NỢ ==========
  getLedger5(): Observable<Ledger5CongNo[]> {
    return this.ledger5$.asObservable();
  }

  addLedger5(record: Ledger5CongNo): void {
    record.id = this.generateId();
    const prevBalance =
      this.ledger5$.value.length > 0
        ? this.ledger5$.value[this.ledger5$.value.length - 1].soDu
        : 0;
    record.soDu = prevBalance + record.phatsinhTang - record.phatsinhGiam;
    const data = [...this.ledger5$.value, record];
    this.ledger5$.next(data);
    this.saveToStorage('ledger5', data);
  }

  updateLedger5(id: string, record: Partial<Ledger5CongNo>): void {
    const data = [...this.ledger5$.value];
    const index = data.findIndex((item) => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...record };
      // Recalculate running balance for this and all subsequent entries
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          data[i].soDu = data[i].phatsinhTang - data[i].phatsinhGiam;
        } else {
          data[i].soDu =
            data[i - 1].soDu +
            data[i].phatsinhTang -
            data[i].phatsinhGiam;
        }
      }
    }
    this.ledger5$.next(data);
    this.saveToStorage('ledger5', data);
  }

  deleteLedger5(id: string): void {
    const data = this.ledger5$.value
      .filter((item) => item.id !== id);
    // Recalculate running balance
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        data[i].soDu = data[i].phatsinhTang - data[i].phatsinhGiam;
      } else {
        data[i].soDu =
          data[i - 1].soDu +
          data[i].phatsinhTang -
          data[i].phatsinhGiam;
      }
    }
    this.ledger5$.next(data);
    this.saveToStorage('ledger5', data);
  }

  // ========== LEDGER 6: QUỸ TIỀN MẶT ==========
  getLedger6(): Observable<Ledger6QuyTienMat[]> {
    return this.ledger6$.asObservable();
  }

  addLedger6(record: Ledger6QuyTienMat): void {
    record.id = this.generateId();
    const prevBalance =
      this.ledger6$.value.length > 0
        ? this.ledger6$.value[this.ledger6$.value.length - 1].tonQuy
        : 0;
    record.tonQuy = prevBalance + record.thu - record.chi;

    // Warn if balance goes negative
    if (record.tonQuy < 0) {
      console.warn('Cảnh báo: Số dư âm trong quỹ tiền mặt!');
    }

    const data = [...this.ledger6$.value, record];
    this.ledger6$.next(data);
    this.saveToStorage('ledger6', data);
  }

  updateLedger6(id: string, record: Partial<Ledger6QuyTienMat>): void {
    const data = [...this.ledger6$.value];
    const index = data.findIndex((item) => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...record };
      // Recalculate running balance
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          data[i].tonQuy = data[i].thu - data[i].chi;
        } else {
          data[i].tonQuy = data[i - 1].tonQuy + data[i].thu - data[i].chi;
        }
        if (data[i].tonQuy < 0) {
          console.warn(`Cảnh báo: Số dư âm tại dòng ${i + 1}!`);
        }
      }
    }
    this.ledger6$.next(data);
    this.saveToStorage('ledger6', data);
  }

  deleteLedger6(id: string): void {
    const data = this.ledger6$.value
      .filter((item) => item.id !== id);
    // Recalculate running balance
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        data[i].tonQuy = data[i].thu - data[i].chi;
      } else {
        data[i].tonQuy = data[i - 1].tonQuy + data[i].thu - data[i].chi;
      }
    }
    this.ledger6$.next(data);
    this.saveToStorage('ledger6', data);
  }

  // ========== LEDGER 7: TIỀN NGÂN HÀNG ==========
  getLedger7(): Observable<Ledger7TienNganHang[]> {
    return this.ledger7$.asObservable();
  }

  addLedger7(record: Ledger7TienNganHang): void {
    record.id = this.generateId();
    const prevBalance =
      this.ledger7$.value.length > 0
        ? this.ledger7$.value[this.ledger7$.value.length - 1].soDu
        : 0;
    record.soDu = prevBalance + record.thu - record.chi;
    record.highlight = Math.abs(record.thu) > 20000000 || Math.abs(record.chi) > 20000000;

    const data = [...this.ledger7$.value, record];
    this.ledger7$.next(data);
    this.saveToStorage('ledger7', data);
  }

  updateLedger7(id: string, record: Partial<Ledger7TienNganHang>): void {
    const data = [...this.ledger7$.value];
    const index = data.findIndex((item) => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...record };
      data[index].highlight =
        Math.abs(data[index].thu) > 20000000 ||
        Math.abs(data[index].chi) > 20000000;
      // Recalculate running balance
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          data[i].soDu = data[i].thu - data[i].chi;
        } else {
          data[i].soDu = data[i - 1].soDu + data[i].thu - data[i].chi;
        }
      }
    }
    this.ledger7$.next(data);
    this.saveToStorage('ledger7', data);
  }

  deleteLedger7(id: string): void {
    const data = this.ledger7$.value
      .filter((item) => item.id !== id);
    // Recalculate running balance
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        data[i].soDu = data[i].thu - data[i].chi;
      } else {
        data[i].soDu = data[i - 1].soDu + data[i].thu - data[i].chi;
      }
    }
    this.ledger7$.next(data);
    this.saveToStorage('ledger7', data);
  }

  // ========== UTILITIES ==========
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private saveToStorage(key: string, data: any): void {
    localStorage.setItem(`accountant_${key}`, JSON.stringify(data));
  }

  private loadFromStorage(key: string): any[] | null {
    const data = localStorage.getItem(`accountant_${key}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Export ledger data as JSON
   */
  exportLedgerData(ledgerNumber: number): string {
    const key = `ledger${ledgerNumber}`;
    return JSON.stringify(localStorage.getItem(`accountant_${key}`), null, 2);
  }

  /**
   * Clear all ledger data (confirmation required)
   */
  clearAllData(): void {
    if (confirm('Xóa tất cả dữ liệu? Hành động này không thể hoàn tác!')) {
      for (let i = 1; i <= 7; i++) {
        localStorage.removeItem(`accountant_ledger${i}`);
      }
      localStorage.removeItem(`accountant_ledger4a`);
      localStorage.removeItem(`accountant_ledger4b`);
      this.ledger1$.next([]);
      this.ledger2$.next([]);
      this.ledger3$.next([]);
      this.ledger4a$.next([]);
      this.ledger4b$.next([]);
      this.ledger5$.next([]);
      this.ledger6$.next([]);
      this.ledger7$.next([]);
    }
  }
}
