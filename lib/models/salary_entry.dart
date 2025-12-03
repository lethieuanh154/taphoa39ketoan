class SalaryEntry {
  final String recordDate;
  final String employeeName;
  final String employeeId;
  final String department;
  final double basicSalary;
  final double allowance;
  final double bonus;
  final double totalIncome;
  final double insurance;
  final double personalIncomeTax;
  final double otherDeduction;
  final double totalDeduction;
  final double netSalary;

  SalaryEntry({
    required this.recordDate,
    required this.employeeName,
    required this.employeeId,
    required this.department,
    required this.basicSalary,
    required this.allowance,
    required this.bonus,
    required this.totalIncome,
    required this.insurance,
    required this.personalIncomeTax,
    required this.otherDeduction,
    required this.totalDeduction,
    required this.netSalary,
  });

  static List<SalaryEntry> getMockData() {
    return [
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Nguyễn Văn A',
        employeeId: 'NV001',
        department: 'Kinh doanh',
        basicSalary: 15000000,
        allowance: 3000000,
        bonus: 2000000,
        totalIncome: 20000000,
        insurance: 1800000,
        personalIncomeTax: 1500000,
        otherDeduction: 200000,
        totalDeduction: 3500000,
        netSalary: 16500000,
      ),
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Trần Thị B',
        employeeId: 'NV002',
        department: 'Kế toán',
        basicSalary: 12000000,
        allowance: 2000000,
        bonus: 1500000,
        totalIncome: 15500000,
        insurance: 1400000,
        personalIncomeTax: 1000000,
        otherDeduction: 150000,
        totalDeduction: 2550000,
        netSalary: 12950000,
      ),
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Lê Văn C',
        employeeId: 'NV003',
        department: 'Sản xuất',
        basicSalary: 10000000,
        allowance: 1500000,
        bonus: 1000000,
        totalIncome: 12500000,
        insurance: 1100000,
        personalIncomeTax: 700000,
        otherDeduction: 100000,
        totalDeduction: 1900000,
        netSalary: 10600000,
      ),
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Phạm Thị D',
        employeeId: 'NV004',
        department: 'Nhân sự',
        basicSalary: 13000000,
        allowance: 2500000,
        bonus: 1800000,
        totalIncome: 17300000,
        insurance: 1500000,
        personalIncomeTax: 1200000,
        otherDeduction: 180000,
        totalDeduction: 2880000,
        netSalary: 14420000,
      ),
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Hoàng Văn E',
        employeeId: 'NV005',
        department: 'IT',
        basicSalary: 18000000,
        allowance: 3500000,
        bonus: 3000000,
        totalIncome: 24500000,
        insurance: 2200000,
        personalIncomeTax: 2500000,
        otherDeduction: 300000,
        totalDeduction: 5000000,
        netSalary: 19500000,
      ),
      SalaryEntry(
        recordDate: '31/01/2025',
        employeeName: 'Đỗ Thị F',
        employeeId: 'NV006',
        department: 'Marketing',
        basicSalary: 14000000,
        allowance: 2800000,
        bonus: 2200000,
        totalIncome: 19000000,
        insurance: 1700000,
        personalIncomeTax: 1400000,
        otherDeduction: 220000,
        totalDeduction: 3320000,
        netSalary: 15680000,
      ),
    ];
  }
}
