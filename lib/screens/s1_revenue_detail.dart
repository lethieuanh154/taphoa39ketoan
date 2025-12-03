import 'package:flutter/material.dart';
import 'package:data_table_2/data_table_2.dart';
import '../models/revenue_entry.dart';
import '../utils/number_formatter.dart';

class S1RevenueDetailScreen extends StatefulWidget {
  const S1RevenueDetailScreen({super.key});

  @override
  State<S1RevenueDetailScreen> createState() => _S1RevenueDetailScreenState();
}

class _S1RevenueDetailScreenState extends State<S1RevenueDetailScreen> {
  DateTime fromDate = DateTime(2025, 1, 1);
  DateTime toDate = DateTime(2025, 1, 31);
  final List<RevenueEntry> data = RevenueEntry.getMockData();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

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
            _buildDataTable(theme),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SỔ S1-HKD',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ',
          style: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
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
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDatePicker(
                    theme,
                    'Từ ngày',
                    fromDate,
                    (date) => setState(() => fromDate = date),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildDatePicker(
                    theme,
                    'Đến ngày',
                    toDate,
                    (date) => setState(() => toDate = date),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Chức năng xuất Excel đang phát triển')),
                    );
                  },
                  icon: const Icon(Icons.table_chart),
                  label: const Text('Xuất Excel'),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Chức năng xuất PDF đang phát triển')),
                    );
                  },
                  icon: const Icon(Icons.picture_as_pdf),
                  label: const Text('Xuất PDF'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDatePicker(
    ThemeData theme,
    String label,
    DateTime date,
    Function(DateTime) onDateSelected,
  ) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate: DateTime(2020),
          lastDate: DateTime(2030),
        );
        if (picked != null) {
          onDateSelected(picked);
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.calendar_today),
        ),
        child: Text(
          '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}',
        ),
      ),
    );
  }

  Widget _buildDataTable(ThemeData theme) {
    // Calculate totals
    double totalRevenue = 0;

    for (var entry in data) {
      totalRevenue += entry.totalRevenue;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            SizedBox(
              height: 600,
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    // Custom Header with merged cells
                    _buildCustomHeader(theme),
                    // Data Table
                    SizedBox(
                      height: 480,
                      child: DataTable2(
                        columnSpacing: 12,
                        horizontalMargin: 12,
                        minWidth: 900,
                        headingRowColor: WidgetStateProperty.all(
                          Colors.transparent,
                        ),
                        headingRowHeight: 0,
                        dividerThickness: 1,
                        dataRowHeight: 48,
                        columns: [
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.S,
                          ),
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.S,
                          ),
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.S,
                          ),
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.L,
                          ),
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.M,
                            numeric: true,
                          ),
                          DataColumn2(
                            label: const Text(''),
                            size: ColumnSize.S,
                          ),
                        ],
                        rows: data.map((entry) {
                          return DataRow2(
                            cells: [
                              DataCell(Text(entry.recordDate)),
                              DataCell(Text(entry.voucherNumber)),
                              DataCell(Text(entry.voucherDate)),
                              DataCell(Text(entry.description)),
                              DataCell(
                                Text(
                                  NumberFormatter.formatCurrency(entry.totalRevenue),
                                  textAlign: TextAlign.right,
                                ),
                              ),
                              DataCell(Text('')),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                    SizedBox(height: 60), // Space for fixed footer
                  ],
                ),
              ),
            ),
            // Fixed footer row with totals
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  border: Border(
                    top: BorderSide(
                      color: theme.colorScheme.outline,
                      width: 1,
                    ),
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: Row(
                  children: [
                    SizedBox(width: 12),
                    SizedBox(
                      width: 100,
                      child: const Text(''),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 100,
                      child: const Text(''),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 100,
                      child: const Text(''),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Tổng cộng',
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 140,
                      child: Text(
                        NumberFormatter.formatCurrency(totalRevenue),
                        textAlign: TextAlign.right,
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(width: 100),
                    SizedBox(width: 12),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomHeader(ThemeData theme) {
    return Container(
      color: theme.colorScheme.primaryContainer,
      child: Column(
        children: [
          // First row - Main headers with merged cells
          Row(
            children: [
              _buildHeaderCell(theme, 'Ngày,\ntháng ghi\nsổ', 100, isLeft: true),
              _buildHeaderCell(theme, 'Chứng từ', 200),
              _buildHeaderCell(theme, 'Diễn giải', 250),
              Expanded(
                child: _buildHeaderCell(theme, 'Doanh thu bán hàng hóa', 140),
              ),
              _buildHeaderCell(theme, 'Ghi chú', 100, isRight: true),
            ],
          ),
          // Second row - Sub headers for "Chứng từ"
          Row(
            children: [
              SizedBox(width: 100 + 12),
              _buildHeaderCell(theme, 'Số hiệu', 94),
              _buildHeaderCell(theme, 'Ngày,\ntháng', 94),
              SizedBox(width: 250 + 12),
              Expanded(
                child: SizedBox(width: 140),
              ),
              SizedBox(width: 100 + 12),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(ThemeData theme, String text, double width, {bool isLeft = false, bool isRight = false}) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(
            color: theme.colorScheme.outline,
            width: 0.5,
          ),
          bottom: BorderSide(
            color: theme.colorScheme.outline,
            width: 0.5,
          ),
        ),
      ),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
