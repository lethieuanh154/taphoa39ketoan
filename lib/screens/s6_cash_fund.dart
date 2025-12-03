import 'package:flutter/material.dart';
import 'package:data_table_2/data_table_2.dart';
import '../models/cash_entry.dart';
import '../utils/number_formatter.dart';

class S6CashFundScreen extends StatefulWidget {
  const S6CashFundScreen({super.key});

  @override
  State<S6CashFundScreen> createState() => _S6CashFundScreenState();
}

class _S6CashFundScreenState extends State<S6CashFundScreen> {
  DateTime fromDate = DateTime(2025, 1, 1);
  DateTime toDate = DateTime(2025, 1, 31);
  final List<CashEntry> data = CashEntry.getMockData();

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
          'SỔ S6-HKD',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'SỔ QUỸ TIỀN MẶT',
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
            columnSpacing: 12,
            horizontalMargin: 12,
            minWidth: 1200,
            headingRowColor: WidgetStateProperty.all(
              theme.colorScheme.primaryContainer,
            ),
            columns: [
              DataColumn2(
                label: Text('A\nNgày ghi sổ',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('B\nSố hiệu chứng từ',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('C\nNgày chứng từ',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('D\nDiễn giải',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.L,
              ),
              DataColumn2(
                label: Text('E\nTK đối ứng',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.S,
              ),
              DataColumn2(
                label: Text('1\nThu',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.M,
                numeric: true,
              ),
              DataColumn2(
                label: Text('2\nChi',
                    style: theme.textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.bold)),
                size: ColumnSize.M,
                numeric: true,
              ),
              DataColumn2(
                label: Text('3\nTồn quỹ',
                    style: theme.textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary)),
                size: ColumnSize.M,
                numeric: true,
              ),
            ],
            rows: data.map((entry) {
              return DataRow2(
                cells: [
                  DataCell(Text(entry.recordDate)),
                  DataCell(Text(entry.voucherNumber)),
                  DataCell(Text(entry.voucherDate)),
                  DataCell(Text(entry.description)),
                  DataCell(Text(entry.accountDebit)),
                  DataCell(Text(
                    entry.cashIn > 0
                        ? NumberFormatter.formatCurrency(entry.cashIn)
                        : '',
                    style: const TextStyle(color: Colors.green),
                  )),
                  DataCell(Text(
                    entry.cashOut > 0
                        ? NumberFormatter.formatCurrency(entry.cashOut)
                        : '',
                    style: const TextStyle(color: Colors.red),
                  )),
                  DataCell(
                    Text(
                      NumberFormatter.formatCurrency(entry.balance),
                      style: TextStyle(
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
