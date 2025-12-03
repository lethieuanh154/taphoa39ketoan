import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../main.dart';

class AppSidebar extends StatefulWidget {
  const AppSidebar({super.key});

  @override
  State<AppSidebar> createState() => _AppSidebarState();
}

class _AppSidebarState extends State<AppSidebar>
    with SingleTickerProviderStateMixin {
  bool isExpanded = false;
  late AnimationController _animationController;
  late Animation<double> _widthAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );

    _widthAnimation = Tween<double>(
      begin: 80,
      end: 320,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    ));

    _opacityAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.3, 1.0, curve: Curves.easeIn),
    ));
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _toggleSidebar(bool expand) {
    setState(() => isExpanded = expand);
    if (expand) {
      _animationController.forward();
    } else {
      _animationController.reverse();
    }
  }

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
      onEnter: (_) => _toggleSidebar(true),
      onExit: (_) => _toggleSidebar(false),
      child: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return Container(
            width: _widthAnimation.value,
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
          );
        },
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
          Expanded(
            child: Opacity(
              opacity: _opacityAnimation.value,
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
                    overflow: TextOverflow.clip,
                  ),
                  Text(
                    'Kế Toán',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.clip,
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
    return Padding(
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
                Expanded(
                  child: Opacity(
                    opacity: _opacityAnimation.value,
                    child: Align(
                      alignment: Alignment.centerLeft,
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
                        overflow: TextOverflow.clip,
                      ),
                    ),
                  ),
                ),
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
