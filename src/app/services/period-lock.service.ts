import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { delay, map, switchMap, tap } from 'rxjs/operators';
import {
  PeriodLock,
  PeriodLockChecklist,
  PeriodLockCheck,
  PeriodLockRequest,
  PeriodLockResponse,
  PeriodListResponse,
  PeriodStatus,
  PeriodType,
  LockRequirements,
  DEFAULT_LOCK_CHECKS,
  createPeriodString,
  parsePeriodString,
  getPreviousPeriod,
  formatPeriodLabel,
  canLockPeriod,
  canUserLockPeriod,
  canUserUnlockPeriod
} from '../models/period-lock.models';
import { AuditLogService } from './audit-log.service';
import { TrialBalanceService } from './trial-balance.service';
import { BalanceSheetService } from './balance-sheet.service';
import { CashFlowService } from './cash-flow.service';

/**
 * PERIOD LOCK SERVICE
 * Service quản lý khóa sổ kế toán
 *
 * NGUYÊN TẮC:
 * - Số liệu đã khóa KHÔNG được sửa trực tiếp
 * - Khóa tuần tự: phải khóa kỳ trước trước khi khóa kỳ sau
 * - Mở khóa: CHỈ ADMIN và PHẢI có lý do
 * - Mọi thao tác khóa/mở khóa đều được ghi audit log
 */
@Injectable({
  providedIn: 'root'
})
export class PeriodLockService {

  // In-memory storage for demo
  private periodLocks: Map<string, PeriodLock> = new Map();
  private periodLocks$ = new BehaviorSubject<PeriodLock[]>([]);

  // Current user context (should be from AuthService)
  private currentUser = {
    id: 'user-002',
    name: 'Trần Kế Toán Trưởng',
    role: 'CHIEF_ACCOUNTANT'
  };

