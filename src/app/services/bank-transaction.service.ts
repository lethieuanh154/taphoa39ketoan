import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BankTransaction,
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionFilter,
  generateTransactionNo,
  DEFAULT_ENTRIES
} from '../models/bank-transaction.models';
import { BankService } from './bank.service';

@Injectable({
  providedIn: 'root'
})
export class BankTransactionService {
  private transactionsSubject = new BehaviorSubject<BankTransaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  constructor(private bankService: BankService) {
    this.loadDemoData();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════════════════════════

  getTransactions(): Observable<BankTransaction[]> {
    return this.transactions$;
  }

  getTransactionById(id: string): Observable<BankTransaction | undefined> {
    return this.transactions$.pipe(
      map(transactions => transactions.find(t => t.id === id))
    );
  }

  getTransactionsByFilter(filter: BankTransactionFilter): Observable<BankTransaction[]> {
    return this.transactions$.pipe(
      map(transactions => {
        let result = [...transactions];

        if (filter.bankAccountId) {
          result = result.filter(t => t.bankAccountId === filter.bankAccountId);
        }

        if (filter.transactionType) {
          result = result.filter(t => t.transactionType === filter.transactionType);
        }

        if (filter.status) {
          result = result.filter(t => t.status === filter.status);
        }

        if (filter.fromDate) {
          result = result.filter(t => new Date(t.transactionDate) >= filter.fromDate!);
        }

        if (filter.toDate) {
          result = result.filter(t => new Date(t.transactionDate) <= filter.toDate!);
        }

        if (filter.search) {
          const search = filter.search.toLowerCase();
          result = result.filter(t =>
            t.transactionNo.toLowerCase().includes(search) ||
            t.description.toLowerCase().includes(search) ||
            t.counterpartyName?.toLowerCase().includes(search) ||
            t.referenceNo?.toLowerCase().includes(search)
          );
        }

        return result.sort((a, b) =>
          new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
        );
      })
    );
  }

  createTransaction(data: Partial<BankTransaction>): BankTransaction {
    const transactions = this.transactionsSubject.value;
    const date = data.transactionDate ? new Date(data.transactionDate) : new Date();

    // Get default entries
    const defaultEntry = DEFAULT_ENTRIES[data.transactionType || 'OTHER'];

    const newTransaction: BankTransaction = {
      id: `bt_${Date.now()}`,
      transactionNo: data.transactionNo || generateTransactionNo(data.transactionType || 'OTHER', date),
      transactionDate: date,

      bankAccountId: data.bankAccountId || '',
      bankAccountNo: data.bankAccountNo || '',
      bankName: data.bankName || '',

      transactionType: data.transactionType || 'OTHER',
      isCredit: data.isCredit ?? true,

      amount: data.amount || 0,
      currency: data.currency || 'VND',
      exchangeRate: data.exchangeRate,
      amountInVND: data.amountInVND || data.amount,

      counterpartyType: data.counterpartyType,
      counterpartyId: data.counterpartyId,
      counterpartyName: data.counterpartyName,
      counterpartyBank: data.counterpartyBank,
      counterpartyAccountNo: data.counterpartyAccountNo,

      description: data.description || '',
      referenceNo: data.referenceNo,

      debitAccount: data.debitAccount || defaultEntry.debit,
      creditAccount: data.creditAccount || defaultEntry.credit,

      relatedVoucherId: data.relatedVoucherId,
      relatedVoucherNo: data.relatedVoucherNo,
      relatedVoucherType: data.relatedVoucherType,

      status: 'DRAFT',

      createdAt: new Date(),
      createdBy: 'admin'
    };

    this.transactionsSubject.next([...transactions, newTransaction]);
    return newTransaction;
  }

  updateTransaction(id: string, data: Partial<BankTransaction>): boolean {
    const transactions = this.transactionsSubject.value;
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) return false;

    const current = transactions[index];
    if (current.status !== 'DRAFT') return false;

    transactions[index] = { ...current, ...data };
    this.transactionsSubject.next([...transactions]);
    return true;
  }

