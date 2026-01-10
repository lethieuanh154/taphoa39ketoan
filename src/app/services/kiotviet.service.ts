import { Injectable } from '@angular/core';
import { environment } from "../../environments/environment";
import { InvoiceTab } from '../models/invoice.model';
import { IndexedDBService } from './indexed-db.service'; // Thêm import này
import { CategoryService } from './category.service';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';

interface KiotVietAuthResponse {
  access_token: string;
  retailer: number;
  LatestBranchId: string;
}

// ========= Checkout Invoice Interfaces =========
interface KVSeller {
  CreatedBy: number;
  CreatedDate: string;
  Email: string;
  GivenName: string;
  Id: number;
  IsActive: boolean;
  IsAdmin: boolean;
  Language: string;
  MobilePhone: string;
  Type: number;
  UserName: string;
  isDeleted: boolean;
}

interface InvoiceDetailItem {
  BasePrice: number;
  IsLotSerialControl: boolean;
  IsBatchExpireControl: boolean;
  IsRewardPoint: boolean;
  Note: string;
  Price: number;
  ProductId: number;
  Quantity: number;
  ProductCode: string;
  Weight: number;
  ProductName: string;
  OriginPrice: number;
  ProductFormulaHistoryId: number | null;
  ProductBatchExpireId: number | null;
  CategoryId: number | null;
  MasterProductId: number;
  Unit: string;
  Uuid: string;
  Formulas: any | null;
  AllocationDiscount: number;
  InvoiceDetailTaxs: any[];
}

interface InvoicePayment {
  Method: string;
  MethodStr: string;
  Amount: number;
  Id: number;
  AccountId: number | null;
  UsePoint?: number | null;
}

interface CheckoutInvoicePayload {
  Invoice: {
    BranchId: number;
    RetailerId: number;
    UpdateInvoiceId: number;
    UpdateReturnId: number;
    SoldById: number;
    SoldBy: KVSeller;
    SaleChannelId: number;
    Seller: KVSeller;
    OrderCode: string;
    Code: string;
    DiscountByPromotion: number;
    DiscountByPromotionValue: number;
    DiscountByPromotionRatio: number;
    InvoiceDetails: InvoiceDetailItem[];
    InvoiceOrderSurcharges: any[];
    InvoicePromotions: any[];
    InvoiceSupplierPromotions: any[];
    UsingCod: number;
    Payments: InvoicePayment[];
    Status: number;
    Total: number;
    TotalTax: number | null;
    EnableVATToggle: boolean;
    RoundAmount: number | null;
    Surcharge: number;
    Type: number;
    Uuid: string;
    addToAccount: string;
    PayingAmount: number;
    TotalBeforeDiscount: number;
    ProductDiscount: number;
    DebugUuid: string;
    InvoiceWarranties: any[];
    IsUsingProductVAT: boolean;
    CreatedBy: number;
  };
}
@Injectable({
  providedIn: 'root'
})
export class KiotvietService {

  constructor(
    private indexedDBService: IndexedDBService,
    private categoryService: CategoryService,
    private http: HttpClient
  ) { }
  private readonly updateItemUrl = 'https://api-man1.kiotviet.vn/api';
  private readonly getUpdateItemUrl = 'https://api-man1.kiotviet.vn/api/products';
  private readonly trademarkUrl = 'https://api-man1.kiotviet.vn/api/trademark';
  private readonly checkOutURL = 'https://api-sale1.kiotviet.vn/api/invoices';

  private retailerId = 500111210;
  private retailer: any | null = null;// Replace with your retailer
  private LatestBranchId: any | null = null; // Replace with your branch ID
  private accessToken: string | null = null;

  kiotviet_items_api = "/api/kiotviet/items/all";
  kiotviet_customers_api = "/api/kiotviet/customers";
  kiotviet_item_outofstock_api = "/api/kiotviet/items/out_of_stock";
  kiotviet_categories_api = "/api/kiotviet/categories";


  async getOutOfStockItems(params?: any): Promise<any> {
    return await this.http.get(`${environment.domainUrl}${this.kiotviet_item_outofstock_api}`, { params }).toPromise();
  }

