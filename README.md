# Tạp Hóa 39 - Hệ Thống Kế Toán

Ứng dụng web quản lý kế toán cho doanh nghiệp nhỏ, được xây dựng bằng Flutter với Material Design 3.

## Tính Năng Chính

### Dashboard
- Thống kê tổng quan: Doanh thu, Chi phí, Tồn kho, Thuế phải nộp, Quỹ tiền mặt, Tiền gửi ngân hàng
- Biểu đồ cột: Doanh thu theo tháng (12 tháng)
- Biểu đồ đường: Chi phí theo tháng (12 tháng)
- Bộ lọc theo tháng/năm và chi nhánh

### Sổ Kế Toán

#### 1. SỔ S1-HKD - Chi Tiết Doanh Thu
- Theo dõi doanh thu bán hàng hóa, dịch vụ
- Các cột: Ngày ghi sổ, Số hiệu chứng từ, Ngày chứng từ, Diễn giải
- Chi tiết doanh thu: Phân phối/cung cấp, Bán buôn, Bán lẻ, Dịch vụ, Khác

#### 2. SỔ S2-HKD - Chi Tiết Vật Liệu
- Quản lý vật liệu, dụng cụ, sản phẩm, hàng hóa
- Theo dõi: Tồn đầu kỳ, Nhập, Xuất, Tồn cuối kỳ, Đơn giá, Giá trị

#### 3. SỔ S3-HKD - Chi Phí Sản Xuất, Kinh Doanh
- Chi tiết các loại chi phí: Nguyên vật liệu, Nhân công, Khấu hao, Điện nước, Marketing, Quản lý, Khác

#### 4. SỔ S4-HKD - Theo Dõi Nghĩa Vụ Thuế
- Quản lý các loại thuế: VAT, TNDN, Môn bài, Tài nguyên
- Theo dõi số tiền thuế phải nộp

#### 5. SỔ S5-HKD - Thanh Toán Tiền Lương
- Quản lý lương nhân viên
- Chi tiết: Lương cơ bản, Phụ cấp, Thưởng, BHXH, Thuế TNCN, Thực lĩnh

#### 6. SỔ S6-HKD - Quỹ Tiền Mặt
- Sổ quỹ tiền mặt
- Theo dõi: Thu, Chi, Tồn quỹ
- Tài khoản đối ứng

#### 7. SỔ S7-HKD - Tiền Gửi Ngân Hàng
- Quản lý tiền gửi ngân hàng
- Theo dõi: Tiền gửi, Tiền rút, Số dư

## Công Nghệ Sử Dụng

- **Flutter**: Framework UI
- **Material 3**: Design system
- **Provider**: State management
- **DataTable2**: Bảng dữ liệu nâng cao
- **FL Chart**: Biểu đồ
- **Intl**: Định dạng số và tiền tệ

## Cài Đặt và Chạy

### Yêu Cầu
- Flutter SDK 3.0.0 trở lên
- Dart SDK 3.0.0 trở lên
- Chrome (để chạy trên web)

### Cài Đặt Dependencies

```bash
flutter pub get
```

### Chạy Trên Web

```bash
flutter run -d chrome
```

### Build Production

```bash
flutter build web
```

File build sẽ nằm trong thư mục `build/web/`

## Cấu Trúc Project

```
lib/
├── models/              # Data models
│   ├── revenue_entry.dart
│   ├── inventory_entry.dart
│   ├── cost_entry.dart
│   ├── tax_entry.dart
│   ├── salary_entry.dart
│   ├── cash_entry.dart
│   ├── bank_entry.dart
│   └── dashboard_stats.dart
├── screens/             # Màn hình
│   ├── dashboard_screen.dart
│   ├── s1_revenue_detail.dart
│   ├── s2_inventory_detail.dart
│   ├── s3_cost_detail.dart
│   ├── s4_tax_tracking.dart
│   ├── s5_salary_tracking.dart
│   ├── s6_cash_fund.dart
│   └── s7_bank_deposit.dart
├── widgets/             # Widgets tái sử dụng
│   ├── sidebar.dart
│   ├── statistic_card.dart
│   ├── chart_revenue.dart
│   └── chart_cost.dart
├── utils/               # Utilities
│   └── number_formatter.dart
└── main.dart            # Entry point
```

## Tính Năng Nổi Bật

### 🎨 Giao Diện
- Material Design 3
- Responsive design (hỗ trợ desktop, tablet)
- Sidebar expandable khi hover
- Dark/Light theme ready

### 📊 Dashboard
- 6 thẻ thống kê tổng quan
- 2 biểu đồ tương tác (Bar chart & Line chart)
- Bộ lọc linh hoạt theo tháng và chi nhánh

### 📋 Sổ Kế Toán
- DataTable với pagination
- Bộ lọc theo khoảng thời gian
- Nút xuất Excel/PDF (ready to implement)
- Định dạng số tiền Việt Nam (₫)
- Responsive horizontal scroll

### 🔧 Code Quality
- Null-safety
- Clean architecture
- Separated concerns
- Reusable widgets
- Mock data for testing

## Phát Triển Tiếp

- [ ] Kết nối API backend
- [ ] Xác thực người dùng
- [ ] Xuất file Excel/PDF thực tế
- [ ] Thêm/Sửa/Xóa dữ liệu
- [ ] Tìm kiếm và sắp xếp nâng cao
- [ ] Responsive mobile layout
- [ ] Multi-language support
- [ ] Print functionality

## License

MIT License
