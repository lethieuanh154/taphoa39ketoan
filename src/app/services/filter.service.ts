/**
 * Filter Service for Accounting Ledgers
 * Manages month/year filtering across all 7 ledgers
 * Supports continuous accounting logic
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface DateRange {
  fromDate: Date | null;
  toDate: Date | null;
}

export interface LedgerFilter {
  month: number; // 1-12
  year: number;  // e.g., 2024
  dateRange: DateRange; // Optional within-month range
  applyDateRange: boolean; // Whether to apply the date range filter
}

@Injectable({
  providedIn: 'root',
})
export class FilterService {
  private filterSubject = new BehaviorSubject<LedgerFilter>(
    this.getDefaultFilter()
  );

  filter$ = this.filterSubject.asObservable();

  constructor() {
    this.loadFilterFromStorage();
  }

  private getDefaultFilter(): LedgerFilter {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      dateRange: {
        fromDate: null,
        toDate: null,
      },
      applyDateRange: false,
    };
  }

  /**
   * Set month and year filter
   */
  setMonthYear(month: number, year: number): void {
    const current = this.filterSubject.value;
    this.filterSubject.next({
      ...current,
      month: Math.max(1, Math.min(12, month)),
      year,
    });
    this.saveFilterToStorage();
  }

  /**
   * Set optional date range within the selected month
   */
  setDateRange(fromDate: Date | null, toDate: Date | null): void {
    const current = this.filterSubject.value;
    this.filterSubject.next({
      ...current,
      dateRange: { fromDate, toDate },
      applyDateRange: fromDate !== null || toDate !== null,
    });
    this.saveFilterToStorage();
  }

  /**
   * Toggle date range filter on/off
   */
  toggleDateRange(enabled: boolean): void {
    const current = this.filterSubject.value;
    this.filterSubject.next({
      ...current,
      applyDateRange: enabled,
    });
    this.saveFilterToStorage();
  }

  /**
   * Get current filter
   */
  getFilter(): LedgerFilter {
    return this.filterSubject.value;
  }

  /**
   * Reset to current month/year
   */
  resetToCurrentMonth(): void {
    this.filterSubject.next(this.getDefaultFilter());
    this.saveFilterToStorage();
  }

  /**
   * Move to previous month
   */
  previousMonth(): void {
    const current = this.filterSubject.value;
    let { month, year } = current;
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    this.setMonthYear(month, year);
  }

  /**
   * Move to next month
   */
  nextMonth(): void {
    const current = this.filterSubject.value;
    let { month, year } = current;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    this.setMonthYear(month, year);
  }

  /**
   * Check if a date falls within the current filter range
   */
  isDateInRange(date: Date | string | null | undefined): boolean {
    if (!date) return false;

    const d = typeof date === 'string' ? new Date(date) : date;
    const filter = this.filterSubject.value;

    // Check month/year
    if (d.getMonth() + 1 !== filter.month || d.getFullYear() !== filter.year) {
      return false;
    }

    // Check date range if enabled
    if (filter.applyDateRange && filter.dateRange) {
      const { fromDate, toDate } = filter.dateRange;
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
    }

    return true;
  }

  /**
   * Filter array of records by current filter
   */
  filterRecords<T extends { [key: string]: any }>(
    records: T[],
    dateFieldKey: string,
    nestedKey?: string
  ): T[] {
    return records.filter((record) => {
      let date = record[dateFieldKey];
      if (nestedKey) {
        date = record[dateFieldKey]?.[nestedKey];
      }
      return this.isDateInRange(date);
    });
  }

  /**
   * Get month display string (e.g., "Tháng 12/2024")
   */
  getFilterDisplayText(): string {
    const filter = this.filterSubject.value;
    return `Tháng ${filter.month}/${filter.year}`;
  }

  /**
   * Get date range display text
   */
  getDateRangeDisplayText(): string {
    const filter = this.filterSubject.value;
    if (!filter.applyDateRange || !filter.dateRange) return '';

    const formatDate = (date: Date | null): string => {
      if (!date) return '';
      return `${date.getDate()}/${date.getMonth() + 1}`;
    };

    const from = formatDate(filter.dateRange.fromDate);
    const to = formatDate(filter.dateRange.toDate);

    if (from && to) return `(${from} - ${to})`;
    if (from) return `(từ ${from})`;
    if (to) return `(đến ${to})`;
    return '';
  }

  /**
   * Save filter to localStorage
   */
  private saveFilterToStorage(): void {
    const filter = this.filterSubject.value;
    const serialized = {
      month: filter.month,
      year: filter.year,
      dateRange: {
        fromDate: filter.dateRange.fromDate?.toISOString() || null,
        toDate: filter.dateRange.toDate?.toISOString() || null,
      },
      applyDateRange: filter.applyDateRange,
    };
    localStorage.setItem('ledger_filter', JSON.stringify(serialized));
  }

  /**
   * Load filter from localStorage
   */
  private loadFilterFromStorage(): void {
    const stored = localStorage.getItem('ledger_filter');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const filter: LedgerFilter = {
          month: data.month,
          year: data.year,
          dateRange: {
            fromDate: data.dateRange?.fromDate ? new Date(data.dateRange.fromDate) : null,
            toDate: data.dateRange?.toDate ? new Date(data.dateRange.toDate) : null,
          },
          applyDateRange: data.applyDateRange || false,
        };
        this.filterSubject.next(filter);
      } catch (e) {
        console.warn('Failed to load filter from storage:', e);
      }
    }
  }

  /**
   * Export current month data with proper accounting continuity
   * Returns data filtered by current month
   */
  getMonthData<T extends { [key: string]: any }>(
    records: T[],
    dateFieldKey: string,
    nestedKey?: string
  ): T[] {
    return this.filterRecords(records, dateFieldKey, nestedKey);
  }
}