  async getCategories(): Promise<any[]> {
    try {
      console.log('🔍 [getCategories] Bắt đầu kiểm tra cache...');

      // Kiểm tra xem có categories trong IndexedDB không
      const hasCategories = await this.categoryService.hasCategories();
      console.log(`🔍 [getCategories] hasCategories = ${hasCategories}`);

      if (hasCategories) {
        // Kiểm tra cache có còn hợp lệ không (theo TTL)
        const isCacheValid = await this.categoryService.isCacheValid();
        console.log(`🔍 [getCategories] isCacheValid = ${isCacheValid}`);

        if (isCacheValid) {
          // Cache còn hợp lệ, dùng luôn không cần fetch API
          console.log('📦 Lấy categories từ IndexedDB (cache còn hợp lệ) ✅');
          return await this.categoryService.getAllCategories();
        } else {
          // Cache hết hạn, fetch API và update cache
          console.log('🔄 Cache hết hạn, đang làm mới từ API...');
          const cachedCategories = await this.categoryService.getAllCategories();
          // Fetch API trong background để update cache
          this.fetchAndCacheCategories().catch(err =>
            console.warn('⚠️ Không thể cập nhật categories cache:', err)
          );
          // Trả về cache cũ ngay để không làm chậm UI
          return cachedCategories;
        }
      }

      // Nếu chưa có cache, fetch từ API
      console.log('🌐 Lấy categories từ API (lần đầu)');
      return await this.fetchAndCacheCategories();
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      // Fallback: thử lấy từ cache nếu API fail
      try {
        const cachedCategories = await this.categoryService.getAllCategories();
        if (cachedCategories.length > 0) {
          console.log('✅ Sử dụng categories từ cache (fallback)');
          return cachedCategories;
        }
      } catch (cacheError) {
        console.error('❌ Không thể lấy categories từ cache:', cacheError);
      }
      return [];
    }
  }

  /**
   * Fetch categories từ API và lưu vào IndexedDB
   */
  private async fetchAndCacheCategories(): Promise<any[]> {
    try {
      const result = await this.http.get<any[]>(
        `${environment.domainUrl}${this.kiotviet_categories_api}`
      ).toPromise();

      const categories = result || [];

      if (categories.length > 0) {
        // Lưu vào IndexedDB
        await this.categoryService.saveCategories(categories);
        console.log(`✅ Đã lưu ${categories.length} categories vào IndexedDB`);
      }

      return categories;
    } catch (error) {
      console.error('❌ Error fetching and caching categories:', error);
      throw error;
    }
  }

  /**
   * Force refresh categories từ API và cập nhật cache
   */
  async refreshCategories(): Promise<any[]> {
    console.log('🔄 Làm mới categories từ API...');
    return await this.fetchAndCacheCategories();
  }

  // ========= Auth helpers & unified retry-on-401/403 =========
  private loadStoredCredentials(): boolean {
    const storedToken = localStorage.getItem('kv_access_token');
    const storedRetailer = localStorage.getItem('kv_retailer');
    const storedBranchId = localStorage.getItem('kv_branch_id');
    if (storedToken && storedRetailer && storedBranchId) {
      this.accessToken = storedToken;
      this.retailer = storedRetailer;
      this.LatestBranchId = storedBranchId;
      return true;
    }
    return false;
  }

  // Run a KiotViet fetch, and if unauthorized (401/403), attempt to get token again then retry ONCE
  private async performKiotVietFetchWithRetry<T>(
    makeRequest: (token: string) => Promise<Response>,
    parseJson: boolean = true
  ): Promise<T> {
    // Ensure we have creds in memory; avoid calling getAccessToken unless needed
    if (!this.accessToken || !this.retailer || !this.LatestBranchId) {
      this.loadStoredCredentials();
    }
    const token1 = this.accessToken || '';

    let res = await makeRequest(token1);
    if (res.status === 401 || res.status === 403) {
      // token might be expired — try to get token again (only now)
      try {
        const newToken = await this.getAccessToken();
        res = await makeRequest(newToken);
      } catch (reAuthErr) {
        // Propagate a clear error for UI to handle (e.g., prompt re-login)
        throw new Error(`KIOTVIET_TOKEN_EXPIRED: ${res.status} ${res.statusText}`);
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);
    }

    return (parseJson ? (await res.json()) : (await (res as any))) as T;
  }
  private async getAccessToken(): Promise<string> {
    // Ưu tiên lấy từ localStorage nếu đã đăng nhập
    const storedToken = localStorage.getItem('kv_access_token');
    const storedRetailer = localStorage.getItem('kv_retailer');
    const storedBranchId = localStorage.getItem('kv_branch_id');

    if (storedToken && storedRetailer && storedBranchId) {
      // Kiểm tra token có expired không
      if (this.isTokenExpired(storedToken)) {
        console.log('Token đã hết hạn, yêu cầu đăng nhập lại');
        this.clearStoredCredentials();
        throw new Error('Token đã hết hạn. Vui lòng đăng nhập lại.');
      }

      this.accessToken = storedToken;
      this.retailer = storedRetailer;
      this.LatestBranchId = storedBranchId;
      return this.accessToken;
    }

    // Nếu chưa có, yêu cầu đăng nhập lại
    throw new Error('Chưa đăng nhập KiotViet. Vui lòng đăng nhập lại.');
  }

