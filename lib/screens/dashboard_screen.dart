import 'package:flutter/material.dart';
import '../models/dashboard_stats.dart';
import '../widgets/statistic_card.dart';
import '../widgets/chart_revenue.dart';
import '../widgets/chart_cost.dart';
import '../widgets/chart_profit.dart';

enum FilterType { month, quarter, year }

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  FilterType filterType = FilterType.month;
  int? selectedMonth;
  int? selectedQuarter;
  int selectedYear = DateTime.now().year;

  final List<int> years = List.generate(10, (index) => DateTime.now().year - 5 + index);
  final List<String> quarters = ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'];
  final List<String> months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final stats = DashboardStats.getMockStats();

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(theme),
            const SizedBox(height: 24),
            _buildFilters(theme),
            const SizedBox(height: 24),
            _buildStatistics(theme, stats),
            const SizedBox(height: 24),
            _buildCharts(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TỔNG QUAN',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Tổng quan tình hình kinh doanh',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFilters(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<FilterType>(
                    segments: const [
                      ButtonSegment(
                        value: FilterType.month,
                        label: Text('Tháng'),
                        icon: Icon(Icons.calendar_today, size: 16),
                      ),
                      ButtonSegment(
                        value: FilterType.quarter,
                        label: Text('Quý'),
                        icon: Icon(Icons.calendar_view_week, size: 16),
                      ),
                      ButtonSegment(
                        value: FilterType.year,
                        label: Text('Năm'),
                        icon: Icon(Icons.calendar_view_month, size: 16),
                      ),
                    ],
                    selected: {filterType},
                    onSelectionChanged: (Set<FilterType> newSelection) {
                      setState(() {
                        filterType = newSelection.first;
                        selectedMonth = null;
                        selectedQuarter = null;
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildFilterInputs(theme),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterInputs(ThemeData theme) {
    return Row(
      children: [
        if (filterType == FilterType.month) ...[
          Expanded(
            child: DropdownButtonFormField<int>(
              value: selectedMonth,
              decoration: const InputDecoration(
                labelText: 'Chọn tháng',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.event),
              ),
              hint: const Text('-- Chọn tháng --'),
              items: List.generate(12, (index) {
                return DropdownMenuItem(
                  value: index + 1,
                  child: Text(months[index]),
                );
              }),
              onChanged: (value) {
                setState(() => selectedMonth = value);
              },
            ),
          ),
          const SizedBox(width: 16),
        ],
        if (filterType == FilterType.quarter) ...[
          Expanded(
            child: DropdownButtonFormField<int>(
              value: selectedQuarter,
              decoration: const InputDecoration(
                labelText: 'Chọn quý',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.event_note),
              ),
              hint: const Text('-- Chọn quý --'),
              items: List.generate(4, (index) {
                return DropdownMenuItem(
                  value: index + 1,
                  child: Text(quarters[index]),
                );
              }),
              onChanged: (value) {
                setState(() => selectedQuarter = value);
              },
            ),
          ),
          const SizedBox(width: 16),
        ],
        Expanded(
          child: DropdownButtonFormField<int>(
            value: selectedYear,
            decoration: const InputDecoration(
              labelText: 'Năm',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.calendar_month),
            ),
            items: years.map((year) {
              return DropdownMenuItem(
                value: year,
                child: Text('$year'),
              );
            }).toList(),
            onChanged: (value) {
              if (value != null) {
                setState(() => selectedYear = value);
              }
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatistics(ThemeData theme, DashboardStats stats) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 1400
            ? 4
            : constraints.maxWidth > 1000
                ? 3
                : constraints.maxWidth > 600
                    ? 2
                    : 1;

        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 4.0,
          children: [
            StatisticCard(
              title: 'Tổng doanh thu',
              value: stats.totalRevenue,
              icon: Icons.trending_up,
              color: Colors.blue,
            ),
            StatisticCard(
              title: 'Tổng chi phí',
              value: stats.totalCost,
              icon: Icons.trending_down,
              color: Colors.red,
            ),
            StatisticCard(
              title: 'Lợi nhuận gộp',
              value: stats.grossProfit,
              icon: Icons.attach_money,
              color: Colors.green,
            ),
            StatisticCard(
              title: 'Lợi nhuận sau thuế',
              value: stats.netProfit,
              icon: Icons.monetization_on,
              color: Colors.teal,
            ),
            StatisticCard(
              title: 'Giá trị tồn kho',
              value: stats.inventoryValue,
              icon: Icons.inventory,
              color: Colors.indigo,
            ),
            StatisticCard(
              title: 'Thuế phải nộp',
              value: stats.taxPayable,
              icon: Icons.account_balance,
              color: Colors.orange,
            ),
            StatisticCard(
              title: 'Quỹ tiền mặt',
              value: stats.cashBalance,
              icon: Icons.account_balance_wallet,
              color: Colors.purple,
            ),
            StatisticCard(
              title: 'Tiền gửi ngân hàng',
              value: stats.bankBalance,
              icon: Icons.savings,
              color: Colors.cyan,
            ),
          ],
        );
      },
    );
  }

  Widget _buildCharts() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 1000;

        return Column(
          children: [
            isWide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Expanded(child: RevenueChart()),
                      const SizedBox(width: 16),
                      const Expanded(child: CostChart()),
                    ],
                  )
                : const Column(
                    children: [
                      RevenueChart(),
                      SizedBox(height: 16),
                      CostChart(),
                    ],
                  ),
            const SizedBox(height: 16),
            const ProfitChart(),
          ],
        );
      },
    );
  }
}
