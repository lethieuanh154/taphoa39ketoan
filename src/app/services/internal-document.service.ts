/**
 * Service quản lý Chứng từ nội bộ
 * Hiện tại: Mock data, log console
 * Sau này: Kết nối DB, mapping sang 7 sổ kế toán
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChungTuNoiBo, LoaiChungTu, CHUNG_TU_MAPPING, PhuongThucThanhToan } from '../models/internal-document.models';

@Injectable({
  providedIn: 'root'
})
export class InternalDocumentService {
  private readonly STORAGE_KEY = 'chungtu_noibo';
  private documentsSubject = new BehaviorSubject<ChungTuNoiBo[]>([]);
  public documents$ = this.documentsSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load dữ liệu từ localStorage
   */
  private loadFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const documents = JSON.parse(stored);
        this.documentsSubject.next(documents);
      } catch (error) {
        console.error('Error loading internal documents from storage:', error);
        this.documentsSubject.next([]);
      }
    }
  }

  /**
   * Lưu dữ liệu vào localStorage
   */
  private saveToStorage(documents: ChungTuNoiBo[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
  }

  /**
   * Lấy tất cả chứng từ
   */
  getAllDocuments(): ChungTuNoiBo[] {
    return this.documentsSubject.value;
  }

  /**
   * Thêm chứng từ mới
   * Log các sổ kế toán bị ảnh hưởng
   */
  addDocument(document: ChungTuNoiBo): void {
    // Generate ID
    document.id = this.generateId();

    // Lấy danh sách hiện tại
    const currentDocuments = this.documentsSubject.value;
    const updatedDocuments = [...currentDocuments, document];

    // Lưu vào localStorage
    this.saveToStorage(updatedDocuments);

    // Cập nhật BehaviorSubject
    this.documentsSubject.next(updatedDocuments);

    // Log mapping sổ kế toán
    this.logLedgerMapping(document);

    console.log('✅ Đã lưu chứng từ nội bộ:', document);
  }

  /**
   * Cập nhật chứng từ
   */
  updateDocument(document: ChungTuNoiBo): void {
    const currentDocuments = this.documentsSubject.value;
    const index = currentDocuments.findIndex(d => d.id === document.id);

    if (index !== -1) {
      currentDocuments[index] = document;
      this.saveToStorage(currentDocuments);
      this.documentsSubject.next([...currentDocuments]);
      console.log('✅ Đã cập nhật chứng từ:', document);
    }
  }

  /**
   * Xóa chứng từ
   */
  deleteDocument(id: string): void {
    const currentDocuments = this.documentsSubject.value;
    const updatedDocuments = currentDocuments.filter(d => d.id !== id);

    this.saveToStorage(updatedDocuments);
    this.documentsSubject.next(updatedDocuments);

    console.log('🗑️ Đã xóa chứng từ ID:', id);
  }

  /**
   * Log mapping: Chứng từ → Sổ kế toán bị ảnh hưởng
   */
  private logLedgerMapping(document: ChungTuNoiBo): void {
    const mapping = CHUNG_TU_MAPPING[document.loaiChungTu];

    console.log('\n📋 ========== CHỨNG TỪ NỘI BỘ ==========');
    console.log(`Loại: ${document.loaiChungTu}`);
    console.log(`Ngày: ${document.ngayChungTu}`);
    console.log(`Nội dung: ${document.noiDung}`);
    console.log(`Số tiền: ${document.soTien.toLocaleString('vi-VN')} đ`);
    console.log(`Phương thức: ${document.phuongThucThanhToan}`);

    // Log chi tiết theo loại
    this.logDocumentDetails(document);

    // Log các sổ kế toán bị ảnh hưởng
    console.log('\n📊 SỔ KẾ TOÁN BỊ ẢNH HƯỞNG:');
    console.log(`   → ${mapping.soKeToan.join(', ')}`);
    console.log(`   → ${mapping.dienGiai}`);

    // Gợi ý mapping cụ thể
    this.logSpecificMapping(document);

    console.log('========================================\n');
  }

  /**
   * Log chi tiết chứng từ theo loại
   */
  private logDocumentDetails(document: ChungTuNoiBo): void {
    switch (document.loaiChungTu) {
      case LoaiChungTu.THU_TIEN:
        console.log(`Người nộp tiền: ${document.nguoiNopTien || 'N/A'}`);
        break;

      case LoaiChungTu.CHI_TIEN:
        console.log(`Nhóm chi phí: ${document.nhomChiPhi || 'N/A'}`);
        console.log(`Có hóa đơn: ${document.coHoaDon ? 'Có' : 'Không'}`);
        break;

      case LoaiChungTu.NHAP_HANG:
        console.log(`Nhà cung cấp: ${document.nhaCungCap || 'N/A'}`);
        console.log('Danh sách hàng hóa:');
        document.danhSachHangHoa?.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.tenHangHoa} - SL: ${item.soLuong} - ĐG: ${item.donGia?.toLocaleString('vi-VN')} đ`);
        });
        break;

      case LoaiChungTu.XUAT_HANG:
        console.log(`Lý do xuất: ${document.lyDoXuat || 'N/A'}`);
        console.log('Danh sách hàng hóa:');
        document.danhSachHangHoa?.forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.tenHangHoa} - SL: ${item.soLuong}`);
        });
        break;

      case LoaiChungTu.NOP_THUE:
        console.log(`Loại thuế: ${document.loaiThue || 'N/A'}`);
        console.log(`Kỳ thuế: ${document.kyThue || 'N/A'}`);
        break;
    }

    if (document.ghiChu) {
      console.log(`Ghi chú: ${document.ghiChu}`);
    }
  }

  /**
   * Gợi ý mapping cụ thể vào từng sổ
   */
  private logSpecificMapping(document: ChungTuNoiBo): void {
    console.log('\n💡 GỢI Ý MAPPING CỤ THỂ:');

    switch (document.loaiChungTu) {
      case LoaiChungTu.THU_TIEN:
        if (document.phuongThucThanhToan === PhuongThucThanhToan.TIEN_MAT) {
          console.log(`   → S6 (Sổ quỹ tiền mặt): Thu vào = ${document.soTien.toLocaleString('vi-VN')} đ`);
        } else {
          console.log(`   → S7 (Sổ tiền gửi ngân hàng): Gửi vào = ${document.soTien.toLocaleString('vi-VN')} đ`);
        }
        break;

      case LoaiChungTu.CHI_TIEN:
        console.log(`   → S3 (Sổ chi phí SXKD):`);
        console.log(`      - Tổng số tiền = ${document.soTien.toLocaleString('vi-VN')} đ`);
        console.log(`      - Nhóm chi phí: ${document.nhomChiPhi}`);
        console.log(`   → S6 (Sổ quỹ tiền mặt): Chi ra = ${document.soTien.toLocaleString('vi-VN')} đ`);
        break;

      case LoaiChungTu.NHAP_HANG:
        console.log(`   → S2 (Sổ chi tiết vật liệu):`);
        document.danhSachHangHoa?.forEach(item => {
          console.log(`      - Nhập: ${item.tenHangHoa} - SL: ${item.soLuong} - Thành tiền: ${item.thanhTien?.toLocaleString('vi-VN')} đ`);
        });
        break;

      case LoaiChungTu.XUAT_HANG:
        console.log(`   → S2 (Sổ chi tiết vật liệu):`);
        document.danhSachHangHoa?.forEach(item => {
          console.log(`      - Xuất: ${item.tenHangHoa} - SL: ${item.soLuong}`);
        });
        break;

      case LoaiChungTu.NOP_THUE:
        console.log(`   → S4 (Sổ nghĩa vụ thuế): Số thuế đã nộp = ${document.soTien.toLocaleString('vi-VN')} đ`);
        console.log(`   → S7 (Sổ tiền gửi ngân hàng): Rút ra = ${document.soTien.toLocaleString('vi-VN')} đ`);
        break;
    }
  }

  /**
   * Generate ID đơn giản
   */
  private generateId(): string {
    return `CT${Date.now()}`;
  }
}
