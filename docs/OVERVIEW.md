# TapHoa39KeToan - Hệ thống Kế toán Doanh nghiệp

## Giới thiệu

Hệ thống kế toán doanh nghiệp theo chuẩn Việt Nam, thiết kế cho Công ty TNHH 1 thành viên - Doanh nghiệp nhỏ & vừa.

## Quy chuẩn áp dụng

| Văn bản | Nội dung |
|---------|----------|
| TT 133/2016/TT-BTC | Hệ thống tài khoản kế toán doanh nghiệp nhỏ và vừa |
| TT 78/2021/TT-BTC | Hóa đơn điện tử |
| NĐ 123/2020/NĐ-CP | Quy định về hóa đơn, chứng từ |
| TT 88/2021/TT-BTC | 7 loại sổ kế toán hộ kinh doanh (tham khảo) |
| TT 99/2025/TT-BTC | Định hướng mới (đang cập nhật) |

## Công nghệ

- **Framework**: Angular 19 (Standalone Components)
- **Language**: TypeScript 5.x
- **State Management**: BehaviorSubject (RxJS)
- **Storage**: localStorage (demo), có thể mở rộng API
- **Build Size**: ~887 kB

## Cấu trúc thư mục

```
src/app/
├── app.routes.ts              # Routing configuration
├── app.component.ts           # Root component
├── app.config.ts              # App providers
├── components/                # UI Components (14 active)
│   ├── accountant-dashboard/
│   ├── accountant-pages/
│   │   └── invoice-page/      # Hóa đơn mua/bán
│   ├── audit-trail-page/
│   ├── balance-sheet-page/
│   ├── cash-flow-page/
│   ├── cash-voucher-page/     # Phiếu thu/chi
│   ├── chart-of-accounts-page/
│   ├── income-statement-page/
│   ├── journal-page/
│   ├── ledger-page/
│   ├── period-lock-page/
│   ├── placeholder/
│   └── trial-balance-page/
├── layouts/
│   └── main-layout/           # Sidebar + Router Outlet
├── models/                    # Interfaces & Constants (14 files)
└── services/                  # Business Logic (17 files)
```

## Tiến độ tổng quan

- **Tổng số routes**: 40
- **Đã hoàn thành**: 14 (35%)
- **Còn placeholder**: 26 (65%)

## Liên kết tài liệu

- [COMPONENTS.md](./COMPONENTS.md) - Chi tiết các components
- [SERVICES.md](./SERVICES.md) - Chi tiết các services
- [MODELS.md](./MODELS.md) - Chi tiết các models/interfaces
- [ROUTES.md](./ROUTES.md) - Chi tiết routing
- [STATUS.md](./STATUS.md) - Trạng thái hoàn thành chi tiết
