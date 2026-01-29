import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, from, of, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HddtCacheService } from './hddt-cache.service';

const HDDT_TOKEN_KEY = 'hddt_token';

/**
 * Interface cho hóa đơn từ API GDT
 */
export interface HddtInvoice {
  id: string;
  nbmst: string;           // MST người bán
  nbten: string;           // Tên người bán
  nbdchi: string;          // Địa chỉ người bán
  nmmst: string;           // MST người mua
  nmten: string;           // Tên người mua
  nmdchi: string;          // Địa chỉ người mua
  khmshdon: number;        // Ký hiệu mẫu số hóa đơn
  khhdon: string;          // Ký hiệu hóa đơn
  shdon: number;           // Số hóa đơn
  tdlap: string;           // Thời điểm lập (ISO date)
  tgtcthue: number;        // Tổng giá trị chưa thuế
  tgtthue: number;         // Tổng giá trị thuế
  tgtttbso: number;        // Tổng giá trị thanh toán bằng số
  tgtttbchu: string;       // Tổng giá trị thanh toán bằng chữ
  tthai: number;           // Trạng thái hóa đơn (1: hoạt động, 3: điều chỉnh, 5: thay thế)
  ttxly: number;           // Trạng thái xử lý
  thdon: string;           // Tên hóa đơn
  dvtte: string;           // Đơn vị tiền tệ
  thtttoan: string;        // Hình thức thanh toán
  tchat: number;           // Tính chất (1: gốc, 3: điều chỉnh)
  thttltsuat: VatRateInfo[]; // Thông tin thuế suất
  // Thêm các field khác nếu cần
  [key: string]: unknown;
}

export interface VatRateInfo {
  tsuat: string;           // Thuế suất (VD: "8%", "10%")
  thtien: number;          // Thành tiền
  tthue: number;           // Tiền thuế
  gttsuat: string | null;  // Ghi chú thuế suất
}

export interface HddtApiResponse {
  datas: HddtInvoice[];
  state?: string;
  total?: number;
}

export interface HddtSearchParams {
  fromDate: string;        // Format: dd/MM/yyyy
  toDate: string;          // Format: dd/MM/yyyy
  size?: number;
  sort?: string;
  ttxly?: number;          // Trạng thái xử lý (5 = đã xử lý)
}

@Injectable({
  providedIn: 'root'
})
export class HddtService {
  private readonly apiBase = `${environment.domainUrl}/api/hddt`;

  constructor(
    private http: HttpClient,
    private cacheService: HddtCacheService
  ) {}

  /**
   * Lấy token từ session storage
   */
  getToken(): string | null {
    return sessionStorage.getItem(HDDT_TOKEN_KEY);
  }

  /**
   * Kiểm tra token có tồn tại không
   */
  hasToken(): boolean {
    return !!this.getToken();
  }

