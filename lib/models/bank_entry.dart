class BankEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String description;
  final double deposit;
  final double withdrawal;
  final double balance;

  BankEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.description,
    required this.deposit,
    required this.withdrawal,
    required this.balance,
  });

  static List<BankEntry> getMockData() {
    double runningBalance = 150000000;

    return [
      BankEntry(
        recordDate: '01/01/2025',
        voucherNumber: 'BT001',
        voucherDate: '01/01/2025',
        description: 'Chuyển khoản từ khách hàng A',
        deposit: 35000000,
        withdrawal: 0,
        balance: runningBalance += 35000000,
      ),
      BankEntry(
        recordDate: '03/01/2025',
        voucherNumber: 'BC001',
        voucherDate: '03/01/2025',
        description: 'Thanh toán cho nhà cung cấp',
        deposit: 0,
        withdrawal: 25000000,
        balance: runningBalance -= 25000000,
      ),
      BankEntry(
        recordDate: '05/01/2025',
        voucherNumber: 'BT002',
        voucherDate: '05/01/2025',
        description: 'Thu tiền xuất khẩu',
        deposit: 80000000,
        withdrawal: 0,
        balance: runningBalance += 80000000,
      ),
      BankEntry(
        recordDate: '08/01/2025',
        voucherNumber: 'BC002',
        voucherDate: '08/01/2025',
        description: 'Chuyển lương nhân viên',
        deposit: 0,
        withdrawal: 60000000,
        balance: runningBalance -= 60000000,
      ),
      BankEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'BT003',
        voucherDate: '10/01/2025',
        description: 'Thu công nợ khách hàng B',
        deposit: 45000000,
        withdrawal: 0,
        balance: runningBalance += 45000000,
      ),
      BankEntry(
        recordDate: '12/01/2025',
        voucherNumber: 'BC003',
        voucherDate: '12/01/2025',
        description: 'Thanh toán tiền điện nước',
        deposit: 0,
        withdrawal: 8000000,
        balance: runningBalance -= 8000000,
      ),
      BankEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'BT004',
        voucherDate: '15/01/2025',
        description: 'Lãi tiền gửi ngân hàng',
        deposit: 2500000,
        withdrawal: 0,
        balance: runningBalance += 2500000,
      ),
      BankEntry(
        recordDate: '18/01/2025',
        voucherNumber: 'BC004',
        voucherDate: '18/01/2025',
        description: 'Nộp thuế qua ngân hàng',
        deposit: 0,
        withdrawal: 15000000,
        balance: runningBalance -= 15000000,
      ),
      BankEntry(
        recordDate: '20/01/2025',
        voucherNumber: 'BT005',
        voucherDate: '20/01/2025',
        description: 'Thu tiền bán hàng online',
        deposit: 28000000,
        withdrawal: 0,
        balance: runningBalance += 28000000,
      ),
    ];
  }
}
