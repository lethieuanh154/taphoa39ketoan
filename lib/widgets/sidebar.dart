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

  void _toggleSidebar(bool expand) {
    setState(() => isExpanded = expand);
  }

  final List<MenuItem> menuItems = [
    MenuItem(
      title: 'TỔNG QUAN',
      icon: Icons.dashboard,
      index: 0,
    ),
    MenuItem(
      title: 'DOANH THU BÁN HÀNG HÓA',
      icon: Icons.attach_money,
      index: 1,
    ),
    MenuItem(
      title: 'SẢN PHẨM, HÀNG HÓA',
      icon: Icons.inventory_2,
      index: 2,
    ),
    MenuItem(
      title: 'CHI PHÍ SẢN XUẤT, KINH DOANH',
      icon: Icons.receipt_long,
      index: 3,
    ),
    MenuItem(
      title: 'NGHĨA VỤ THUẾ',
      icon: Icons.account_balance,
      index: 4,
    ),
    MenuItem(
      title: 'THANH TOÁN TIỀN LƯƠNG',
      icon: Icons.payments,
      index: 5,
    ),
    MenuItem(
      title: 'QUỸ TIỀN MẶT',
      icon: Icons.account_balance_wallet,
      index: 6,
    ),
    MenuItem(
      title: 'TIỀN GỬI NGÂN HÀNG',
      icon: Icons.savings,
      index: 7,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final nav = Provider.of<NavigationProvider>(context);

    return MouseRegion(
      onEnter: (_) => _toggleSidebar(true),
      onExit: (_) => _toggleSidebar(false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
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
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(2, 0),
            ),
          ],
        ),
        child: ClipRect(
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
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      height: 80,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(
            Icons.store,
            size: 32,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: 12),
          if (isExpanded)
            Expanded(
              child: AnimatedOpacity(
                opacity: 1.0,
                duration: const Duration(milliseconds: 80),
                curve: Curves.easeOut,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Tạp Hóa 39',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'Kế Toán',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
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
    return RepaintBoundary(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isSelected
                    ? theme.colorScheme.primaryContainer
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Icon(
                      item.icon,
                      color: isSelected
                          ? theme.colorScheme.onPrimaryContainer
                          : theme.colorScheme.onSurfaceVariant,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (isExpanded)
                    Expanded(
                      child: AnimatedOpacity(
                        opacity: 1.0,
                        duration: const Duration(milliseconds: 80),
                        curve: Curves.easeOut,
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
                    ),
                ],
              ),
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
