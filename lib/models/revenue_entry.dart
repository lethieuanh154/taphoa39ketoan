class RevenueEntry {
  final String recordDate;
  final String voucherNumber;
  final String voucherDate;
  final String description;
  final double distributionRevenue;
  final double wholesaleRevenue;
  final double retailRevenue;
  final double serviceRevenue;
  final double otherRevenue;
  final double totalRevenue;

  RevenueEntry({
    required this.recordDate,
    required this.voucherNumber,
    required this.voucherDate,
    required this.description,
    required this.distributionRevenue,
    required this.wholesaleRevenue,
    required this.retailRevenue,
    required this.serviceRevenue,
    required this.otherRevenue,
    required this.totalRevenue,
  });

  static List<RevenueEntry> getMockData() {
    return [
      RevenueEntry(
        recordDate: '01/01/2025',
        voucherNumber: 'HD001',
        voucherDate: '01/01/2025',
        description: 'Bán hàng cho khách hàng A',
        distributionRevenue: 15000000,
        wholesaleRevenue: 8000000,
        retailRevenue: 12000000,
        serviceRevenue: 3000000,
        otherRevenue: 500000,
        totalRevenue: 38500000,
      ),
      RevenueEntry(
        recordDate: '02/01/2025',
        voucherNumber: 'HD002',
        voucherDate: '02/01/2025',
        description: 'Bán hàng cho khách hàng B',
        distributionRevenue: 20000000,
        wholesaleRevenue: 10000000,
        retailRevenue: 15000000,
        serviceRevenue: 5000000,
        otherRevenue: 1000000,
        totalRevenue: 51000000,
      ),
      RevenueEntry(
        recordDate: '03/01/2025',
        voucherNumber: 'HD003',
        voucherDate: '03/01/2025',
        description: 'Bán hàng xuất khẩu',
        distributionRevenue: 30000000,
        wholesaleRevenue: 0,
        retailRevenue: 0,
        serviceRevenue: 2000000,
        otherRevenue: 0,
        totalRevenue: 32000000,
      ),
      RevenueEntry(
        recordDate: '05/01/2025',
        voucherNumber: 'HD004',
        voucherDate: '05/01/2025',
        description: 'Bán lẻ tại cửa hàng',
        distributionRevenue: 0,
        wholesaleRevenue: 5000000,
        retailRevenue: 25000000,
        serviceRevenue: 1500000,
        otherRevenue: 300000,
        totalRevenue: 31800000,
      ),
      RevenueEntry(
        recordDate: '10/01/2025',
        voucherNumber: 'HD005',
        voucherDate: '10/01/2025',
        description: 'Dịch vụ bảo hành và sửa chữa',
        distributionRevenue: 0,
        wholesaleRevenue: 0,
        retailRevenue: 3000000,
        serviceRevenue: 8000000,
        otherRevenue: 0,
        totalRevenue: 11000000,
      ),
      RevenueEntry(
        recordDate: '15/01/2025',
        voucherNumber: 'HD006',
        voucherDate: '15/01/2025',
        description: 'Bán hàng cho đại lý C',
        distributionRevenue: 45000000,
        wholesaleRevenue: 12000000,
        retailRevenue: 0,
        serviceRevenue: 0,
        otherRevenue: 2000000,
        totalRevenue: 59000000,
      ),
      RevenueEntry(
        recordDate: '20/01/2025',
        voucherNumber: 'HD007',
        voucherDate: '20/01/2025',
        description: 'Bán hàng online',
        distributionRevenue: 8000000,
        wholesaleRevenue: 6000000,
        retailRevenue: 18000000,
        serviceRevenue: 4000000,
        otherRevenue: 800000,
        totalRevenue: 36800000,
      ),
    ];
  }
}
