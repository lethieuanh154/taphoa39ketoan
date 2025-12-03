class TaxEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String taxType;
  final double taxAmount;

  TaxEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.taxType,
    required this.taxAmount,
  });

  static List<TaxEntry> getMockData() {
    return [
      TaxEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'T001',
        voucherDate: '10/01/2025',
        taxType: 'VAT đầu vào',
        taxAmount: 3850000,
      ),
      TaxEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'T002',
        voucherDate: '10/01/2025',
        taxType: 'VAT đầu ra',
        taxAmount: 5100000,
      ),
      TaxEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'T003',
        voucherDate: '15/01/2025',
        taxType: 'Thuế thu nhập doanh nghiệp',
        taxAmount: 8000000,
      ),
      TaxEntry(
        recordDate: '20/01/2025',
        voucherNumber: 'T004',
        voucherDate: '20/01/2025',
        taxType: 'VAT đầu vào',
        taxAmount: 2180000,
      ),
      TaxEntry(
        recordDate: '20/01/2025',
        voucherNumber: 'T005',
        voucherDate: '20/01/2025',
        taxType: 'VAT đầu ra',
        taxAmount: 3680000,
      ),
      TaxEntry(
        recordDate: '25/01/2025',
        voucherNumber: 'T006',
        voucherDate: '25/01/2025',
        taxType: 'Thuế môn bài',
        taxAmount: 3000000,
      ),
      TaxEntry(
        recordDate: '30/01/2025',
        voucherNumber: 'T007',
        voucherDate: '30/01/2025',
        taxType: 'Thuế tài nguyên',
        taxAmount: 1500000,
      ),
    ];
  }
}
