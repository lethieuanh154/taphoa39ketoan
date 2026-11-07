import { Component } from '@angular/core';

/** Công cụ chạy trên máy kế toán. `file` = public/tools/<thư mục tools/>.zip do scripts/pack-tools.mjs sinh lúc build. */
interface ToolDownload {
  file: string;
  title: string;
  icon: string;
  summary: string;
  requires: string;
  steps: string[];
}

@Component({
  selector: 'app-tools-download-page',
  standalone: true,
  templateUrl: './tools-download-page.component.html',
  styleUrl: './tools-download-page.component.css'
})
export class ToolsDownloadPageComponent {
  readonly tools: ToolDownload[] = [
    {
      file: 'gdt-xml-extension.zip',
      title: 'Tải XML hóa đơn từ cổng thuế (GDT)',
      icon: 'fa-brands fa-chrome',
      summary: 'Extension Chrome: sau khi bạn đăng nhập hoadondientu.gdt.gov.vn, bấm Tìm kiếm và nhập captcha, extension tự tải XML mọi hóa đơn trong kết quả (qua hết các trang), bỏ qua HĐ đã tải.',
      requires: 'Chrome / Edge / Cốc Cốc',
      steps: [
        'Giải nén zip, mở chrome://extensions → bật Developer mode → Load unpacked → chọn thư mục gdt-xml-extension.',
        'Cài đặt Chrome → Tải xuống: tắt "Hỏi vị trí lưu tệp trước khi tải xuống".',
        'Trên GDT: chọn tab mua vào / bán ra, đặt ngày, bấm Tìm kiếm + nhập captcha → extension tự tải. Không thao tác trên trang khi đang chạy.',
        'File lưu ở Downloads/HoaDonXML/MuaVao|BanRa/YYYY-MM/.',
      ],
    },
    {
      file: 'vietda-xml-import.zip',
      title: 'Tạo phiếu thu/chi tiền gửi trên VietDA từ sao kê',
      icon: 'fa-solid fa-file-import',
      summary: 'Mỗi GD sao kê TPBank → 1 phiếu: Ghi có → Phiếu thu tiền gửi (lý do "Thu tiền bán hàng theo HD <số> ngày <ngày HĐ>" theo Excel Đối soát CK, người mua từ XML bán ra — không MST → KH010 Bán cho người tiêu dùng), Ghi nợ → Phiếu chi tiền gửi (số HĐ + MST người bán theo Excel Đối soát CK). Nộp/rút tiền mặt, chi lương, trả tiền chuyển nhầm nhận theo nội dung CK, tự gõ TK Nợ/Có. Tự mở menu, tự Lưu, bỏ qua GD đã tạo.',
      requires: 'Windows, VietDA đã đăng nhập — không cần cài thêm',
      steps: [
        'Giải nén zip. Mở VietDA, đăng nhập đúng file dữ liệu, không để hộp thoại nào đang mở.',
        'Copy sao kê TPBank (.xlsx) + Excel Đối soát CK (trang Đối soát CK > Xuất Excel, doi-soat-ck_*.xlsx) + danh mục Đối tượng xuất từ VietDA (DANH SACH.xlsx) vào thư mục Input trong thư mục tool (nhiều sao kê được, tool gộp lại).',
        'Copy XML hóa đơn tải từ GDT vào thư mục xml trong thư mục tool: xml/sold = bán ra, xml/purchase = mua vào.',
        'Double-click Nhap-SaoKe-vao-VietDA.bat → xem danh sách → gõ Y + Enter.',
        'Chạy xong tool tự mở thư mục Output/<ngày-giờ>: ket-qua-chay.xlsx (từng GD: Thành công / Lỗi / Bỏ qua + ĐÚNG/SAI so với VietDA; xanh lá = đạt, đỏ = còn lại) + tom-tat.txt.',
        'Trong lúc chạy: KHÔNG đụng chuột/bàn phím (tool gõ phím vào VietDA, mất focus là tự dừng).',
        'Lần đầu nên chạy thêm -Limit 1 để kiểm 1 phiếu trước.',
      ],
    },
  ];
}
