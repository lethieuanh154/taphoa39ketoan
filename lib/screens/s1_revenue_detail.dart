import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

// ===================================================================
// FILTER SECTION (ĐÃ TÍCH HỢP)
// ===================================================================
class FilterSection extends StatefulWidget {
  final Function(DateTime?, DateTime?) onFilter;

  const FilterSection({super.key, required this.onFilter});

  @override
  State<FilterSection> createState() => _FilterSectionState();
}

class _FilterSectionState extends State<FilterSection> {
  DateTime? _fromDate;
  DateTime? _toDate;

  final dateFormat = DateFormat("dd/MM/yyyy");

  Future<void> _pickDate({required bool isFrom}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(2000),
      lastDate: DateTime(now.year + 1),
    );

    if (picked != null) {
      setState(() {
        if (isFrom) {
          _fromDate = picked;
        } else {
          _toDate = picked;
        }
      });

      widget.onFilter(_fromDate, _toDate);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),

      child: Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          // FROM DATE
          _buildDateBox(
            label: _fromDate != null
                ? dateFormat.format(_fromDate!)
                : "Từ ngày",
            onTap: () => _pickDate(isFrom: true),
          ),

          // TO DATE
          _buildDateBox(
            label: _toDate != null
                ? dateFormat.format(_toDate!)
                : "Đến ngày",
            onTap: () => _pickDate(isFrom: false),
          ),

          // BUTTON
          SizedBox(
            width: 160,
            child: ElevatedButton(
              onPressed: () {
                widget.onFilter(_fromDate, _toDate);
              },
              child: const Text("Lọc dữ liệu"),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildDateBox({required String label, required VoidCallback onTap}) {
    return SizedBox(
      width: 200,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Colors.grey, width: 1),
          ),
          child: Row(
            children: [
              const Icon(Icons.date_range),
              const SizedBox(width: 8),
              Expanded(child: Text(label))
            ],
          ),
        ),
      ),
    );
  }
}

// ===================================================================
// MAIN SCREEN (TABLE + FILTER ĐÃ GỘP)
// ===================================================================
class S1RevenueDetailScreen extends StatefulWidget {
  const S1RevenueDetailScreen({super.key});

  @override
  State<S1RevenueDetailScreen> createState() => _S1RevenueDetailScreenState();
}

class _S1RevenueDetailScreenState extends State<S1RevenueDetailScreen> {
  DateTime? fromDate;
  DateTime? toDate;