  deleteTransaction(id: string): boolean {
    const transactions = this.transactionsSubject.value;
    const transaction = transactions.find(t => t.id === id);

    if (!transaction || transaction.status !== 'DRAFT') return false;

    this.transactionsSubject.next(transactions.filter(t => t.id !== id));
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  postTransaction(id: string): boolean {
    const transactions = this.transactionsSubject.value;
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) return false;

    const transaction = transactions[index];
    if (transaction.status !== 'DRAFT') return false;

    transactions[index] = {
      ...transaction,
      status: 'POSTED',
      postedAt: new Date(),
      postedBy: 'admin'
    };

    // Update bank account balance
    this.updateBankBalance(transaction.bankAccountId, transaction.amount, transaction.isCredit);

    this.transactionsSubject.next([...transactions]);
    return true;
  }

  cancelTransaction(id: string, reason: string): boolean {
    const transactions = this.transactionsSubject.value;
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) return false;

    const transaction = transactions[index];
    if (transaction.status !== 'POSTED') return false;

    transactions[index] = {
      ...transaction,
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'admin',
      cancelReason: reason
    };

    // Reverse bank account balance
    this.updateBankBalance(transaction.bankAccountId, transaction.amount, !transaction.isCredit);

    this.transactionsSubject.next([...transactions]);
    return true;
  }

  private updateBankBalance(accountId: string, amount: number, isCredit: boolean): void {
    // This would update the bank account balance in a real system
    // For demo, we'll skip this
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  getStatsByAccount(accountId: string, fromDate: Date, toDate: Date): Observable<{
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    transactionCount: number;
  }> {
    return this.transactions$.pipe(
      map(transactions => {
        const posted = transactions.filter(t => t.status === 'POSTED' && t.bankAccountId === accountId);

        // Calculate opening balance (transactions before fromDate)
        const beforePeriod = posted.filter(t => new Date(t.transactionDate) < fromDate);
        let openingBalance = 50000000; // Demo initial balance

        beforePeriod.forEach(t => {
          if (t.isCredit) {
            openingBalance += t.amount;
          } else {
            openingBalance -= t.amount;
          }
        });

        // Calculate period transactions
        const inPeriod = posted.filter(t => {
          const date = new Date(t.transactionDate);
          return date >= fromDate && date <= toDate;
        });

        const totalDebit = inPeriod.filter(t => t.isCredit).reduce((sum, t) => sum + t.amount, 0);
        const totalCredit = inPeriod.filter(t => !t.isCredit).reduce((sum, t) => sum + t.amount, 0);

        return {
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance: openingBalance + totalDebit - totalCredit,
          transactionCount: inPeriod.length
        };
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEMO DATA
  // ═══════════════════════════════════════════════════════════════════════════════

  private loadDemoData(): void {
    const now = new Date();
    const transactions: BankTransaction[] = [
      // Thu tiền từ khách hàng
      {
        id: 'bt_001',
        transactionNo: 'BN-202501-001',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'COLLECTION',
        isCredit: true,
        amount: 55000000,
        currency: 'VND',
        counterpartyType: 'CUSTOMER',
        counterpartyName: 'Công ty TNHH ABC',
        counterpartyBank: 'BIDV',
        counterpartyAccountNo: '21510001234567',
        description: 'Thu tiền hàng theo HĐ #001',
        referenceNo: 'FT25005123456',
        debitAccount: '1121',
        creditAccount: '131',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 5),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 5),
        postedBy: 'admin'
      },
      // Thanh toán cho NCC
      {
        id: 'bt_002',
        transactionNo: 'BC-202501-001',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 8),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'PAYMENT',
        isCredit: false,
        amount: 35000000,
        currency: 'VND',
        counterpartyType: 'SUPPLIER',
        counterpartyName: 'Công ty TNHH XYZ',
        counterpartyBank: 'Techcombank',
        counterpartyAccountNo: '19034567890123',
        description: 'Thanh toán tiền hàng nhập kho',
        referenceNo: 'FT25008654321',
        debitAccount: '331',
        creditAccount: '1121',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 8),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 8),
        postedBy: 'admin'
      },
      // Chi lương qua NH
      {
        id: 'bt_003',
        transactionNo: 'BC-202501-002',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 10),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'SALARY',
        isCredit: false,
        amount: 85000000,
        currency: 'VND',
        counterpartyType: 'EMPLOYEE',
        counterpartyName: 'Lương T1/2025 - 10 nhân viên',
        description: 'Chi lương tháng 01/2025',
        referenceNo: 'SALARY-202501',
        debitAccount: '334',
        creditAccount: '1121',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 10),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 10),
        postedBy: 'admin'
      },
      // Lãi tiền gửi
      {
        id: 'bt_004',
        transactionNo: 'BN-202501-002',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 15),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'INTEREST',
        isCredit: true,
        amount: 250000,
        currency: 'VND',
        counterpartyType: 'BANK',
        counterpartyName: 'Vietcombank',
        description: 'Lãi tiền gửi không kỳ hạn T1/2025',
        referenceNo: 'INT-202501',
        debitAccount: '1121',
        creditAccount: '515',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 15),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 15),
        postedBy: 'admin'
      },
      // Phí ngân hàng
      {
        id: 'bt_005',
        transactionNo: 'BC-202501-003',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 15),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'BANK_FEE',
        isCredit: false,
        amount: 55000,
        currency: 'VND',
        counterpartyType: 'BANK',
        counterpartyName: 'Vietcombank',
        description: 'Phí dịch vụ SMS + IB T1/2025',
        referenceNo: 'FEE-202501',
        debitAccount: '6425',
        creditAccount: '1121',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 15),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 15),
        postedBy: 'admin'
      },
      // Nộp tiền mặt
      {
        id: 'bt_006',
        transactionNo: 'BN-202501-003',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 18),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'DEPOSIT',
        isCredit: true,
        amount: 30000000,
        currency: 'VND',
        counterpartyType: 'OTHER',
        counterpartyName: 'TapHoa39',
        description: 'Nộp tiền mặt vào TK',
        referenceNo: 'DEP-202501-001',
        debitAccount: '1121',
        creditAccount: '1111',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 18),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 18),
        postedBy: 'admin'
      },
      // Nộp thuế GTGT
      {
        id: 'bt_007',
        transactionNo: 'BC-202501-004',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 20),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'TAX_PAYMENT',
        isCredit: false,
        amount: 5500000,
        currency: 'VND',
        counterpartyType: 'TAX',
        counterpartyName: 'Kho bạc NN - Thuế GTGT',
        description: 'Nộp thuế GTGT T12/2024',
        referenceNo: 'TAX-GTGT-202412',
        debitAccount: '3331',
        creditAccount: '1121',
        status: 'POSTED',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 20),
        createdBy: 'admin',
        postedAt: new Date(now.getFullYear(), now.getMonth(), 20),
        postedBy: 'admin'
      },
      // Giao dịch nháp
      {
        id: 'bt_008',
        transactionNo: 'BC-202501-005',
        transactionDate: new Date(now.getFullYear(), now.getMonth(), 22),
        bankAccountId: 'acc_001',
        bankAccountNo: '0071001234567',
        bankName: 'Vietcombank',
        transactionType: 'PAYMENT',
        isCredit: false,
        amount: 15000000,
        currency: 'VND',
        counterpartyType: 'SUPPLIER',
        counterpartyName: 'Công ty Phần mềm ABC',
        counterpartyBank: 'VPBank',
        counterpartyAccountNo: '123456789012',
        description: 'Thanh toán phí phần mềm kế toán',
        debitAccount: '6427',
        creditAccount: '1121',
        status: 'DRAFT',
        createdAt: new Date(now.getFullYear(), now.getMonth(), 22),
        createdBy: 'admin'
      }
    ];

    this.transactionsSubject.next(transactions);
  }
}
