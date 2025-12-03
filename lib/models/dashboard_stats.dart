class DashboardStats {
  final double totalRevenue;
  final double totalCost;
  final double inventoryValue;
  final double taxPayable;
  final double cashBalance;
  final double bankBalance;
  final double grossProfit;
  final double netProfit;

  DashboardStats({
    required this.totalRevenue,
    required this.totalCost,
    required this.inventoryValue,
    required this.taxPayable,
    required this.cashBalance,
    required this.bankBalance,
    required this.grossProfit,
    required this.netProfit,
  });

  static DashboardStats getMockStats() {
    const revenue = 260100000.0;
    const cost = 134800000.0;
    const tax = 27310000.0;

    return DashboardStats(
      totalRevenue: revenue,
      totalCost: cost,
      inventoryValue: 342900000,
      taxPayable: tax,
      cashBalance: 40000000,
      bankBalance: 279500000,
      grossProfit: revenue - cost,
      netProfit: revenue - cost - tax,
    );
  }
}

class MonthlyRevenue {
  final String month;
  final double amount;

  MonthlyRevenue({required this.month, required this.amount});

  static List<MonthlyRevenue> getMockData() {
    return [
      MonthlyRevenue(month: 'T1', amount: 250000000),
      MonthlyRevenue(month: 'T2', amount: 280000000),
      MonthlyRevenue(month: 'T3', amount: 310000000),
      MonthlyRevenue(month: 'T4', amount: 295000000),
      MonthlyRevenue(month: 'T5', amount: 330000000),
      MonthlyRevenue(month: 'T6', amount: 350000000),
      MonthlyRevenue(month: 'T7', amount: 320000000),
      MonthlyRevenue(month: 'T8', amount: 340000000),
      MonthlyRevenue(month: 'T9', amount: 360000000),
      MonthlyRevenue(month: 'T10', amount: 380000000),
      MonthlyRevenue(month: 'T11', amount: 370000000),
      MonthlyRevenue(month: 'T12', amount: 400000000),
    ];
  }
}

class MonthlyCost {
  final String month;
  final double amount;

  MonthlyCost({required this.month, required this.amount});

  static List<MonthlyCost> getMockData() {
    return [
      MonthlyCost(month: 'T1', amount: 180000000),
      MonthlyCost(month: 'T2', amount: 190000000),
      MonthlyCost(month: 'T3', amount: 210000000),
      MonthlyCost(month: 'T4', amount: 195000000),
      MonthlyCost(month: 'T5', amount: 220000000),
      MonthlyCost(month: 'T6', amount: 230000000),
      MonthlyCost(month: 'T7', amount: 215000000),
      MonthlyCost(month: 'T8', amount: 225000000),
      MonthlyCost(month: 'T9', amount: 240000000),
      MonthlyCost(month: 'T10', amount: 250000000),
      MonthlyCost(month: 'T11', amount: 245000000),
      MonthlyCost(month: 'T12', amount: 260000000),
    ];
  }
}

class MonthlyProfit {
  final String month;
  final double amount;

  MonthlyProfit({required this.month, required this.amount});

  static List<MonthlyProfit> getMockData() {
    final revenues = MonthlyRevenue.getMockData();
    final costs = MonthlyCost.getMockData();

    return List.generate(12, (index) {
      return MonthlyProfit(
        month: revenues[index].month,
        amount: revenues[index].amount - costs[index].amount,
      );
    });
  }
}
