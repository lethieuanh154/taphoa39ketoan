import 'package:flutter/material.dart';
import 'package:data_table_2/data_table_2.dart';
import '../models/salary_entry.dart';
import '../utils/number_formatter.dart';

class S5SalaryTrackingScreen extends StatefulWidget {
  const S5SalaryTrackingScreen({super.key});

  @override
  State<S5SalaryTrackingScreen> createState() => _S5SalaryTrackingScreenState();
}

class _S5SalaryTrackingScreenState extends State<S5SalaryTrackingScreen> {
  DateTime fromDate = DateTime(2025, 1, 1);
  DateTime toDate = DateTime(2025, 1, 31);
  final List<SalaryEntry> data = SalaryEntry.getMockData();

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
          'SỔ S5-HKD',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'SỔ THEO DÕI THANH TOÁN TIỀN LƯƠNG VÀ CÁC KHOẢN NỘP THEO LƯƠNG',
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 600,
          child: DataTable2(
            columnSpacing: 8,
            horizontalMargin: 12,
            minWidth: 1800,
            headingRowColor: WidgetStateProperty.all(
              theme.colorScheme.primaryContainer,
            ),
            columns: [
              DataColumn2(
                label: Text('A\nNgày',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('B\nHọ tên',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.M,
              ),
              DataColumn2(
                label: Text('C\nMã NV',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('D\nPhòng ban',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('1\nLương CB',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('2\nPhụ cấp',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('3\nThưởng',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('4\nTổng TN',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('5\nBHXH',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('6\nTNCN',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('7\nKhác',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('8\nTổng trừ',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
                numeric: true,
              ),
              DataColumn2(
                label: Text('9\nThực lĩnh',
                    style: theme.textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary)),
                size: ColumnSize.S,
                numeric: true,
              ),
            ],
            rows: data.map((entry) {
              return DataRow2(
                cells: [
                  DataCell(Text(entry.recordDate, style: theme.textTheme.bodySmall)),
                  DataCell(Text(entry.employeeName, style: theme.textTheme.bodySmall)),
                  DataCell(Text(entry.employeeId, style: theme.textTheme.bodySmall)),
                  DataCell(Text(entry.department, style: theme.textTheme.bodySmall)),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.basicSalary),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.allowance),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.bonus),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.totalIncome),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.insurance),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.personalIncomeTax),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.otherDeduction),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(Text(
                    NumberFormatter.formatCurrency(entry.totalDeduction),
                    style: theme.textTheme.bodySmall,
                  )),
                  DataCell(
                    Text(
                      NumberFormatter.formatCurrency(entry.netSalary),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}
