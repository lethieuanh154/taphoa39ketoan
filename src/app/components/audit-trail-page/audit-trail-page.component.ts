import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuditLogService } from '../../services/audit-log.service';
import {
  AuditLog,
  AuditLogFilter,
  AuditEntityType,
  AuditAction,
  AuditChange,
  ENTITY_TYPE_LABELS,
  ACTION_LABELS,
  ACTION_COLORS,
  ACTION_ICONS,
  formatAuditValue
} from '../../models/audit-log.models';

/**
 * AUDIT TRAIL PAGE
 * Trang xem dấu vết kiểm toán
 *
 * Tính năng:
 * - Timeline view các thay đổi
 * - Filter theo user, ngày, loại hành động
 * - Diff viewer: highlight giá trị thay đổi
 * - Export audit log
 */
@Component({
  selector: 'app-audit-trail-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-trail-page.component.html',
  styleUrl: './audit-trail-page.component.css'
})
export class AuditTrailPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  auditLogs: AuditLog[] = [];
  isLoading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  totalPages = 0;

  // Summary
  summary = {
    totalActions: 0,
    byAction: {} as Record<AuditAction, number>,
    byEntityType: {} as Record<AuditEntityType, number>,
    uniqueUsers: 0
  };

  // Filter
  filter: AuditLogFilter = {};
  entityTypes = Object.entries(ENTITY_TYPE_LABELS) as [AuditEntityType, string][];
  actions = Object.entries(ACTION_LABELS) as [AuditAction, string][];
  users: { id: string; name: string }[] = [];

  // Date filter
  filterFromDate: string = '';
  filterToDate: string = '';

  // Selected log for detail view
  selectedLog: AuditLog | null = null;
  showDetailModal = false;

  // Constants for template
  ENTITY_TYPE_LABELS = ENTITY_TYPE_LABELS;
  ACTION_LABELS = ACTION_LABELS;
  ACTION_COLORS = ACTION_COLORS;
  ACTION_ICONS = ACTION_ICONS;

  constructor(private auditLogService: AuditLogService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadAuditLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  loadAuditLogs(): void {
    this.isLoading = true;
    this.error = null;

    // Build filter
    const filter: AuditLogFilter = { ...this.filter };
    if (this.filterFromDate) {
      filter.fromDate = new Date(this.filterFromDate);
    }
    if (this.filterToDate) {
      filter.toDate = new Date(this.filterToDate);
      filter.toDate.setHours(23, 59, 59);
    }

    this.auditLogService.getAuditLogs(filter, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.auditLogs = response.logs;
          this.totalItems = response.pagination.totalItems;
          this.totalPages = response.pagination.totalPages;
          this.summary = response.summary;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Không thể tải dữ liệu audit log';
          this.isLoading = false;
          console.error('Error loading audit logs:', err);
        }
      });
  }

  loadUsers(): void {
    this.auditLogService.getUniqueUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTER
  // ═══════════════════════════════════════════════════════════════════════════════

  applyFilter(): void {
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  clearFilter(): void {
    this.filter = {};
    this.filterFromDate = '';
    this.filterToDate = '';
    this.currentPage = 1;
    this.loadAuditLogs();
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════════

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadAuditLogs();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════════════

  viewDetail(log: AuditLog): void {
    this.selectedLog = log;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedLog = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getActionColor(action: AuditAction): string {
    return ACTION_COLORS[action] || '#6b7280';
  }

  getActionIcon(action: AuditAction): string {
    return ACTION_ICONS[action] || 'fa-circle';
  }

  formatValue(value: any, dataType: AuditChange['dataType']): string {
    return formatAuditValue(value, dataType);
  }

  getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return this.formatDate(timestamp);
  }

  // Group logs by date for timeline view
  get groupedLogs(): Map<string, AuditLog[]> {
    const groups = new Map<string, AuditLog[]>();

    this.auditLogs.forEach(log => {
      const dateKey = this.formatDate(log.timestamp);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(log);
    });

    return groups;
  }

  // Export
  exportAuditLog(): void {
    // TODO: Implement export to Excel/PDF
    alert('Chức năng xuất báo cáo đang phát triển');
  }
}
