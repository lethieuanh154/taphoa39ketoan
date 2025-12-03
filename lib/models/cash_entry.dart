class CashEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String description;
  final String accountDebit;
  final double cashIn;
  final double cashOut;
  final double balance;

  CashEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.description,
    required this.accountDebit,
    required this.cashIn,
    required this.cashOut,
    required this.balance,
  });

  static List<CashEntry> getMockData() {
    double runningBalance = 50000000;

    return [
      CashEntry(
        recordDate: '01/01/2025',
        voucherNumber: 'PT001',
        voucherDate: '01/01/2025',
        description: 'Thu tiền bán hàng',
        accountDebit: '511',
        cashIn: 15000000,
        cashOut: 0,
        balance: runningBalance += 15000000,
      ),
      CashEntry(
        recordDate: '02/01/2025',
        voucherNumber: 'PC001',
        voucherDate: '02/01/2025',
        description: 'Chi mua nguyên vật liệu',
        accountDebit: '152',
        cashIn: 0,
        cashOut: 8000000,
        balance: runningBalance -= 8000000,
      ),
      CashEntry(
        recordDate: '03/01/2025',
        voucherNumber: 'PT002',
        voucherDate: '03/01/2025',
        description: 'Thu công nợ khách hàng',
        accountDebit: '131',
        cashIn: 20000000,
        cashOut: 0,
        balance: runningBalance += 20000000,
      ),
      CashEntry(
        recordDate: '05/01/2025',
        voucherNumber: 'PC002',
        voucherDate: '05/01/2025',
        description: 'Chi trả lương nhân viên',
        accountDebit: '334',
        cashIn: 0,
        cashOut: 45000000,
        balance: runningBalance -= 45000000,
      ),
      CashEntry(
        recordDate: '07/01/2025',
        voucherNumber: 'PT003',
        voucherDate: '07/01/2025',
        description: 'Thu tiền bán hàng',
        accountDebit: '511',
        cashIn: 18000000,
        cashOut: 0,
        balance: runningBalance += 18000000,
      ),
      CashEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'PC003',
        voucherDate: '10/01/2025',
        description: 'Chi phí văn phòng',
        accountDebit: '642',
        cashIn: 0,
        cashOut: 3000000,
        balance: runningBalance -= 3000000,
      ),
      CashEntry(
        recordDate: '12/01/2025',
        voucherNumber: 'PT004',
        voucherDate: '12/01/2025',
        description: 'Thu tiền dịch vụ',
        accountDebit: '512',
        cashIn: 5000000,
        cashOut: 0,
        balance: runningBalance += 5000000,
      ),
      CashEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'PC004',
        voucherDate: '15/01/2025',
        description: 'Chi nộp thuế',
        accountDebit: '333',
        cashIn: 0,
        cashOut: 12000000,
        balance: runningBalance -= 12000000,
      ),
    ];
  }
}
