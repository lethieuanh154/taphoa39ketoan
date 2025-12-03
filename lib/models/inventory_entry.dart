class InventoryEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String description;
  final double openingBalance;
  final double import;
  final double export;
  final double closingBalance;
  final double unitPrice;
  final double totalValue;

  InventoryEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.description,
    required this.openingBalance,
    required this.import,
    required this.export,
    required this.closingBalance,
    required this.unitPrice,
    required this.totalValue,
  });

  static List<InventoryEntry> getMockData() {
    return [
      InventoryEntry(
        recordDate: '01/01/2025',
        voucherNumber: 'NK001',
        voucherDate: '01/01/2025',
        description: 'Nhập vật liệu A từ NCC X',
        openingBalance: 500,
        import: 200,
        export: 0,
        closingBalance: 700,
        unitPrice: 50000,
        totalValue: 35000000,
      ),
      InventoryEntry(
        recordDate: '03/01/2025',
        voucherNumber: 'XK001',
        voucherDate: '03/01/2025',
        description: 'Xuất vật liệu A cho sản xuất',
        openingBalance: 700,
        import: 0,
        export: 150,
        closingBalance: 550,
        unitPrice: 50000,
        totalValue: 27500000,
      ),
      InventoryEntry(
        recordDate: '05/01/2025',
        voucherNumber: 'NK002',
        voucherDate: '05/01/2025',
        description: 'Nhập hàng hóa B',
        openingBalance: 300,
        import: 500,
        export: 0,
        closingBalance: 800,
        unitPrice: 120000,
        totalValue: 96000000,
      ),
      InventoryEntry(
        recordDate: '07/01/2025',
        voucherNumber: 'XK002',
        voucherDate: '07/01/2025',
        description: 'Xuất bán hàng hóa B',
        openingBalance: 800,
        import: 0,
        export: 250,
        closingBalance: 550,
        unitPrice: 120000,
        totalValue: 66000000,
      ),
      InventoryEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'NK003',
        voucherDate: '10/01/2025',
        description: 'Nhập dụng cụ C',
        openingBalance: 100,
        import: 300,
        export: 0,
        closingBalance: 400,
        unitPrice: 80000,
        totalValue: 32000000,
      ),
      InventoryEntry(
        recordDate: '12/01/2025',
        voucherNumber: 'XK003',
        voucherDate: '12/01/2025',
        description: 'Xuất dụng cụ C',
        openingBalance: 400,
        import: 0,
        export: 120,
        closingBalance: 280,
        unitPrice: 80000,
        totalValue: 22400000,
      ),
      InventoryEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'NK004',
        voucherDate: '15/01/2025',
        description: 'Nhập nguyên liệu D',
        openingBalance: 1000,
        import: 800,
        export: 0,
        closingBalance: 1800,
        unitPrice: 35000,
        totalValue: 63000000,
      ),
    ];
  }
}