  /**
   * Tạo headers với token
   */
  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    if (!token) {
      throw new Error('HDDT Token không tồn tại. Vui lòng đăng nhập lại.');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Build search query string
   */
  private buildSearchQuery(params: HddtSearchParams): string {
    const { fromDate, toDate, ttxly = 5 } = params;
    // Format: tdlap=ge=30/12/2025T00:00:00;tdlap=le=29/01/2026T23:59:59;ttxly==5
    return `tdlap=ge=${fromDate}T00:00:00;tdlap=le=${toDate}T23:59:59;ttxly==${ttxly}`;
  }

  /**
   * API 1: Lấy hóa đơn mua vào (purchase)
   * Gọi qua proxy: GET /api/hddt/purchase
   */
  getPurchaseInvoices(params: HddtSearchParams): Observable<HddtApiResponse> {
    if (!this.hasToken()) {
      return throwError(() => new Error('HDDT Token không tồn tại'));
    }

    const { size = 50, sort = 'tdlap:desc' } = params;
    const search = this.buildSearchQuery(params);

    const httpParams = new HttpParams()
      .set('sort', sort)
      .set('size', size.toString())
      .set('search', search);

    return this.http.get<HddtApiResponse>(`${this.apiBase}/purchase`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      catchError(error => {
        console.error('Error fetching purchase invoices:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * API 2: Lấy hóa đơn mua vào từ máy tính tiền (SCO)
   * Gọi qua proxy: GET /api/hddt/purchase-sco
   * ttxly==8: Hóa đơn khởi tạo từ máy tính tiền
   */
  getPurchaseInvoicesSco(params: HddtSearchParams): Observable<HddtApiResponse> {
    if (!this.hasToken()) {
      return throwError(() => new Error('HDDT Token không tồn tại'));
    }

    const { size = 50, sort = 'tdlap:desc' } = params;
    // SCO API dùng ttxly==8
    const scoParams = { ...params, ttxly: 8 };
    const search = this.buildSearchQuery(scoParams);

    const httpParams = new HttpParams()
      .set('sort', sort)
      .set('size', size.toString())
      .set('search', search);

    return this.http.get<HddtApiResponse>(`${this.apiBase}/purchase-sco`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      catchError(error => {
        console.error('Error fetching purchase-sco invoices:', error);
        // Trả về mảng rỗng nếu lỗi
        return of({ datas: [] });
      })
    );
  }

  /**
   * Lấy tất cả hóa đơn mua vào (gộp cả 2 API: purchase + sco)
   * - purchase: Hóa đơn điện tử thông thường (ttxly==5)
   * - purchase-sco: Hóa đơn từ máy tính tiền (ttxly==8)
   */
  getAllPurchaseInvoices(params: HddtSearchParams): Observable<HddtInvoice[]> {
    return forkJoin({
      purchase: this.getPurchaseInvoices(params),
      purchaseSco: this.getPurchaseInvoicesSco(params)
    }).pipe(
      map(results => {
        const allInvoices = [
          ...(results.purchase.datas || []),
          ...(results.purchaseSco.datas || [])
        ];
        // Loại bỏ trùng lặp theo id
        const uniqueMap = new Map<string, HddtInvoice>();
        allInvoices.forEach(inv => {
          if (!uniqueMap.has(inv.id)) {
            uniqueMap.set(inv.id, inv);
          }
        });
        // Sắp xếp theo ngày lập giảm dần
        return Array.from(uniqueMap.values()).sort((a, b) => {
          return new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime();
        });
      }),
      catchError(error => {
        console.error('Error fetching all purchase invoices:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Format ngày từ Date sang dd/MM/yyyy
   */
  formatDateForApi(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Lấy hóa đơn mua vào trong khoảng thời gian (mặc định 30 ngày gần nhất)
   * Ưu tiên lấy từ cache, nếu không có mới gọi API
   */
  getPurchaseInvoicesInRange(fromDate?: Date, toDate?: Date, forceRefresh = false): Observable<HddtInvoice[]> {
    const to = toDate || new Date();
    const fromD = fromDate || new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDateStr = this.formatDateForApi(fromD);
    const toDateStr = this.formatDateForApi(to);

    // Nếu force refresh, gọi API trực tiếp
    if (forceRefresh) {
      return this.fetchAndCacheInvoices(fromDateStr, toDateStr);
    }

    // Kiểm tra cache trước
    return from(this.cacheService.isCacheValid()).pipe(
      switchMap(isValid => {
        if (isValid) {
          // Lấy từ cache
          return from(this.cacheService.getInvoicesByDateRange(fromDateStr, toDateStr)).pipe(
            switchMap(cachedInvoices => {
              if (cachedInvoices.length > 0) {
                console.log(`Lấy ${cachedInvoices.length} hóa đơn từ cache`);
                return of(cachedInvoices);
              }
              // Cache rỗng, gọi API
              return this.fetchAndCacheInvoices(fromDateStr, toDateStr);
            })
          );
        }
        // Cache không hợp lệ, gọi API
        return this.fetchAndCacheInvoices(fromDateStr, toDateStr);
      })
    );
  }

  /**
   * Gọi API và lưu vào cache
   */
  private fetchAndCacheInvoices(fromDate: string, toDate: string): Observable<HddtInvoice[]> {
    return this.getAllPurchaseInvoices({
      fromDate,
      toDate,
      size: 50
    }).pipe(
      tap(invoices => {
        // Lưu vào cache
        this.cacheService.saveInvoices(invoices, fromDate, toDate);
      })
    );
  }

  /**
   * Tìm kiếm hóa đơn trong cache
   */
  searchInvoicesInCache(query: string): Observable<HddtInvoice[]> {
    return from(this.cacheService.searchInvoices(query));
  }

  /**
   * Xóa cache và tải lại dữ liệu
   */
  refreshCache(fromDate?: Date, toDate?: Date): Observable<HddtInvoice[]> {
    return from(this.cacheService.clearCache()).pipe(
      switchMap(() => this.getPurchaseInvoicesInRange(fromDate, toDate, true))
    );
  }

  /**
   * Lấy thông tin cache
   */
  getCacheInfo(): Observable<{ count: number; lastUpdated: number | null }> {
    return from(Promise.all([
      this.cacheService.getInvoiceCount(),
      this.cacheService.getMetadata()
    ])).pipe(
      map(([count, metadata]) => ({
        count,
        lastUpdated: metadata?.lastUpdated || null
      }))
    );
  }

  /**
   * Helper: Lấy ký hiệu hóa đơn đầy đủ
   */
  getInvoiceSymbol(invoice: HddtInvoice): string {
    return `${invoice.khmshdon}${invoice.khhdon}`;
  }

  /**
   * Helper: Format số hóa đơn
   */
  formatInvoiceNumber(invoice: HddtInvoice): string {
    return invoice.shdon.toString().padStart(8, '0');
  }

  /**
   * Helper: Lấy trạng thái hóa đơn
   * tthai: 1=Mới, 2=Thay thế, 3=Điều chỉnh, 4=Đã bị thay thế, 5=Đã bị điều chỉnh, 6=Đã hủy
   */
  getInvoiceStatus(invoice: HddtInvoice): string {
    switch (invoice.tthai) {
      case 1: return 'Hóa đơn mới';
      case 2: return 'Hóa đơn thay thế';
      case 3: return 'Hóa đơn điều chỉnh';
      case 4: return 'Đã bị thay thế';
      case 5: return 'Đã bị điều chỉnh';
      case 6: return 'Đã bị hủy';
      default: return 'Không xác định';
    }
  }

  /**
   * Helper: Lấy tính chất hóa đơn
   */
  getInvoiceNature(invoice: HddtInvoice): string {
    switch (invoice.tchat) {
      case 1: return 'Hóa đơn gốc';
      case 3: return 'Hóa đơn điều chỉnh';
      default: return '';
    }
  }
}
