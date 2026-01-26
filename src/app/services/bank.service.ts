import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Bank, BankAccount, BankAccountFilter, BankAccountType, Currency,
  VIETNAM_BANKS, validateBankAccount
} from '../models/bank.models';

@Injectable({
  providedIn: 'root'
})
export class BankService {
  private banks$ = new BehaviorSubject<Bank[]>(VIETNAM_BANKS);
  private bankAccounts$ = new BehaviorSubject<BankAccount[]>([]);

  constructor() {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BANK OPERATIONS (Read-only - danh sách ngân hàng cố định)
  // ═══════════════════════════════════════════════════════════════════════════════

  getBanks(): Observable<Bank[]> {
    return this.banks$.pipe(
      map(list => list.filter(b => b.isActive))
    );
  }

  getBankById(id: string): Observable<Bank | undefined> {
    return this.banks$.pipe(
      map(list => list.find(b => b.id === id))
    );
  }

  getBankByCode(code: string): Observable<Bank | undefined> {
    return this.banks$.pipe(
      map(list => list.find(b => b.code === code))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BANK ACCOUNT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  getBankAccounts(): Observable<BankAccount[]> {
    return this.bankAccounts$.asObservable();
  }

  getActiveBankAccounts(): Observable<BankAccount[]> {
    return this.bankAccounts$.pipe(
      map(list => list.filter(a => a.status === 'ACTIVE'))
    );
  }

  getBankAccountById(id: string): Observable<BankAccount | undefined> {
    return this.bankAccounts$.pipe(
      map(list => list.find(a => a.id === id))
    );
  }

  getDefaultBankAccount(): Observable<BankAccount | undefined> {
    return this.bankAccounts$.pipe(
      map(list => list.find(a => a.isDefault && a.status === 'ACTIVE'))
    );
  }

  filterBankAccounts(filter: BankAccountFilter): Observable<BankAccount[]> {
    return this.bankAccounts$.pipe(
      map(list => {
        let result = [...list];

        if (filter.search) {
          const search = filter.search.toLowerCase();
          result = result.filter(a =>
            a.accountNo.includes(search) ||
            a.accountName.toLowerCase().includes(search) ||
            a.bankName.toLowerCase().includes(search)
          );
        }

        if (filter.bankId) {
          result = result.filter(a => a.bankId === filter.bankId);
        }

        if (filter.accountType) {
          result = result.filter(a => a.accountType === filter.accountType);
        }

        if (filter.currency) {
          result = result.filter(a => a.currency === filter.currency);
        }

        if (filter.status) {
          result = result.filter(a => a.status === filter.status);
        }

        return result;
      })
    );
  }

  createBankAccount(data: Partial<BankAccount>): Observable<BankAccount> {
    const accounts = this.bankAccounts$.getValue();

    // Get bank info
    const bank = VIETNAM_BANKS.find(b => b.id === data.bankId);

    const newAccount: BankAccount = {
      id: this.generateId(),
      bankId: data.bankId || '',
      bankCode: bank?.code || data.bankCode || '',
      bankName: bank?.shortName || data.bankName || '',

      accountNo: data.accountNo || '',
      accountName: data.accountName || '',
      accountType: data.accountType || 'CHECKING',
      currency: data.currency || 'VND',

      branch: data.branch,
      branchAddress: data.branchAddress,

      openingBalance: data.openingBalance || 0,
      currentBalance: data.currentBalance || data.openingBalance || 0,

      glAccount: data.glAccount || '1121',

      contactPerson: data.contactPerson,
      contactPhone: data.contactPhone,

      ibUsername: data.ibUsername,
      ibStatus: data.ibStatus,

      status: data.status || 'ACTIVE',
      isDefault: data.isDefault || false,

      notes: data.notes,

      createdAt: new Date(),
      createdBy: 'system',
      updatedAt: new Date()
    };

    // If this is set as default, unset other defaults
    if (newAccount.isDefault) {
      accounts.forEach(a => a.isDefault = false);
    }

    accounts.push(newAccount);
    this.bankAccounts$.next(accounts);
    return of(newAccount);
  }

  updateBankAccount(id: string, data: Partial<BankAccount>): Observable<BankAccount | undefined> {
    const accounts = this.bankAccounts$.getValue();
    const index = accounts.findIndex(a => a.id === id);

    if (index === -1) return of(undefined);

    // Get bank info if bankId changed
    if (data.bankId) {
      const bank = VIETNAM_BANKS.find(b => b.id === data.bankId);
      if (bank) {
        data.bankCode = bank.code;
        data.bankName = bank.shortName;
      }
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      accounts.forEach(a => a.isDefault = false);
    }

    accounts[index] = {
      ...accounts[index],
      ...data,
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    this.bankAccounts$.next(accounts);
    return of(accounts[index]);
  }

  deleteBankAccount(id: string): Observable<boolean> {
    const accounts = this.bankAccounts$.getValue();
    const index = accounts.findIndex(a => a.id === id);

    if (index === -1) return of(false);

    accounts.splice(index, 1);
    this.bankAccounts$.next(accounts);
    return of(true);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getStatistics(): Observable<{
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: number;
    byBank: { bankName: string; count: number; balance: number }[];
  }> {
    return this.bankAccounts$.pipe(
      map(list => {
        const active = list.filter(a => a.status === 'ACTIVE');
        const totalBalance = active.reduce((sum, a) => sum + a.currentBalance, 0);

        // Group by bank
        const bankMap = new Map<string, { count: number; balance: number }>();
        active.forEach(a => {
          const existing = bankMap.get(a.bankName) || { count: 0, balance: 0 };
          bankMap.set(a.bankName, {
            count: existing.count + 1,
            balance: existing.balance + a.currentBalance
          });
        });

        const byBank = Array.from(bankMap.entries()).map(([bankName, data]) => ({
          bankName,
          ...data
        }));

        return {
          totalAccounts: list.length,
          activeAccounts: active.length,
          totalBalance,
          byBank
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generateId(): string {
    return 'ba_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  checkAccountExists(accountNo: string, bankId: string, excludeId?: string): Observable<boolean> {
    return this.bankAccounts$.pipe(
      map(list => list.some(a =>
        a.accountNo === accountNo &&
        a.bankId === bankId &&
        a.id !== excludeId
      ))
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const demoAccounts: BankAccount[] = [
      {
        id: 'ba_001',
        bankId: 'bank_vcb',
        bankCode: 'VCB',
        bankName: 'Vietcombank',
        accountNo: '0011234567890',
        accountName: 'CONG TY TNHH TAP HOA 39',
        accountType: 'CHECKING',
        currency: 'VND',
        branch: 'Chi nhánh Hà Nội',
        branchAddress: '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội',
        openingBalance: 500000000,
        currentBalance: 850000000,
        glAccount: '1121',
        contactPerson: 'Nguyễn Văn A',
        contactPhone: '024-39345678',
        ibUsername: 'taphoa39_vcb',
        ibStatus: 'ACTIVE',
        status: 'ACTIVE',
        isDefault: true,
        createdAt: new Date(2020, 0, 1),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ba_002',
        bankId: 'bank_tcb',
        bankCode: 'TCB',
        bankName: 'Techcombank',
        accountNo: '19012345678901',
        accountName: 'CONG TY TNHH TAP HOA 39',
        accountType: 'CHECKING',
        currency: 'VND',
        branch: 'Chi nhánh Đống Đa',
        openingBalance: 200000000,
        currentBalance: 320000000,
        glAccount: '1121',
        ibUsername: 'taphoa39_tcb',
        ibStatus: 'ACTIVE',
        status: 'ACTIVE',
        isDefault: false,
        createdAt: new Date(2021, 5, 15),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ba_003',
        bankId: 'bank_bidv',
        bankCode: 'BIDV',
        bankName: 'BIDV',
        accountNo: '31234567890123',
        accountName: 'CONG TY TNHH TAP HOA 39',
        accountType: 'SAVINGS',
        currency: 'VND',
        branch: 'Chi nhánh Cầu Giấy',
        openingBalance: 1000000000,
        currentBalance: 1050000000,
        glAccount: '1121',
        status: 'ACTIVE',
        isDefault: false,
        notes: 'Tài khoản tiết kiệm có kỳ hạn 6 tháng',
        createdAt: new Date(2022, 0, 1),
        createdBy: 'system',
        updatedAt: new Date()
      },
      {
        id: 'ba_004',
        bankId: 'bank_vcb',
        bankCode: 'VCB',
        bankName: 'Vietcombank',
        accountNo: '0071234567890',
        accountName: 'CONG TY TNHH TAP HOA 39',
        accountType: 'CHECKING',
        currency: 'USD',
        branch: 'Chi nhánh Hà Nội',
        openingBalance: 50000,
        currentBalance: 45000,
        glAccount: '1122',
        status: 'ACTIVE',
        isDefault: false,
        notes: 'Tài khoản USD cho giao dịch quốc tế',
        createdAt: new Date(2023, 3, 1),
        createdBy: 'system',
        updatedAt: new Date()
      }
    ];

    this.bankAccounts$.next(demoAccounts);
  }
}