  constructor(
    private auditLogService: AuditLogService,
    private trialBalanceService: TrialBalanceService,
    private balanceSheetService: BalanceSheetService,
    private cashFlowService: CashFlowService
  ) {
    this.initDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS - QUERY
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách các kỳ kế toán
   */
  getPeriodList(year: number): Observable<PeriodListResponse> {
    const periods: PeriodLock[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Tạo danh sách 12 tháng
    for (let month = 1; month <= 12; month++) {
      const periodStr = createPeriodString(year, month);
      let periodLock = this.periodLocks.get(periodStr);

      if (!periodLock) {
        // Tháng tương lai: không tạo
        if (year > currentYear || (year === currentYear && month > currentMonth)) {
          continue;
        }
        // Tạo period mặc định
        periodLock = {
          id: `PL-${periodStr}`,
          period: periodStr,
          periodType: 'MONTH',
          year,
          month,
          status: 'OPEN'
        };
      }
      periods.push(periodLock);
    }

    // Tìm current period và last locked period
    const currentPeriod = createPeriodString(currentYear, currentMonth);
    const lockedPeriods = periods.filter(p => p.status === 'LOCKED' || p.status === 'CLOSED');
    const lastLockedPeriod = lockedPeriods.length > 0 ? lockedPeriods[lockedPeriods.length - 1].period : undefined;

    // Tìm next lockable period
    let nextLockablePeriod: string | undefined;
    if (!lastLockedPeriod) {
      nextLockablePeriod = periods.find(p => p.status === 'OPEN')?.period;
    } else {
      const openPeriods = periods.filter(p => p.status === 'OPEN');
      nextLockablePeriod = openPeriods.length > 0 ? openPeriods[0].period : undefined;
    }

    return of({
      periods,
      currentPeriod,
      lastLockedPeriod,
      nextLockablePeriod
    }).pipe(delay(200));
  }

  /**
   * Lấy thông tin một kỳ
   */
  getPeriodLock(period: string): Observable<PeriodLock | undefined> {
    return of(this.periodLocks.get(period)).pipe(delay(100));
  }

  /**
   * Kiểm tra kỳ có bị khóa không
   */
  isPeriodLocked(period: string): Observable<boolean> {
    const periodLock = this.periodLocks.get(period);
    return of(periodLock?.status === 'LOCKED' || periodLock?.status === 'CLOSED').pipe(delay(50));
  }

  /**
   * Kiểm tra kỳ có bị khóa không (sync - dùng cho guards)
   */
  isPeriodLockedSync(period: string): boolean {
    const periodLock = this.periodLocks.get(period);
    return periodLock?.status === 'LOCKED' || periodLock?.status === 'CLOSED';
  }

  /**
   * Lấy checklist điều kiện khóa sổ
   */
  getLockChecklist(period: string): Observable<PeriodLockChecklist> {
    const parsed = parsePeriodString(period);
    const checks: PeriodLockCheck[] = [];

    // Check 1: Trial Balance cân đối
    const tbCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'trial_balance')!,
      passed: true, // Demo: always pass
      details: 'Tổng Nợ = Tổng Có = 125,000,000 VNĐ'
    };
    checks.push(tbCheck);

    // Check 2: BCĐKT hợp lệ
    const bsCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'balance_sheet')!,
      passed: true,
      details: 'Tài sản = Nguồn vốn = 850,000,000 VNĐ'
    };
    checks.push(bsCheck);

    // Check 3: KQKD hợp lệ
    const isCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'income_statement')!,
      passed: true,
      details: 'Lợi nhuận sau thuế: 45,000,000 VNĐ'
    };
    checks.push(isCheck);

    // Check 4: LCTT hợp lệ
    const cfCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'cash_flow')!,
      passed: true,
      details: 'Tiền cuối kỳ khớp với BCĐKT'
    };
    checks.push(cfCheck);

    // Check 5: Kỳ trước đã khóa
    const prevPeriod = getPreviousPeriod(period);
    const prevLocked = this.isPeriodLockedSync(prevPeriod);
    const prevCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'previous_period')!,
      passed: prevLocked || period === createPeriodString(parsed.year, 1), // Tháng 1 không cần check
      details: prevLocked ? `Kỳ ${formatPeriodLabel(prevPeriod)} đã khóa` : `Kỳ ${formatPeriodLabel(prevPeriod)} chưa khóa`
    };
    checks.push(prevCheck);

    // Check 6: Chứng từ đã duyệt (WARNING)
    const voucherCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'vouchers_approved')!,
      passed: true,
      details: 'Tất cả 45 chứng từ đã được duyệt'
    };
    checks.push(voucherCheck);

    // Check 7: Không có bút toán nháp (WARNING)
    const draftCheck: PeriodLockCheck = {
      ...DEFAULT_LOCK_CHECKS.find(c => c.id === 'no_draft_entries')!,
      passed: true,
      details: 'Không có bút toán nháp'
    };
    checks.push(draftCheck);

    const missingChecks = checks
      .filter(c => !c.passed && c.severity === 'REQUIRED')
      .map(c => c.name);

    return of({
      period,
      canLock: canLockPeriod({ period, canLock: true, checks, missingChecks }),
      checks,
      missingChecks
    }).pipe(delay(300));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS - COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Khóa kỳ kế toán
   */
  lockPeriod(period: string): Observable<PeriodLockResponse> {
    // Check permission
    if (!canUserLockPeriod(this.currentUser.role)) {
      return throwError(() => new Error('Bạn không có quyền khóa sổ kế toán'));
    }

    // Get checklist first
    return this.getLockChecklist(period).pipe(
      switchMap(checklist => {
        if (!checklist.canLock) {
          return throwError(() => new Error(
            `Không thể khóa kỳ ${formatPeriodLabel(period)}. Chưa đáp ứng: ${checklist.missingChecks.join(', ')}`
          ));
        }

        const parsed = parsePeriodString(period);
        const now = new Date();

        const periodLock: PeriodLock = {
          id: `PL-${period}`,
          period,
          periodType: parsed.type,
          year: parsed.year,
          month: parsed.month,
          quarter: parsed.quarter,
          status: 'LOCKED',
          lockedAt: now,
          lockedBy: this.currentUser.id,
          lockedByName: this.currentUser.name
        };

        // Save
        this.periodLocks.set(period, periodLock);
        this.notifyChange();

        // Audit log
        this.auditLogService.logLock(period, periodLock).subscribe();

        return of({
          success: true,
          periodLock,
          message: `Đã khóa kỳ ${formatPeriodLabel(period)} thành công`
        });
      }),
      delay(500)
    );
  }

  /**
   * Mở khóa kỳ kế toán (CHỈ ADMIN)
   */
  unlockPeriod(period: string, reason: string): Observable<PeriodLockResponse> {
    // Check permission
    if (!canUserUnlockPeriod(this.currentUser.role)) {
      return throwError(() => new Error('Chỉ Admin mới có quyền mở khóa sổ kế toán'));
    }

    // Reason is required
    if (!reason || reason.trim().length < 10) {
      return throwError(() => new Error('Lý do mở khóa phải có ít nhất 10 ký tự'));
    }

    const existingLock = this.periodLocks.get(period);
    if (!existingLock) {
      return throwError(() => new Error(`Không tìm thấy kỳ ${period}`));
    }

    if (existingLock.status === 'OPEN') {
      return throwError(() => new Error(`Kỳ ${formatPeriodLabel(period)} đang mở, không cần mở khóa`));
    }

    const before = { ...existingLock };
    const now = new Date();

    // Update
    existingLock.status = 'OPEN';
    existingLock.unlockedAt = now;
    existingLock.unlockedBy = this.currentUser.id;
    existingLock.unlockedByName = this.currentUser.name;
    existingLock.unlockReason = reason;

    this.periodLocks.set(period, existingLock);
    this.notifyChange();

    // Audit log (BẮT BUỘC có reason)
    this.auditLogService.logUnlock(period, before, existingLock, reason).subscribe();

    return of({
      success: true,
      periodLock: existingLock,
      message: `Đã mở khóa kỳ ${formatPeriodLabel(period)}`
    }).pipe(delay(500));
  }

  /**
   * Stream để theo dõi thay đổi
   */
  getPeriodLocksStream(): Observable<PeriodLock[]> {
    return this.periodLocks$.asObservable();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // GUARD METHODS - Dùng trong các service/component khác
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Kiểm tra xem có thể thay đổi dữ liệu trong kỳ không
   * Dùng trong các service khác trước khi save
   */
  canModifyPeriod(period: string): Observable<{ allowed: boolean; message?: string }> {
    const periodLock = this.periodLocks.get(period);

    if (!periodLock || periodLock.status === 'OPEN') {
      return of({ allowed: true });
    }

    return of({
      allowed: false,
      message: `Kỳ ${formatPeriodLabel(period)} đã khóa. Không thể sửa trực tiếp. Vui lòng tạo bút toán điều chỉnh.`
    });
  }

  /**
   * Guard: Throw error nếu kỳ đã khóa
   * Dùng ở đầu các method CREATE/UPDATE
   */
  guardLockedPeriod(period: string): void {
    if (this.isPeriodLockedSync(period)) {
      throw new Error(`Kỳ kế toán ${formatPeriodLabel(period)} đã khóa. Không thể thay đổi số liệu.`);
    }
  }

  /**
   * Lấy thông báo cho user khi kỳ đã khóa
   */
  getLockedPeriodMessage(period: string): string {
    const lock = this.periodLocks.get(period);
    if (!lock || lock.status === 'OPEN') {
      return '';
    }

    const lockedDate = lock.lockedAt ? new Date(lock.lockedAt).toLocaleDateString('vi-VN') : '';
    return `Kỳ ${formatPeriodLabel(period)} đã khóa sổ ngày ${lockedDate} bởi ${lock.lockedByName}. ` +
           `Để điều chỉnh số liệu, vui lòng tạo bút toán điều chỉnh ở kỳ sau.`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private notifyChange(): void {
    this.periodLocks$.next(Array.from(this.periodLocks.values()));
  }

  private initDemoData(): void {
    // Demo: Khóa các tháng trước đó
    const demoLocks: PeriodLock[] = [
      {
        id: 'PL-2025-01',
        period: '2025-01',
        periodType: 'MONTH',
        year: 2025,
        month: 1,
        status: 'LOCKED',
        lockedAt: new Date('2025-02-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-02',
        period: '2025-02',
        periodType: 'MONTH',
        year: 2025,
        month: 2,
        status: 'LOCKED',
        lockedAt: new Date('2025-03-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-03',
        period: '2025-03',
        periodType: 'MONTH',
        year: 2025,
        month: 3,
        status: 'LOCKED',
        lockedAt: new Date('2025-04-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-04',
        period: '2025-04',
        periodType: 'MONTH',
        year: 2025,
        month: 4,
        status: 'LOCKED',
        lockedAt: new Date('2025-05-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-05',
        period: '2025-05',
        periodType: 'MONTH',
        year: 2025,
        month: 5,
        status: 'LOCKED',
        lockedAt: new Date('2025-06-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-06',
        period: '2025-06',
        periodType: 'MONTH',
        year: 2025,
        month: 6,
        status: 'LOCKED',
        lockedAt: new Date('2025-07-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-07',
        period: '2025-07',
        periodType: 'MONTH',
        year: 2025,
        month: 7,
        status: 'LOCKED',
        lockedAt: new Date('2025-08-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-08',
        period: '2025-08',
        periodType: 'MONTH',
        year: 2025,
        month: 8,
        status: 'LOCKED',
        lockedAt: new Date('2025-09-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-09',
        period: '2025-09',
        periodType: 'MONTH',
        year: 2025,
        month: 9,
        status: 'LOCKED',
        lockedAt: new Date('2025-10-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-10',
        period: '2025-10',
        periodType: 'MONTH',
        year: 2025,
        month: 10,
        status: 'LOCKED',
        lockedAt: new Date('2025-11-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      {
        id: 'PL-2025-11',
        period: '2025-11',
        periodType: 'MONTH',
        year: 2025,
        month: 11,
        status: 'LOCKED',
        lockedAt: new Date('2025-12-05'),
        lockedBy: 'user-002',
        lockedByName: 'Trần Kế Toán Trưởng'
      },
      // Tháng 12 đang mở
      {
        id: 'PL-2025-12',
        period: '2025-12',
        periodType: 'MONTH',
        year: 2025,
        month: 12,
        status: 'OPEN'
      }
    ];

    demoLocks.forEach(lock => {
      this.periodLocks.set(lock.period, lock);
    });
    this.notifyChange();
  }
}
