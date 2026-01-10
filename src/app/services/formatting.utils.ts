/**
 * Utility functions for accounting ledgers
 */

/**
 * Format number as currency (VND) with en-US style separators (1,000,000)
 */
export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0 ₫';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ₫';
}

/**
 * Format number with thousand separators (en-US style: 1,000,000)
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format quantity (plain number without currency symbol, en-US style)
 */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date as dd/MM/yyyy
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse dd/MM/yyyy string to Date
 */
export function parseDate(dateString: string): Date | null {
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  // Validate date
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Get current month/year as MM/yyyy
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}/${year}`;
}

/**
 * Check if date is in given month/year
 */
export function isDateInMonth(
  date: Date | string,
  month: number,
  year: number
): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getMonth() === month - 1 && d.getFullYear() === year;
}

/**
 * Validate required fields
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate email (for contact purposes)
 */
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate Vietnamese ID number (CMND/CCCD)
 * Simple validation: 9 or 12 digits
 */
export function validateIDNumber(id: string): boolean {
  const cleaned = id.replace(/\D/g, '');
  return cleaned.length === 9 || cleaned.length === 12;
}

/**
 * Check if amount exceeds 2,000,000 VND
 */
export function exceedsSubsidyLimit(amount: number): boolean {
  return amount >= 2000000;
}

/**
 * Calculate sum of values in array
 */
export function sumValues(values: (number | null | undefined)[]): number {
  return values.reduce((sum: number, val) => sum + (val || 0), 0);
}

/**
 * Format ledger name in Vietnamese
 */
export function getLedgerDisplayName(ledgerNumber: number): string {
  const names: { [key: number]: string } = {
    1: 'Sổ Chi Tiết Doanh Thu',
    2: 'Sổ Chi Tiết Vật Liệu - Hàng Hóa',
    3: 'Sổ Chi Phí Sản Xuất Kinh Doanh',
    4: 'Sổ Theo Dõi Tiền Lương & Nhân Công',
    5: 'Sổ Theo Dõi Tình Hình Thanh Toán (Công Nợ)',
    6: 'Sổ Quỹ Tiền Mặt',
    7: 'Sổ Tiền Gửi Ngân Hàng',
  };
  return names[ledgerNumber] || 'Sổ Kế Toán';
}

/**
 * Get color class for highlighting
 */
export function getHighlightClass(shouldHighlight: boolean): string {
  return shouldHighlight ? 'bg-yellow-100 border-yellow-400' : '';
}
