import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/dashboard_screen.dart';
import 'screens/s1_revenue_detail.dart';
import 'screens/s2_inventory_detail.dart';
import 'screens/s3_cost_detail.dart';
import 'screens/s4_tax_tracking.dart';
import 'screens/s5_salary_tracking.dart';
import 'screens/s6_cash_fund.dart';
import 'screens/s7_bank_deposit.dart';
import 'widgets/sidebar.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => NavigationProvider(),
      child: MaterialApp(
        title: 'Tạp Hóa 39 - Kế Toán',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.light,
          ),
          useMaterial3: true,
          cardTheme: CardThemeData(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        home: const SelectionArea(
          child: MainLayout(),
        ),
      ),
    );
  }
}

class NavigationProvider extends ChangeNotifier {
  int _selectedIndex = 0;

  int get selectedIndex => _selectedIndex;

  void setIndex(int index) {
    _selectedIndex = index;
    notifyListeners();
  }
}

class MainLayout extends StatelessWidget {
  const MainLayout({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isMobile = constraints.maxWidth < 800;

          return Row(
            children: [
              if (!isMobile) const AppSidebar(),
              Expanded(
                child: Consumer<NavigationProvider>(
                  builder: (context, nav, _) {
                    return _getScreen(nav.selectedIndex);
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _getScreen(int index) {
    switch (index) {
      case 0:
        return const DashboardScreen();
      case 1:
        return const S1RevenueDetailScreen();
      case 2:
        return const S2InventoryDetailScreen();
      case 3:
        return const S3CostDetailScreen();
      case 4:
        return const S4TaxTrackingScreen();
      case 5:
        return const S5SalaryTrackingScreen();
      case 6:
        return const S6CashFundScreen();
      case 7:
        return const S7BankDepositScreen();
      default:
        return const DashboardScreen();
    }
  }
}
