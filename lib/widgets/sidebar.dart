import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../main.dart';

class AppSidebar extends StatefulWidget {
  const AppSidebar({super.key});

  @override
  State<AppSidebar> createState() => _AppSidebarState();
}

class _AppSidebarState extends State<AppSidebar> {
  bool isExpanded = false;

  final List<MenuItem> menuItems = [
    MenuItem(
      title: 'Dashboard',
      icon: Icons.dashboard,
      index: 0,
    ),
    MenuItem(
      title: 'SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ',
      icon: Icons.attach_money,
      index: 1,
    ),
    MenuItem(
      title: 'SỔ CHI TIẾT VẬT LIỆU, DỤNG CỤ, SẢN PHẨM, HÀNG HÓA',
      icon: Icons.inventory_2,
      index: 2,
    ),
    MenuItem(
      title: 'SỔ CHI PHÍ SẢN XUẤT, KINH DOANH',
      icon: Icons.receipt_long,
      index: 3,
    ),
    MenuItem(
      title: 'SỔ THEO DÕI TÌNH HÌNH THỰC HIỆN NGHĨA VỤ THUẾ',
      icon: Icons.account_balance,
      index: 4,
    ),
    MenuItem(
      title: 'SỔ THEO DÕI THANH TOÁN TIỀN LƯƠNG',
      icon: Icons.payments,
      index: 5,
    ),
    MenuItem(
      title: 'SỔ QUỸ TIỀN MẶT',
      icon: Icons.account_balance_wallet,
      index: 6,
    ),
    MenuItem(
      title: 'SỔ TIỀN GỬI NGÂN HÀNG',
      icon: Icons.savings,
      index: 7,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final nav = Provider.of<NavigationProvider>(context);

    return MouseRegion(
      onEnter: (_) => setState(() => isExpanded = true),
      onExit: (_) => setState(() => isExpanded = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: isExpanded ? 320 : 80,
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(
            right: BorderSide(
              color: theme.colorScheme.outlineVariant,
              width: 1,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(2, 0),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(theme),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: menuItems.length,
                itemBuilder: (context, index) {
                  final item = menuItems[index];
                  final isSelected = nav.selectedIndex == item.index;

                  return _buildMenuItem(
                    theme,
                    item,
                    isSelected,
                    () => nav.setIndex(item.index),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      padding: EdgeInsets.all(isExpanded ? 20 : 16),
      child: Row(
        mainAxisAlignment: isExpanded ? MainAxisAlignment.start : MainAxisAlignment.center,
        children: [
          Icon(
            Icons.store,
            size: isExpanded ? 32 : 28,
            color: theme.colorScheme.primary,
          ),
          if (isExpanded) ...[
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tạp Hóa 39',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  Text(
                    'Kế Toán',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuItem(
    ThemeData theme,
    MenuItem item,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected
                  ? theme.colorScheme.primaryContainer
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  color: isSelected
                      ? theme.colorScheme.onPrimaryContainer
                      : theme.colorScheme.onSurfaceVariant,
                  size: 24,
                ),
                if (isExpanded) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.title,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: isSelected
                            ? theme.colorScheme.onPrimaryContainer
                            : theme.colorScheme.onSurface,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MenuItem {
  final String title;
  final IconData icon;
  final int index;

  MenuItem({
    required this.title,
    required this.icon,
    required this.index,
  });
}