  private isTokenExpired(token: string): boolean {
    try {
      // JWT token có 3 phần, phần thứ 2 là payload
      const payload = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payload));

      // Kiểm tra thời gian hết hạn (exp)
      if (decodedPayload.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime >= decodedPayload.exp;
      }

      // Nếu không có exp, kiểm tra thời gian tạo token (iat) + thời gian sống ước tính
      if (decodedPayload.iat) {
        const currentTime = Math.floor(Date.now() / 1000);
        const estimatedExpiry = decodedPayload.iat + (24 * 60 * 60); // Ước tính 24 giờ
        return currentTime >= estimatedExpiry;
      }

      // Nếu không có thông tin thời gian, coi như không expired
      return false;
    } catch (error) {
      console.error('Lỗi khi kiểm tra token expired:', error);
      // Nếu không parse được token, coi như expired để đảm bảo an toàn
      return true;
    }
  }

  private clearStoredCredentials(): void {
    localStorage.removeItem('kv_access_token');
    localStorage.removeItem('kv_retailer');
    localStorage.removeItem('kv_branch_id');
    this.accessToken = null;
    this.retailer = null;
    this.LatestBranchId = null;
  }

  async getRequestBody(Id: number) {
    try {
      const url = `${this.getUpdateItemUrl}/${Id}/initialdata?Includes=ProductAttributes&ProductType=2`;
      const data = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any,
          }
        });
      });
      return data;
    } catch (error) {
      console.error('Error getting product', error);
      throw error;
    }
  }
  async updateProductToKiotviet(formDataGetFromKiotViet: any): Promise<any> {
    const fD = new FormData();
    fD.append("product", JSON.stringify(formDataGetFromKiotViet.Product))
    fD.append("BranchForProductCostss", `[{ "Id": ${this.LatestBranchId}, "Name": "Chi nhánh trung tâm" }]`)
    fD.append("ListUnitPriceBookDetail", "[]")
    try {
      const url = `${this.updateItemUrl}/products/photo`;
      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: fD
        });
      });
      return result;
    } catch (error) {
      console.error('Error sending product data:', error);
      throw error;
    }
  }

  async updateOnHandFromInvoiceToKiotviet(
    invoice: InvoiceTab,
    groupedProducts: { [x: string]: any;[x: number]: any[]; },
    operation: 'decrease' | 'increase' = 'decrease'
  ): Promise<any> {
    const results: { productId: any; result?: any; error?: any; skipped?: boolean }[] = [];

    for (const cartItem of invoice.cartItems) {
      // Skip NV products (OnHandNV > 0 và OnHand = 0) - không gọi KiotViet API
      const onHand = cartItem.product?.OnHand ?? 0;
      const onHandNV = cartItem.product?.OnHandNV ?? 0;
      if (onHandNV > 0 && onHand === 0) {
        console.log(`⏭️ Bỏ qua sản phẩm NV (${cartItem.product?.Name}) - không cập nhật KiotViet`);
        results.push({ productId: cartItem.product?.Id, skipped: true });
        continue;
      }

      const masterUnitId = cartItem.product.MasterUnitId || cartItem.product.Id;
      const group = groupedProducts[masterUnitId];
      const masterItem = group?.find(item => item.MasterUnitId == null);

      if (!masterItem) {
        console.warn('⚠️ Không tìm thấy master item để cập nhật tồn kho KiotViet cho sản phẩm', cartItem?.product?.Id);
        continue;
      }

      const formDataGetFromKiotViet = await this.getRequestBody(masterItem.Id)
      const conversion = Number(cartItem.product?.ConversionValue) || 1;
      const delta = Number(cartItem.quantity ?? 0) * conversion;
      if (operation === 'decrease') {
        formDataGetFromKiotViet.Product.OnHand = formDataGetFromKiotViet.Product.OnHand - delta;
      } else {
        formDataGetFromKiotViet.Product.OnHand = formDataGetFromKiotViet.Product.OnHand + delta;
      }
      await this.updateProductToKiotviet(formDataGetFromKiotViet)
        .then(result => {
          results.push({ productId: masterItem.Id, result });
        })
        .catch(error => {
          console.error(`Error updating product ${masterItem.Id}:`, error);
          results.push({ productId: masterItem.Id, error: error.message });
        });
    }

    return results; // Return tất cả kết quả sau khi hoàn thành vòng lặp
  }

  async addCustomer(customerData: any): Promise<any> {
    const payload = {
      Customer: {
        BranchId: Number(this.LatestBranchId),
        IsActive: true,
        Uuid: crypto.randomUUID(),
        Type: 0,
        temploc: "",
        tempw: "",
        EmployeeInChargeIds: [],
        Name: customerData.name,
        Organization: customerData.organization || "",
        ContactNumber: customerData.phone,
        Gender: customerData.gender === 'Nam' ? 1 : (customerData.gender === 'Nữ' ? 0 : null),
        BirthDate: customerData.birthDate ? new Date(customerData.birthDate).toISOString() : null,
        TaxCode: customerData.taxCode,
        IdentificationNumber: customerData.idCard,
        Email: customerData.email,
        Facebook: customerData.facebook,
        Comments: customerData.notes,
        LocationName: "",
        AdministrativeAreaId: null,
        WardName: "",
        CustomerGroupDetails: [],
        RetailerId: this.retailerId
      },
      isMergedSupplier: false,
      isCreateNewSupplier: false,
      MergedSupplierId: 0,
      SkipValidateEmail: false,
    };

    try {
      const url = `https://api-man1.kiotviet.vn/api/customers`;
      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: JSON.stringify(payload)
        });
      });
      return result;
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }
  async syncProductFromKiotvietToFirebase(data: any): Promise<void> {
    (await this.http.post(`${environment.domainUrl}/api/sync/kiotviet/firebase/products`, data)
      .pipe(
        catchError((err) => {
          console.error('❌ Lỗi khi tải tất cả sản phẩm:', err);
          return of([]);
        })
      ).toPromise()) ?? [];
  }

  async syncCustomerFromKiotvietToFirebase(data: any): Promise<void> {
    // Lấy dữ liệu từ API
    (await this.http.put(`${environment.domainUrl}/api/sync/kiotviet/firebase/customers`, data)
      .pipe(
        catchError((err) => {
          console.error('❌ Lỗi khi tải tất cả khách hàng:', err);
          return of([]);
        })
      ).toPromise()) ?? [];
  }

  // ========= Trademark API =========

  /**
   * Lấy danh sách thương hiệu từ KiotViet
   */
  async getTrademarks(): Promise<any[]> {
    try {
      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(this.trademarkUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          }
        });
      });
      return result?.Data || [];
    } catch (error) {
      console.error('Error getting trademarks:', error);
      throw error;
    }
  }

  /**
   * Tạo thương hiệu mới trên KiotViet
   * @param name Tên thương hiệu
   */
  async createTrademark(name: string): Promise<any> {
    const payload = {
      TradeMark: {
        Name: name,
        CompareName: ""
      }
    };

    try {
      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(this.trademarkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: JSON.stringify(payload)
        });
      });
      return result;
    } catch (error) {
      console.error('Error creating trademark:', error);
      throw error;
    }
  }

  // ========= Checkout Invoice API =========

  /**
   * Tạo hóa đơn checkout trên KiotViet
   * @param invoice InvoiceTab từ cart
   * @param sellerInfo Thông tin nhân viên bán hàng (từ KiotViet)
   * @param paymentMethod Phương thức thanh toán ('Cash', 'Card', 'Transfer')
   */
  async checkoutToKiotViet(
    invoice: InvoiceTab,
    sellerInfo: KVSeller,
    paymentMethod: 'Cash' | 'Card' | 'Transfer' = 'Cash'
  ): Promise<any> {
    // Tính tổng tiền và tạo invoice details
    const invoiceDetails: InvoiceDetailItem[] = [];
    let total = 0;

    for (const cartItem of invoice.cartItems) {
      // Skip NV products (không gửi lên KiotViet)
      const onHand = cartItem.product?.OnHand ?? 0;
      const onHandNV = cartItem.product?.OnHandNV ?? 0;
      if (onHandNV > 0 && onHand === 0) {
        console.log(`⏭️ Bỏ qua sản phẩm NV (${cartItem.product?.Name}) trong checkout KiotViet`);
        continue;
      }

      // Sử dụng unitPrice (giá đã được user sửa) thay vì BasePrice gốc
      const price = cartItem.unitPrice ?? cartItem.product?.BasePrice ?? 0;
      const basePrice = cartItem.product?.BasePrice ?? 0;
      const quantity = cartItem.quantity || 0;
      const itemTotal = price * quantity;
      total += itemTotal;

      const productId = cartItem.product?.Id || 0;
      // MasterProductId: nếu là master thì bằng chính Id, nếu là child thì bằng MasterUnitId
      const masterProductId = cartItem.product?.MasterUnitId || productId;

      invoiceDetails.push({
        BasePrice: basePrice,  // Giá gốc từ product
        IsLotSerialControl: false,
        IsBatchExpireControl: false,
        IsRewardPoint: cartItem.product?.IsRewardPoint || true,
        Note: '',
        Price: price,          // Giá thực tế (đã được user sửa)
        ProductId: productId,
        Quantity: quantity,
        ProductCode: cartItem.product?.Code || '',
        Weight: 0,
        ProductName: cartItem.product?.Name || '',
        OriginPrice: basePrice, // Giá gốc từ product
        ProductFormulaHistoryId: null,
        ProductBatchExpireId: null,
        CategoryId: cartItem.product?.CategoryId || null,
        MasterProductId: masterProductId,
        Unit: cartItem.product?.Unit || '',
        Uuid: `WN${crypto.randomUUID()}`,
        Formulas: null,
        AllocationDiscount: 0,
        InvoiceDetailTaxs: []
      });
    }

    // Nếu không có sản phẩm KV nào để checkout
    if (invoiceDetails.length === 0) {
      console.log('⚠️ Không có sản phẩm KiotViet để checkout');
      return { skipped: true, message: 'Không có sản phẩm KiotViet để checkout' };
    }

    // Tính discount tổng hóa đơn
    const invoiceDiscount = invoice.discountAmount || 0;
    const totalPayment = total - invoiceDiscount;

    // Map payment method
    const paymentMethodMap: Record<string, { method: string; methodStr: string }> = {
      'Cash': { method: 'Cash', methodStr: 'Tiền mặt' },
      'Card': { method: 'Card', methodStr: 'Thẻ' },
      'Transfer': { method: 'Transfer', methodStr: 'Chuyển khoản' }
    };

    const payment = paymentMethodMap[paymentMethod] || paymentMethodMap['Cash'];

    const invoiceUuid = `WN${crypto.randomUUID()}`;

    const payload: CheckoutInvoicePayload = {
      Invoice: {
        BranchId: Number(this.LatestBranchId),
        RetailerId: this.retailerId,
        UpdateInvoiceId: 0,
        UpdateReturnId: 0,
        SoldById: sellerInfo.Id,
        SoldBy: sellerInfo,
        SaleChannelId: 0,
        Seller: sellerInfo,
        OrderCode: '',
        Code: invoice.name || 'Hóa đơn 1',
        DiscountByPromotion: 0,
        DiscountByPromotionValue: 0,
        DiscountByPromotionRatio: 0,
        InvoiceDetails: invoiceDetails,
        InvoiceOrderSurcharges: [],
        InvoicePromotions: [],
        InvoiceSupplierPromotions: [],
        UsingCod: 0,
        Payments: [{
          Method: payment.method,
          MethodStr: payment.methodStr,
          Amount: totalPayment,
          Id: -1,
          AccountId: null,
          UsePoint: null
        }],
        Status: 1,
        Total: total,
        TotalTax: null,
        EnableVATToggle: true,
        RoundAmount: null,
        Surcharge: 0,
        Type: 1,
        Uuid: invoiceUuid,
        addToAccount: '0',
        PayingAmount: totalPayment,
        TotalBeforeDiscount: total,
        ProductDiscount: invoiceDiscount,
        DebugUuid: invoiceUuid,
        InvoiceWarranties: [],
        IsUsingProductVAT: false,
        CreatedBy: sellerInfo.Id
      }
    };

    try {
      console.log('📤 Đang gửi checkout đến KiotViet...', payload);

      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(this.checkOutURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: JSON.stringify(payload)
        });
      });

      console.log('✅ Checkout KiotViet thành công:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checkout to KiotViet:', error);
      throw error;
    }
  }

  /**
   * Tạo hóa đơn checkout với payload tùy chỉnh
   * @param customPayload Payload tùy chỉnh theo format KiotViet
   */
  async checkoutToKiotVietWithCustomPayload(customPayload: CheckoutInvoicePayload): Promise<any> {
    try {
      console.log('📤 Đang gửi custom checkout đến KiotViet...', customPayload);

      const result = await this.performKiotVietFetchWithRetry<any>(async (token) => {
        return await fetch(this.checkOutURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: JSON.stringify(customPayload)
        });
      });

      console.log('✅ Custom checkout KiotViet thành công:', result);
      return result;
    } catch (error) {
      console.error('❌ Error custom checkout to KiotViet:', error);
      throw error;
    }
  }

  /**
   * Lấy default seller info cho checkout
   * Sử dụng khi không có thông tin seller từ bên ngoài
   */
  getDefaultSellerInfo(): KVSeller {
    return {
      CreatedBy: 0,
      CreatedDate: new Date().toISOString(),
      Email: '',
      GivenName: 'Nhân viên',
      Id: 979657, // Default admin ID
      IsActive: true,
      IsAdmin: true,
      Language: 'vi-VN',
      MobilePhone: '',
      Type: 0,
      UserName: 'admin',
      isDeleted: false
    };
  }

  // ========= Invoice API (for Ledger 9) =========

  /**
   * Lấy danh sách hóa đơn từ KiotViet theo khoảng thời gian
   * @param fromDate Ngày bắt đầu (yyyy-mm-dd)
   * @param toDate Ngày kết thúc (yyyy-mm-dd)
   */
  async getInvoices(fromDate: string, toDate: string): Promise<KiotVietInvoice[]> {
    const url = 'https://api-man1.kiotviet.vn/api/invoices/list';

    // Calculate next day for toDate to include the entire day
    const toDateObj = new Date(toDate);
    toDateObj.setDate(toDateObj.getDate() + 1);
    const toDateNext = toDateObj.toISOString().split('T')[0];

    // Format dates for display
    const fromDateParts = fromDate.split('-');
    const toDateParts = toDate.split('-');
    const fromDateStr = `${fromDateParts[2]}/${fromDateParts[1]}/${fromDateParts[0]} 00:00:00`;
    const toDateStr = `${toDateParts[2]}/${toDateParts[1]}/${toDateParts[0]} 23:59:59`;

    const payload = {
      "$inlinecount": "allpages",
      "$format": "json",
      "ExpectedDeliveryFilterType": "alltime",
      "FiltersForOrm": JSON.stringify({
        "BranchIds": [878979],
        "PriceBookIds": [],
        "FromDate": `${fromDate}T17:00:00.000Z`,
        "ToDate": `${toDateNext}T16:59:59.000Z`,
        "FromDateStr": fromDateStr,
        "ToDateStr": toDateStr,
        "TimeRange": "other",
        "InvoiceStatus": [1],
        "UsingCod": [0],
        "TableIds": [],
        "SalechannelIds": [],
        "StartDeliveryDate": null,
        "EndDeliveryDate": null,
        "StartDeliveryDateStr": null,
        "EndDeliveryDateStr": null,
        "UsingPrescription": 2,
        "EInvoiceStatus": []
      }),
      "InvoiceStatus": "[1]",
      "$top": 20000,
      "$filter": `((PurchaseDate ge datetime'${fromDate}T00:00:00' and PurchaseDate lt datetime'${toDateNext}T00:00:00') and (UsingCod eq 0 or UsingCod eq null))`
    };

    try {
      const result = await this.performKiotVietFetchWithRetry<{ Data: any[] }>(async (token) => {
        return await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'Retailer': this.retailer as any,
            'BranchId': this.LatestBranchId as any
          },
          body: JSON.stringify(payload)
        });
      });

      // Skip first item (usually metadata) and return the rest
      const data = result?.Data || [];
      return data.slice(1) as KiotVietInvoice[];
    } catch (error) {
      console.error('Error getting invoices from KiotViet:', error);
      throw error;
    }
  }
}

// ========= KiotViet Invoice Interface =========
export interface KiotVietInvoice {
  Id: number;
  PurchaseDate: string;
  CreatedDate: string;
  CreatedBy: number;
  RetailerId: number;
  Code: string;
  Status: number;
  BranchId: number;
  SoldById: number;
  Total: number;
  TotalPayment: number;
  Debt: number;
  Surcharge: number;
  Uuid: string;
  CustomerName: string;
  CustomerCode: string;
  CustomerContactNumber: string;
  CustomerAddress: string;
  StatusValue: string;
  SubTotal: number;
  PaidAmount: number;
}
