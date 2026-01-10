import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PeriodLockService } from '../../services/period-lock.service';
import {
  PeriodLock,
  PeriodLockChecklist,
  PeriodLockCheck,
  PeriodStatus,
  PERIOD_STATUS_LABELS,
  PERIOD_STATUS_COLORS,
  PERIOD_STATUS_ICONS,
  formatPeriodLabel,
  canUserLockPeriod,
  canUserUnlockPeriod
} from '../../models/period-lock.models';

/**
 * PERIOD LOCK PAGE
 * Trang quản lý khóa sổ kế toán
 *
 * Tính năng:
 * - Hiển thị danh sách các kỳ kế toán
 * - Kiểm tra điều kiện khóa sổ (checklist)
 * - Khóa/Mở khóa kỳ kế toán
 * - Hiển thị lịch sử khóa/mở khóa
 */
@Component({
  selector: 'app-period-lock-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './period-lock-page.component.html',
  styleUrl: './period-lock-page.component.css'
})
export class PeriodLockPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  periods: PeriodLock[] = [];
  currentPeriod = '';
  lastLockedPeriod = '';
  nextLockablePeriod = '';
  isLoading = false;
  error: string | null = null;

  // Year filter
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];

  // Selected period for action
  selectedPeriodForAction: PeriodLock | null = null;
  checklist: PeriodLockChecklist | null = null;
  isLoadingChecklist = false;

  // Modal states
  showLockModal = false;
  showUnlockModal = false;
  showChecklistModal = false;

  // Unlock reason (required)
  unlockReason = '';
  unlockError = '';

  // User role (should be from AuthService)
  currentUserRole = 'CHIEF_ACCOUNTANT'; // Demo: can lock but not unlock

  // Constants for template
  PERIOD_STATUS_LABELS = PERIOD_STATUS_LABELS;
  PERIOD_STATUS_COLORS = PERIOD_STATUS_COLORS;
  PERIOD_STATUS_ICONS = PERIOD_STATUS_ICONS;

  constructor(private periodLockService: PeriodLockService) {}

  ngOnInit(): void {
    this.initYears();
    this.loadPeriods();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INIT & LOAD
  // ═══════════════════════════════════════════════════════════════════════════════

  initYears(): void {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      this.availableYears.push(y);
    }
  }

  loadPeriods(): void {
    this.isLoading = true;
    this.error = null;

    this.periodLockService.getPeriodList(this.selectedYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.periods = response.periods;
          this.currentPeriod = response.currentPeriod;
          this.lastLockedPeriod = response.lastLockedPeriod || '';
          this.nextLockablePeriod = response.nextLockablePeriod || '';
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Không thể tải danh sách kỳ kế toán';
          this.isLoading = false;
          console.error('Error loading periods:', err);
        }
      });
  }

  onYearChange(): void {
    this.loadPeriods();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════════════════════════════════

  viewChecklist(period: PeriodLock): void {
    this.selectedPeriodForAction = period;
    this.isLoadingChecklist = true;
    this.showChecklistModal = true;
    this.checklist = null;

    this.periodLockService.getLockChecklist(period.period)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (checklist) => {
          this.checklist = checklist;
          this.isLoadingChecklist = false;
        },
        error: (err) => {
          this.isLoadingChecklist = false;
          console.error('Error loading checklist:', err);
        }
      });
  }

  closeChecklistModal(): void {
    this.showChecklistModal = false;
    this.selectedPeriodForAction = null;
    this.checklist = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCK PERIOD
  // ═══════════════════════════════════════════════════════════════════════════════

  openLockModal(period: PeriodLock): void {
    if (!this.canLock) return;
    this.selectedPeriodForAction = period;
    this.showLockModal = true;

    // Load checklist for confirmation
    this.isLoadingChecklist = true;
    this.periodLockService.getLockChecklist(period.period)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (checklist) => {
          this.checklist = checklist;
          this.isLoadingChecklist = false;
        },
        error: () => {
          this.isLoadingChecklist = false;
        }
      });
  }

  closeLockModal(): void {
    this.showLockModal = false;
    this.selectedPeriodForAction = null;
    this.checklist = null;
  }

  confirmLock(): void {
    if (!this.selectedPeriodForAction || !this.checklist?.canLock) return;

    this.isLoading = true;
    this.periodLockService.lockPeriod(this.selectedPeriodForAction.period)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.closeLockModal();
          this.loadPeriods();
          alert(response.message);
        },
        error: (err) => {
          this.isLoading = false;
          alert(err.message || 'Không thể khóa kỳ kế toán');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UNLOCK PERIOD
  // ═══════════════════════════════════════════════════════════════════════════════

  openUnlockModal(period: PeriodLock): void {
    if (!this.canUnlock) return;
    this.selectedPeriodForAction = period;
    this.unlockReason = '';
    this.unlockError = '';
    this.showUnlockModal = true;
  }

  closeUnlockModal(): void {
    this.showUnlockModal = false;
    this.selectedPeriodForAction = null;
    this.unlockReason = '';
    this.unlockError = '';
  }

  confirmUnlock(): void {
    if (!this.selectedPeriodForAction) return;

    // Validate reason
    if (!this.unlockReason || this.unlockReason.trim().length < 10) {
      this.unlockError = 'Lý do mở khóa phải có ít nhất 10 ký tự';
      return;
    }

    this.isLoading = true;
    this.periodLockService.unlockPeriod(this.selectedPeriodForAction.period, this.unlockReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.closeUnlockModal();
          this.loadPeriods();
          alert(response.message);
        },
        error: (err) => {
          this.isLoading = false;
          this.unlockError = err.message || 'Không thể mở khóa kỳ kế toán';
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  get canLock(): boolean {
    return canUserLockPeriod(this.currentUserRole);
  }

  get canUnlock(): boolean {
    return canUserUnlockPeriod(this.currentUserRole);
  }

  formatPeriod(period: string): string {
    return formatPeriodLabel(period);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('vi-VN');
  }

  getStatusColor(status: PeriodStatus): string {
    return PERIOD_STATUS_COLORS[status];
  }

  getStatusIcon(status: PeriodStatus): string {
    return PERIOD_STATUS_ICONS[status];
  }

  isCurrentPeriod(period: PeriodLock): boolean {
    return period.period === this.currentPeriod;
  }

  isNextLockable(period: PeriodLock): boolean {
    return period.period === this.nextLockablePeriod && period.status === 'OPEN';
  }

  // Summary stats
  get lockedCount(): number {
    return this.periods.filter(p => p.status === 'LOCKED' || p.status === 'CLOSED').length;
  }

  get openCount(): number {
    return this.periods.filter(p => p.status === 'OPEN').length;
  }

  get totalPeriods(): number {
    return this.periods.length;
  }

  getCheckIcon(passed: boolean): string {
    return passed ? 'fa-check-circle' : 'fa-times-circle';
  }

  getCheckColor(passed: boolean): string {
    return passed ? '#22c55e' : '#ef4444';
  }
}
