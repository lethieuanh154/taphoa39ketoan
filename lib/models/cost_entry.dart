class CostEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String description;
  final double materialCost;
  final double laborCost;
  final double depreciation;
  final double utilityCost;
  final double marketingCost;
  final double adminCost;
  final double otherCost;
  final double totalCost;

  CostEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.description,
    required this.materialCost,
    required this.laborCost,
    required this.depreciation,
    required this.utilityCost,
    required this.marketingCost,
    required this.adminCost,
    required this.otherCost,
    required this.totalCost,
  });

  static List<CostEntry> getMockData() {
    return [
      CostEntry(
        recordDate: '01/01/2025',
        voucherNumber: 'CP001',
        voucherDate: '01/01/2025',
        description: 'Chi phí nguyên vật liệu tháng 1',
        materialCost: 15000000,
        laborCost: 8000000,
        depreciation: 2000000,
        utilityCost: 1500000,
        marketingCost: 3000000,
        adminCost: 2500000,
        otherCost: 500000,
        totalCost: 32500000,
      ),
      CostEntry(
        recordDate: '05/01/2025',
        voucherNumber: 'CP002',
        voucherDate: '05/01/2025',
        description: 'Chi phí nhân công sản xuất',
        materialCost: 5000000,
        laborCost: 12000000,
        depreciation: 1500000,
        utilityCost: 2000000,
        marketingCost: 0,
        adminCost: 1000000,
        otherCost: 300000,
        totalCost: 21800000,
      ),
      CostEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'CP003',
        voucherDate: '10/01/2025',
        description: 'Chi phí quảng cáo và marketing',
        materialCost: 0,
        laborCost: 2000000,
        depreciation: 0,
        utilityCost: 500000,
        marketingCost: 15000000,
        adminCost: 1000000,
        otherCost: 800000,
        totalCost: 19300000,
      ),
      CostEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'CP004',
        voucherDate: '15/01/2025',
        description: 'Chi phí điện nước và văn phòng',
        materialCost: 0,
        laborCost: 0,
        depreciation: 3000000,
        utilityCost: 5000000,
        marketingCost: 0,
        adminCost: 4000000,
        otherCost: 1200000,
        totalCost: 13200000,
      ),
      CostEntry(
        recordDate: '20/01/2025',
        voucherNumber: 'CP005',
        voucherDate: '20/01/2025',
        description: 'Chi phí sản xuất đơn hàng ABC',
        materialCost: 20000000,
        laborCost: 10000000,
        depreciation: 2500000,
        utilityCost: 1800000,
        marketingCost: 1000000,
        adminCost: 1500000,
        otherCost: 400000,
        totalCost: 37200000,
      ),
      CostEntry(
        recordDate: '25/01/2025',
        voucherNumber: 'CP006',
        voucherDate: '25/01/2025',
        description: 'Chi phí vận chuyển và logistics',
        materialCost: 3000000,
        laborCost: 4000000,
        depreciation: 500000,
        utilityCost: 800000,
        marketingCost: 0,
        adminCost: 500000,
        otherCost: 2000000,
        totalCost: 10800000,
      ),
    ];
  }
}
