import 'package:flutter/material.dart';
import '../models/dashboard_stats.dart';
import '../widgets/statistic_card.dart';
import '../widgets/chart_revenue.dart';
import '../widgets/chart_cost.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String selectedMonth = 'Tất cả';
  String selectedBranch = 'Tất cả chi nhánh';

  final List<String> months = [
    'Tất cả',
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
  ];

  final List<String> branches = [
    'Tất cả chi nhánh',
    'Chi nhánh HN',
    'Chi nhánh HCM',
    'Chi nhánh ĐN',
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
                'Dashboard',
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
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth > 600;

            return isWide
                ? Row(
                    children: [
                      Expanded(child: _buildMonthFilter(theme)),
                      const SizedBox(width: 16),
                      Expanded(child: _buildBranchFilter(theme)),
                    ],
                  )
                : Column(
                    children: [
                      _buildMonthFilter(theme),
                      const SizedBox(height: 16),
                      _buildBranchFilter(theme),
                    ],
                  );
          },
        ),
      ),
    );
  }

  Widget _buildMonthFilter(ThemeData theme) {
    return DropdownButtonFormField<String>(
      value: selectedMonth,
      decoration: const InputDecoration(
        labelText: 'Tháng',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.calendar_today),
      ),
      items: months.map((month) {
        return DropdownMenuItem(
          value: month,
          child: Text(month),
        );
      }).toList(),
      onChanged: (value) {
        if (value != null) {
          setState(() => selectedMonth = value);
        }
      },
    );
  }

  Widget _buildBranchFilter(ThemeData theme) {
    return DropdownButtonFormField<String>(
      value: selectedBranch,
      decoration: const InputDecoration(
        labelText: 'Chi nhánh',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.store),
      ),
      items: branches.map((branch) {
        return DropdownMenuItem(
          value: branch,
          child: Text(branch),
        );
      }).toList(),
      onChanged: (value) {
        if (value != null) {
          setState(() => selectedBranch = value);
        }
      },
    );
  }

  Widget _buildStatistics(ThemeData theme, DashboardStats stats) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 1200
            ? 3
            : constraints.maxWidth > 800
                ? 2
                : 1;

        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 2.5,
          children: [
            StatisticCard(
              title: 'Tổng doanh thu',
              value: stats.totalRevenue,
              icon: Icons.trending_up,
              color: Colors.green,
            ),
            StatisticCard(
              title: 'Tổng chi phí',
              value: stats.totalCost,
              icon: Icons.trending_down,
              color: Colors.red,
            ),
            StatisticCard(
              title: 'Giá trị tồn kho',
              value: stats.inventoryValue,
              icon: Icons.inventory,
              color: Colors.blue,
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
              color: Colors.teal,
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

        return isWide
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
              );
      },
    );
  }
}
