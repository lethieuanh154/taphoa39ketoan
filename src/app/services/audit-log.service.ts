import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  AuditLog,
  AuditLogFilter,
  AuditLogResponse,
  AuditEntityType,
  AuditAction,
  createAuditLog,
  detectChanges,
  ACTIONS_REQUIRE_REASON
} from '../models/audit-log.models';

/**
 * AUDIT LOG SERVICE
 * Service quản lý dấu vết kiểm toán
 *
 * NGUYÊN TẮC:
 * - Mọi thay đổi dữ liệu kế toán PHẢI được ghi log
 * - KHÔNG được xóa audit log
 * - Hành động nhạy cảm (ADJUST, UNLOCK) BẮT BUỘC có reason
 */
@Injectable({
  providedIn: 'root'
})
export class AuditLogService {

  // In-memory storage for demo (thực tế sẽ gọi API)
  private auditLogs: AuditLog[] = [];
  private auditLogs$ = new BehaviorSubject<AuditLog[]>([]);

  // Current user context (should be from AuthService in production)
  private currentUser = {
    id: 'user-001',
    name: 'Nguyễn Kế Toán',
    role: 'ACCOUNTANT'
  };

  constructor() {
    this.initDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Ghi log thay đổi
   * Đây là method CHÍNH được gọi khi có thay đổi dữ liệu
   */
  logChange(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    before: any,
    after: any,
    reason?: string,
    entityName?: string
  ): Observable<AuditLog> {
    // Validate reason for sensitive actions
    if (ACTIONS_REQUIRE_REASON.includes(action) && !reason) {
      throw new Error(`Hành động "${action}" bắt buộc phải có lý do`);
    }

    const logEntry: AuditLog = {
      id: this.generateId(),
      entityType,
      entityId,
      entityName,
      action,
      before,
      after,
      changes: before && after ? detectChanges(before, after) : undefined,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userRole: this.currentUser.role,
      timestamp: new Date(),
      reason,
      period: this.extractPeriod(after || before)
    };

    // Add to storage
    this.auditLogs.unshift(logEntry);
    this.auditLogs$.next(this.auditLogs);

    // TODO: Call API to persist
    // return this.http.post<AuditLog>('/api/audit-logs', logEntry);

    return of(logEntry).pipe(delay(100));
  }

  /**
   * Ghi log CREATE
   */
  logCreate(
    entityType: AuditEntityType,
    entityId: string,
    data: any,
    entityName?: string
  ): Observable<AuditLog> {
    return this.logChange(entityType, entityId, 'CREATE', null, data, undefined, entityName);
  }

  /**
   * Ghi log UPDATE
   */
  logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    before: any,
    after: any,
    entityName?: string
  ): Observable<AuditLog> {
    return this.logChange(entityType, entityId, 'UPDATE', before, after, undefined, entityName);
  }

  /**
   * Ghi log ADJUST (điều chỉnh sau khóa sổ)
   */
  logAdjust(
    entityType: AuditEntityType,
    entityId: string,
    before: any,
    after: any,
    reason: string,
    entityName?: string
  ): Observable<AuditLog> {
    return this.logChange(entityType, entityId, 'ADJUST', before, after, reason, entityName);
  }

  /**
   * Ghi log LOCK (khóa kỳ)
   */
  logLock(period: string, data: any): Observable<AuditLog> {
    return this.logChange('PERIOD_LOCK', period, 'LOCK', null, data, undefined, `Khóa kỳ ${period}`);
  }

  /**
   * Ghi log UNLOCK (mở khóa kỳ - BẮT BUỘC có reason)
   */
  logUnlock(period: string, before: any, after: any, reason: string): Observable<AuditLog> {
    return this.logChange('PERIOD_LOCK', period, 'UNLOCK', before, after, reason, `Mở khóa kỳ ${period}`);
  }

