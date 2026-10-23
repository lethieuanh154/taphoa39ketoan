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

## Công cụ ngoài app

- `tools/doi-soat-hoa-don/doi_soat.py` (script 1, v2) — Python chạy trên máy kế toán: đọc XML hóa đơn đầu vào/đầu ra (kể cả ZIP), ghép mặt hàng với mã master KiotViet theo bảng quy đổi xuất từ TapHoa39BanHang (nút "Xuất bảng quy đổi", JSON) — đầu ra ghép theo mã vạch, đầu vào theo tên + ĐVT — quy đổi về ĐVT master, kiểm tra số học (tách lệch do làm tròn đơn giá), FIFO → Excel danh sách sản phẩm / đối soát theo master / dòng hàng quy đổi / ngoại lệ. Xuất thêm bảng kê mua vào (01-1/HT) / bán ra (01-1/GTGT), tờ khai 01/GTGT (TT80) + phụ lục giảm thuế NQ 204/2025/QH15 (xlsx + PDF "BẢN NHÁP" đối chiếu, không dùng để nộp), và tờ khai 05/KK-TNCN từ file bảng lương Excel (`*luong*.xlsx`); so với XML tờ khai HTKK đã nộp (GTGT mã 842, TNCN mã 864); xuất XML 2 tờ khai theo định dạng HTKK vào thư mục con `XML to khai (ban nhap)`; tạo bản sao XML hóa đơn đã quy đổi ĐVT (SL × hệ số, ĐG ÷ hệ số, ĐVT/mã/tên master; thành tiền-thuế giữ nguyên) vào `Dau vao (quy doi)` / `Dau ra (quy doi)`. Không sửa XML gốc. Script 2 (xuất file nhập Vietda) đã hủy — KeToan sẽ thay Vietda. Hướng dẫn: `tools/doi-soat-hoa-don/README.md`.
- **Kế hoạch: KeToan thay Vietda, tái cấu trúc app** (chưa làm): `../plan-ketoan-flow.md` — menu 3 mục Tiện ích (Kiểm tra HĐ tự động, Đối soát CK…) / Kế toán chi tiết (nhóm 1–11 hiện có + Khóa sổ, Dấu vết kiểm toán) / Thiết lập; nhập HĐ từ thư mục FDI; số liệu khai thuế chỉ để copy/paste vào HTKK; backend chỉ FastAPI; Pha 0 = bảo mật (M0) + trang đăng nhập Google kiêm Gmail.
- **Kế hoạch đưa đối soát vào web** (bước 1 của flow, chưa làm): `../plan-doi-soat-web.md` — đọc XML hóa đơn từ thư mục trên máy (không tải từ cổng thuế), mỗi file Excel của script → 1 page, mỗi sheet → 1 tab; bỏ file tờ khai xlsx/pdf và `ton_dau_ky.xlsx`; page tờ khai TNCN đọc từ file bảng lương.

## Liên kết tài liệu

- [COMPONENTS.md](./COMPONENTS.md) - Chi tiết các components
- [SERVICES.md](./SERVICES.md) - Chi tiết các services
- [MODELS.md](./MODELS.md) - Chi tiết các models/interfaces
- [ROUTES.md](./ROUTES.md) - Chi tiết routing
- [STATUS.md](./STATUS.md) - Trạng thái hoàn thành chi tiết
