import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodService, PeriodType, formatVn } from '../../../services/period.service';

/** Thanh chọn kỳ dùng chung — đặt ở đầu vùng nội dung của MainLayout. */
@Component({
  selector: 'app-period-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './period-selector.component.html',
  styleUrl: './period-selector.component.css',
})
export class PeriodSelectorComponent {
  private periodService = inject(PeriodService);

  readonly period = this.periodService.period;
  readonly label = this.periodService.label;
  readonly year = computed(() => Number(this.period().from.slice(0, 4)));
  readonly month = computed(() => Number(this.period().from.slice(5, 7)));
  readonly quarter = computed(() => Math.floor((this.month() - 1) / 3) + 1);
  readonly rangeText = computed(() => `${formatVn(this.period().from)} → ${formatVn(this.period().to)}`);

  readonly presets: { type: PeriodType; label: string }[] = [
    { type: 'today', label: 'Hôm nay' },
    { type: 'week', label: 'Tuần này' },
    { type: 'month', label: 'Tháng' },
    { type: 'quarter', label: 'Quý' },
    { type: 'year', label: 'Năm' },
    { type: 'custom', label: 'Từ ngày – đến ngày' },
  ];
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly quarters = [1, 2, 3, 4];
  readonly years = buildYears();

  customFrom = '';
  customTo = '';
  customError = '';

  constructor() {
    effect(() => {
      const { from, to } = this.period();
      this.customFrom = from;
      this.customTo = to;
    });
  }

  selectPreset(type: PeriodType): void {
    this.customError = '';
    this.periodService.selectPreset(type);
  }

  shift(step: 1 | -1): void {
    this.customError = '';
    this.periodService.shift(step);
  }

  onMonthChange(month: number): void {
    this.periodService.setMonth(this.year(), Number(month));
  }

  onQuarterChange(quarter: number): void {
    this.periodService.setQuarter(this.year(), Number(quarter));
  }

  onYearChange(year: number): void {
    const y = Number(year);
    switch (this.period().type) {
      case 'month':
        this.periodService.setMonth(y, this.month());
        break;
      case 'quarter':
        this.periodService.setQuarter(y, this.quarter());
        break;
      default:
        this.periodService.setYear(y);
    }
  }

  applyCustom(): void {
    this.customError = this.periodService.setCustom(this.customFrom, this.customTo) || '';
  }
}

/** Từ 2020 đến năm sau năm hiện tại (dữ liệu test 2026). */
function buildYears(): number[] {
  const last = new Date().getFullYear() + 1;
  return Array.from({ length: last - 2020 + 1 }, (_, i) => last - i);
}