  /**
   * Lấy danh sách audit logs
   */
  getAuditLogs(filter: AuditLogFilter, page: number = 1, pageSize: number = 50): Observable<AuditLogResponse> {
    // TODO: Call API
    // return this.http.get<AuditLogResponse>('/api/audit-logs', { params: ... });

    let filtered = [...this.auditLogs];

    // Apply filters
    if (filter.entityType) {
      filtered = filtered.filter(l => l.entityType === filter.entityType);
    }
    if (filter.entityId) {
      filtered = filtered.filter(l => l.entityId === filter.entityId);
    }
    if (filter.action) {
      filtered = filtered.filter(l => l.action === filter.action);
    }
    if (filter.userId) {
      filtered = filtered.filter(l => l.userId === filter.userId);
    }
    if (filter.fromDate) {
      filtered = filtered.filter(l => new Date(l.timestamp) >= filter.fromDate!);
    }
    if (filter.toDate) {
      filtered = filtered.filter(l => new Date(l.timestamp) <= filter.toDate!);
    }
    if (filter.period) {
      filtered = filtered.filter(l => l.period === filter.period);
    }
    if (filter.searchText) {
      const search = filter.searchText.toLowerCase();
      filtered = filtered.filter(l =>
        l.reason?.toLowerCase().includes(search) ||
        l.entityName?.toLowerCase().includes(search) ||
        l.userName.toLowerCase().includes(search)
      );
    }

    // Pagination
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    // Summary
    const summary = this.calculateSummary(filtered);

    return of({
      logs: paginated,
      pagination: {
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize)
      },
      summary
    }).pipe(delay(200));
  }

  /**
   * Lấy audit logs cho một entity cụ thể
   */
  getEntityAuditLogs(entityType: AuditEntityType, entityId: string): Observable<AuditLog[]> {
    return this.getAuditLogs({ entityType, entityId }).pipe(
      map(response => response.logs)
    );
  }

  /**
   * Lấy audit log theo ID
   */
  getAuditLogById(id: string): Observable<AuditLog | undefined> {
    const log = this.auditLogs.find(l => l.id === id);
    return of(log).pipe(delay(100));
  }

  /**
   * Stream để theo dõi thay đổi realtime
   */
  getAuditLogsStream(): Observable<AuditLog[]> {
    return this.auditLogs$.asObservable();
  }

  /**
   * Lấy danh sách users đã thực hiện thay đổi
   */
  getUniqueUsers(): Observable<{ id: string; name: string }[]> {
    const users = new Map<string, string>();
    this.auditLogs.forEach(l => {
      users.set(l.userId, l.userName);
    });
    return of(Array.from(users.entries()).map(([id, name]) => ({ id, name }))).pipe(delay(100));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractPeriod(data: any): string | undefined {
    if (!data) return undefined;
    if (data.period) return data.period;
    if (data.entryDate) {
      const date = new Date(data.entryDate);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    return undefined;
  }

  private calculateSummary(logs: AuditLog[]): AuditLogResponse['summary'] {
    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const uniqueUserIds = new Set<string>();

    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntityType[log.entityType] = (byEntityType[log.entityType] || 0) + 1;
      uniqueUserIds.add(log.userId);
    });

    return {
      totalActions: logs.length,
      byAction: byAction as Record<AuditAction, number>,
      byEntityType: byEntityType as Record<AuditEntityType, number>,
      uniqueUsers: uniqueUserIds.size
    };
  }

  private initDemoData(): void {
    const now = new Date();
    const demoLogs: AuditLog[] = [
      // Khóa kỳ
      {
        id: 'AUDIT-001',
        entityType: 'PERIOD_LOCK',
        entityId: '2025-11',
        entityName: 'Khóa kỳ Tháng 11/2025',
        action: 'LOCK',
        before: null,
        after: { period: '2025-11', status: 'LOCKED' },
        userId: 'user-002',
        userName: 'Trần Kế Toán Trưởng',
        userRole: 'CHIEF_ACCOUNTANT',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        period: '2025-11'
      },
      // Tạo chứng từ
      {
        id: 'AUDIT-002',
        entityType: 'VOUCHER',
        entityId: 'PT-202512-001',
        entityName: 'Phiếu thu PT-202512-001',
        action: 'CREATE',
        before: null,
        after: { id: 'PT-202512-001', amount: 5000000, description: 'Thu tiền bán hàng' },
        userId: 'user-001',
        userName: 'Nguyễn Kế Toán',
        userRole: 'ACCOUNTANT',
        timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        period: '2025-12'
      },
      // Cập nhật bút toán
      {
        id: 'AUDIT-003',
        entityType: 'JOURNAL',
        entityId: 'JE-202512-001',
        entityName: 'Bút toán JE-202512-001',
        action: 'UPDATE',
        before: { amount: 4500000 },
        after: { amount: 5000000 },
        changes: [
          { field: 'amount', fieldLabel: 'Số tiền', oldValue: 4500000, newValue: 5000000, dataType: 'number' }
        ],
        userId: 'user-001',
        userName: 'Nguyễn Kế Toán',
        userRole: 'ACCOUNTANT',
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        period: '2025-12'
      },
      // Điều chỉnh sau khóa
      {
        id: 'AUDIT-004',
        entityType: 'JOURNAL',
        entityId: 'JE-202511-ADJ01',
        entityName: 'Bút toán điều chỉnh JE-202511-ADJ01',
        action: 'ADJUST',
        before: { amount: 0 },
        after: { amount: 1200000, description: 'Điều chỉnh khấu hao T11' },
        userId: 'user-002',
        userName: 'Trần Kế Toán Trưởng',
        userRole: 'CHIEF_ACCOUNTANT',
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        reason: 'Phát hiện thiếu hạch toán khấu hao TSCĐ tháng 11',
        period: '2025-12'
      },
      // Mở khóa kỳ (admin)
      {
        id: 'AUDIT-005',
        entityType: 'PERIOD_LOCK',
        entityId: '2025-10',
        entityName: 'Mở khóa kỳ Tháng 10/2025',
        action: 'UNLOCK',
        before: { period: '2025-10', status: 'LOCKED' },
        after: { period: '2025-10', status: 'OPEN' },
        userId: 'admin-001',
        userName: 'Admin Hệ Thống',
        userRole: 'ADMIN',
        timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        reason: 'Theo yêu cầu của kiểm toán viên để điều chỉnh số liệu đối chiếu',
        period: '2025-10'
      },
      // Phê duyệt chứng từ
      {
        id: 'AUDIT-006',
        entityType: 'VOUCHER',
        entityId: 'PC-202512-003',
        entityName: 'Phiếu chi PC-202512-003',
        action: 'APPROVE',
        before: { status: 'PENDING' },
        after: { status: 'APPROVED' },
        userId: 'user-002',
        userName: 'Trần Kế Toán Trưởng',
        userRole: 'CHIEF_ACCOUNTANT',
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        period: '2025-12'
      },
      // Xuất báo cáo
      {
        id: 'AUDIT-007',
        entityType: 'BALANCE_SHEET',
        entityId: '2025-12',
        entityName: 'BCĐKT Tháng 12/2025',
        action: 'EXPORT',
        before: null,
        after: { format: 'PDF', exportedAt: new Date().toISOString() },
        userId: 'user-001',
        userName: 'Nguyễn Kế Toán',
        userRole: 'ACCOUNTANT',
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        period: '2025-12'
      }
    ];

    this.auditLogs = demoLogs;
    this.auditLogs$.next(this.auditLogs);
  }
}