  // Callback filter
  void _applyFilter(DateTime? from, DateTime? to) {
    setState(() {
      fromDate = from;
      toDate = to;
    });

    // TODO: Gọi API hoặc lọc danh sách theo nhu cầu
    debugPrint("➡ Lọc từ: $fromDate  đến: $toDate");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Chi tiết doanh thu")),

      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilterSection(onFilter: _applyFilter),
          const SizedBox(height: 20),

          Card(
            margin: const EdgeInsets.all(0),
            elevation: 3,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final tableWidth = constraints.maxWidth * 0.998;

                  return Stack(
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: IntrinsicWidth(
                          child: Column(
                            children: [
                              _buildCustomHeader(tableWidth),
                              _buildRows(tableWidth),
                              SizedBox(height: 50), // Space for fixed footer
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: IntrinsicWidth(
                            child: _buildFooterRow(tableWidth),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===================================================================
  // HEADER
  // ===================================================================
  Widget _buildCustomHeader(double tableWidth) {
    final wNgayGhiSo = tableWidth * 0.14;
    final wSoHieu = tableWidth * 0.11;
    final wNgayCT = tableWidth * 0.11;
    final wDienGiai = tableWidth * 0.32;
    final wDoanhThu = tableWidth * 0.19;
    final wGhiChu = tableWidth * 0.13;

    return Container(
      decoration: _headerBox(),
      child: Row(
        children: [
          _headerMain("Ngày ghi sổ", wNgayGhiSo),
          _headerMain("Số hiệu Chứng Từ", wSoHieu),
          _headerMain("Ngày Chứng Từ", wNgayCT),
          _headerMain("Diễn giải", wDienGiai),
          _headerMain("Doanh thu", wDoanhThu),
          _headerMain("Ghi chú", wGhiChu),
        ],
      ),
    );
  }

  BoxDecoration _headerBox() => BoxDecoration(
        color: const Color(0xFFE9F1FB)
      );

  Widget _headerMain(String text, double width) {
    Color bgColor;
    if (text == "Ngày ghi sổ") {
      bgColor = const Color(0xFFBBDEFB); // Darker blue
    } else if (text == "Số hiệu Chứng Từ") {
      bgColor = const Color(0xFFA5D6A7); // Darker green
    } else if (text == "Ngày Chứng Từ") {
      bgColor = const Color(0xFF81C784); // Even darker green
    } else if (text == "Diễn giải") {
      bgColor = const Color(0xFFE1BEE7); // Light purple
    } else if (text == "Doanh thu") {
      bgColor = const Color(0xFFFFE082); // Darker yellow
    } else if (text == "Ghi chú") {
      bgColor = const Color(0xFFA9A9A9); // Darker Gray
    } else {
      bgColor = const Color(0xFFE9F1FB);
    }
    return Container(
      width: width,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bgColor,
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }

  Color _getColumnColor(int columnIndex) {
    switch (columnIndex) {
      case 0: // Ngày ghi sổ - Light blue
        return const Color(0xFFE3F2FD);
      case 1: // Số hiệu CT - Light green
        return const Color(0xFFC8E6C9);
      case 2: // Ngày CT - Lighter green
        return const Color(0xFFA5D6A7);
      case 3: // Diễn giải - Light purple
        return const Color(0xFFF3E5F5);
      case 4: // Doanh thu - Light yellow
        return const Color(0xFFFFF9C4);
      case 5: // Ghi chú - Light gray
        return const Color(0xFFD3D3D3);
      default:
        return Colors.white;
    }
  }

  // ===================================================================
  // TABLE ROWS
  // ===================================================================
  Widget _buildRows(double tableWidth) {
    final wNgayGhiSo = tableWidth * 0.14;
    final wSoHieu = tableWidth * 0.11;
    final wNgayCT = tableWidth * 0.11;
    final wDienGiai = tableWidth * 0.32;
    final wDoanhThu = tableWidth * 0.19;
    final wGhiChu = tableWidth * 0.13;

    return Column(
      children: List.generate(15, (i) {
        return Row(
          children: [
            _dataCell("01/01/2025", wNgayGhiSo, 0),
            _dataCell("CT-${i + 1}", wSoHieu, 1),
            _dataCell("01/01/2025", wNgayCT, 2),
            _dataCell("Dòng diễn giải số ${i + 1}", wDienGiai, 3),
            _dataCell("100.000", wDoanhThu, 4),
            _dataCell("...", wGhiChu, 5),
          ],
        );
      }),
    );
  }

  Widget _dataCell(String text, double width, int columnIndex) {
    // Columns 3 (Diễn giải) and 5 (Ghi chú) are left-aligned, others are center-aligned
    final isLeftAligned = columnIndex == 3 || columnIndex == 5;
    final alignment = isLeftAligned ? Alignment.centerLeft : Alignment.center;
    
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      height: 42,
      alignment: alignment,
      decoration: BoxDecoration(
        color: _getColumnColor(columnIndex),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 13),
          overflow: TextOverflow.ellipsis),
    );
  }

  Widget _buildFooterRow(double tableWidth) {
    final wNgayGhiSo = tableWidth * 0.14;
    final wSoHieu = tableWidth * 0.11;
    final wNgayCT = tableWidth * 0.11;
    final wDienGiai = tableWidth * 0.32;
    final wDoanhThu = tableWidth * 0.19;
    final wGhiChu = tableWidth * 0.13;

    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[200],
        border: Border(top: BorderSide(color: Colors.grey[400]!, width: 2)),
      ),
      child: Row(
        children: [
          _footerCell("", wNgayGhiSo),
          _footerCell("", wSoHieu),
          _footerCell("", wNgayCT),
          _footerCell("Tổng Doanh thu", wDienGiai),
          _footerCell("1.500.000", wDoanhThu),
          _footerCell("", wGhiChu),
        ],
      ),
    );
  }

  Widget _footerCell(String text, double width) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      height: 42,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.grey[200],
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          overflow: TextOverflow.ellipsis),
    );
  }
}
