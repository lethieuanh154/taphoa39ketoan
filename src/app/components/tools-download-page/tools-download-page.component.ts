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
      summary: 'Mỗi GD sao kê TPBank → 1 phiếu: Ghi có → Phiếu thu tiền gửi (lý do theo số HĐĐT trong CSV Đối soát CK), Ghi nợ → Phiếu chi tiền gửi (người bán + số HĐ từ XML đầu vào). Tự mở menu, tự Lưu, bỏ qua GD đã tạo.',
      requires: 'Windows, VietDA đã đăng nhập — không cần cài thêm',
      steps: [
        'Giải nén zip. Mở VietDA, đăng nhập đúng file dữ liệu, không để hộp thoại nào đang mở.',
        'Double-click Nhap-SaoKe-vao-VietDA.bat → chọn sao kê .xlsx, CSV Đối soát CK, thư mục XML đầu vào → xem danh sách → gõ Y + Enter.',
        'Trong lúc chạy: KHÔNG đụng chuột/bàn phím (tool gõ phím vào VietDA, mất focus là tự dừng).',
        'Lần đầu nên chạy thêm -Limit 1 để kiểm 1 phiếu trước.',
        'Báo "OCR không thấy menu Thu chi"? Mở VietDA ở màn hình chính, double-click Chan-Doan-OCR-VietDA.bat → gửi lại file VietDA-chan-doan-….zip trên Desktop.',
      ],
    },
  ];
}
