import { Injectable } from '@angular/core';
import { Observable, of, delay, map, BehaviorSubject } from 'rxjs';
import {
  Account,
  AccountFilter,
  AccountGroup,
  AccountType,
  AccountStatus,
  ALL_ACCOUNTS_TEMPLATE,
  getAccountLevel,
  getParentCode,
  getAccountTypeName,
  searchAccounts
} from '../models/chart-of-accounts.models';

/**
 * SERVICE: HỆ THỐNG TÀI KHOẢN KẾ TOÁN
 *
 * Quản lý danh mục tài khoản theo TT133/2016/TT-BTC
 */
@Injectable({
  providedIn: 'root'
})
export class ChartOfAccountsService {

  private accounts$ = new BehaviorSubject<Account[]>([]);

  constructor() {
    // Initialize with default accounts
    this.initializeAccounts();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lấy tất cả tài khoản
   */
  getAccounts(filter?: AccountFilter): Observable<Account[]> {
    return this.accounts$.pipe(
      delay(200),
      map(accounts => {
        let filtered = [...accounts];

        if (filter) {
          if (filter.search) {
            filtered = searchAccounts(filtered, filter.search);
          }

          if (filter.type) {
            filtered = filtered.filter(a => a.type === filter.type);
          }

          if (filter.level !== undefined) {
            filtered = filtered.filter(a => a.level === filter.level);
          }

          if (filter.status) {
            filtered = filtered.filter(a => a.status === filter.status);
          }

          if (filter.isParent !== undefined) {
            filtered = filtered.filter(a => a.isParent === filter.isParent);
          }

          if (filter.parentCode) {
            filtered = filtered.filter(a => a.parentCode === filter.parentCode);
          }
        }

        return filtered.sort((a, b) => a.code.localeCompare(b.code));
      })
    );
  }

  /**
   * Lấy tài khoản theo mã
   */
  getAccountByCode(code: string): Observable<Account | null> {
    return this.accounts$.pipe(
      delay(100),
      map(accounts => accounts.find(a => a.code === code) || null)
    );
  }

  /**
   * Lấy các TK con
   */
  getChildAccounts(parentCode: string): Observable<Account[]> {
    return this.accounts$.pipe(
      delay(100),
      map(accounts => accounts.filter(a =>
        a.code.startsWith(parentCode) &&
        a.code.length === parentCode.length + 1
      ).sort((a, b) => a.code.localeCompare(b.code)))
    );
  }

  /**
   * Lấy tài khoản theo nhóm
   */
  getAccountGroups(): Observable<AccountGroup[]> {
    return this.accounts$.pipe(
      delay(200),
      map(accounts => {
        const groups: AccountGroup[] = [
          { code: '1', name: 'Loại 1 - Tài sản ngắn hạn', type: 'ASSET_SHORT', accounts: [], total: 0 },
          { code: '2', name: 'Loại 2 - Tài sản dài hạn', type: 'ASSET_LONG', accounts: [], total: 0 },
          { code: '3', name: 'Loại 3 - Nợ phải trả', type: 'LIABILITY', accounts: [], total: 0 },
          { code: '4', name: 'Loại 4 - Vốn chủ sở hữu', type: 'EQUITY', accounts: [], total: 0 },
          { code: '5', name: 'Loại 5 - Doanh thu', type: 'REVENUE', accounts: [], total: 0 },
          { code: '6', name: 'Loại 6 - Chi phí SXKD', type: 'EXPENSE_PROD', accounts: [], total: 0 },
          { code: '7', name: 'Loại 7 - Thu nhập khác', type: 'INCOME_OTHER', accounts: [], total: 0 },
          { code: '8', name: 'Loại 8 - Chi phí khác', type: 'EXPENSE_OTHER', accounts: [], total: 0 },
        ];

        accounts.forEach(account => {
          const groupCode = account.code[0];
          const group = groups.find(g => g.code === groupCode);
          if (group) {
            group.accounts.push(account);
            group.total++;
          }
        });

        return groups;
      })
    );
  }

  /**
   * Lấy TK lá (không có TK con) - dùng để hạch toán
   */
  getLeafAccounts(): Observable<Account[]> {
    return this.accounts$.pipe(
      delay(100),
      map(accounts => accounts.filter(a => !a.isParent && a.status === 'ACTIVE'))
    );
  }

  /**
   * Thêm tài khoản mới
   */
  addAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Observable<Account> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const newAccount: Account = {
          ...account,
          id: this.generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const currentAccounts = this.accounts$.value;

        // Update parent's isParent flag
        if (newAccount.parentCode) {
          const parentIndex = currentAccounts.findIndex(a => a.code === newAccount.parentCode);
          if (parentIndex >= 0) {
            currentAccounts[parentIndex] = {
              ...currentAccounts[parentIndex],
              isParent: true
            };
          }
        }

        this.accounts$.next([...currentAccounts, newAccount]);
        return newAccount;
      })
    );
  }

  /**
   * Cập nhật tài khoản
   */
  updateAccount(code: string, updates: Partial<Account>): Observable<Account> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const currentAccounts = this.accounts$.value;
        const index = currentAccounts.findIndex(a => a.code === code);

        if (index < 0) {
          throw new Error(`Không tìm thấy tài khoản ${code}`);
        }

        const account = currentAccounts[index];
        if (account.isSystemAccount) {
          throw new Error('Không thể sửa tài khoản hệ thống');
        }

        const updatedAccount: Account = {
          ...account,
          ...updates,
          code: account.code, // Không cho đổi mã
          updatedAt: new Date()
        };

        currentAccounts[index] = updatedAccount;
        this.accounts$.next([...currentAccounts]);

        return updatedAccount;
      })
    );
  }

  /**
   * Xóa tài khoản (soft delete - đổi status)
   */
  deleteAccount(code: string): Observable<void> {
    return of(null).pipe(
      delay(300),
      map(() => {
        const currentAccounts = this.accounts$.value;
        const account = currentAccounts.find(a => a.code === code);

        if (!account) {
          throw new Error(`Không tìm thấy tài khoản ${code}`);
        }

        if (account.isSystemAccount) {
          throw new Error('Không thể xóa tài khoản hệ thống');
        }

        if (account.isParent) {
          throw new Error('Không thể xóa tài khoản có TK con. Vui lòng xóa TK con trước.');
        }

        // Check if account has transactions
        // In real app, would check from database
        // For demo, just mark as inactive

        const index = currentAccounts.findIndex(a => a.code === code);
        currentAccounts[index] = {
          ...account,
          status: 'INACTIVE',
          updatedAt: new Date()
        };

        this.accounts$.next([...currentAccounts]);
      })
    );
  }

  /**
   * Kiểm tra mã TK đã tồn tại chưa
   */
  isCodeExists(code: string): Observable<boolean> {
    return this.accounts$.pipe(
      map(accounts => accounts.some(a => a.code === code))
    );
  }

  /**
   * Xuất danh mục TK ra Excel
   */
  exportExcel(): Observable<Blob> {
    return of(new Blob(['Demo Excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      .pipe(delay(500));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  private initializeAccounts(): void {
    const accounts: Account[] = ALL_ACCOUNTS_TEMPLATE.map(template => ({
      id: this.generateId(),
      code: template.code,
      name: template.name,
      nameEn: template.nameEn,
      parentCode: getParentCode(template.code),
      type: template.type,
      nature: template.nature,
      level: getAccountLevel(template.code),
      isParent: this.hasChildren(template.code),
      isDetailRequired: template.isDetailRequired || false,
      detailType: template.detailType,
      description: template.description,
      status: 'ACTIVE' as AccountStatus,
      isSystemAccount: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    this.accounts$.next(accounts);
  }

  private hasChildren(code: string): boolean {
    return ALL_ACCOUNTS_TEMPLATE.some(t =>
      t.code.startsWith(code) && t.code.length === code.length + 1
    );
  }

  private generateId(): string {
    return 'acc_' + Math.random().toString(36).substr(2, 9);
  }
}
