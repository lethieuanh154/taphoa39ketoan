import { Injectable } from '@angular/core';
import { HddtInvoice, HddtInvoiceDetail, HddtSoldInvoice } from './hddt.service';

const DB_NAME = 'TapHoa39HddtDB';
const DB_VERSION = 4;  // Tăng version để thêm sold_invoices store
const STORE_INVOICES = 'purchase_invoices';
const STORE_INVOICE_DETAILS = 'invoice_details';
const STORE_SOLD_INVOICES = 'sold_invoices';
const STORE_SOLD_INVOICE_DETAILS = 'sold_invoice_details';
const STORE_METADATA = 'metadata';

export interface CacheMetadata {
  key: string;
  lastUpdated: number;  // timestamp
  fromDate: string;     // dd/MM/yyyy
  toDate: string;       // dd/MM/yyyy
}

@Injectable({
  providedIn: 'root'
})
export class HddtCacheService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;

  constructor() {
    this.dbReady = this.initDB();
  }

  /**
   * Khởi tạo IndexedDB
   */
  private initDB(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB không được hỗ trợ');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Không thể mở IndexedDB:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;

        // Kiểm tra xem tất cả store cần thiết đã tồn tại chưa
        const requiredStores = [
          STORE_INVOICES,
          STORE_INVOICE_DETAILS,
          STORE_SOLD_INVOICES,
          STORE_SOLD_INVOICE_DETAILS,
          STORE_METADATA
        ];
        const missingStores = requiredStores.filter(
          store => !this.db!.objectStoreNames.contains(store)
        );

        if (missingStores.length > 0) {
          console.warn('Thiếu object stores:', missingStores);
          // Đóng và xóa database để tạo lại
          this.db.close();
          this.db = null;
          indexedDB.deleteDatabase(DB_NAME);
          console.log('Đã xóa database cũ, reload trang để tạo lại...');
          // Tự động reload để tạo database mới
          window.location.reload();
          resolve(false);
          return;
        }

        console.log('IndexedDB đã sẵn sàng');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store cho hóa đơn mua vào
        if (!db.objectStoreNames.contains(STORE_INVOICES)) {
          const invoiceStore = db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
          invoiceStore.createIndex('tdlap', 'tdlap', { unique: false });
          invoiceStore.createIndex('nbmst', 'nbmst', { unique: false });
          invoiceStore.createIndex('shdon', 'shdon', { unique: false });
        }

        // Store cho chi tiết hóa đơn
        if (!db.objectStoreNames.contains(STORE_INVOICE_DETAILS)) {
          const detailStore = db.createObjectStore(STORE_INVOICE_DETAILS, { keyPath: 'id' });
          detailStore.createIndex('nbmst_khhdon_shdon', ['nbmst', 'khhdon', 'shdon'], { unique: true });
        }

        // Store cho hóa đơn bán ra
        if (!db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
          const soldStore = db.createObjectStore(STORE_SOLD_INVOICES, { keyPath: 'id' });
          soldStore.createIndex('tdlap', 'tdlap', { unique: false });
          soldStore.createIndex('nbmst', 'nbmst', { unique: false });
          soldStore.createIndex('shdon', 'shdon', { unique: false });
        }

        // Store cho chi tiết hóa đơn bán ra
        if (!db.objectStoreNames.contains(STORE_SOLD_INVOICE_DETAILS)) {
          const soldDetailStore = db.createObjectStore(STORE_SOLD_INVOICE_DETAILS, { keyPath: 'id' });
          soldDetailStore.createIndex('nbmst_khhdon_shdon', ['nbmst', 'khhdon', 'shdon'], { unique: true });
        }

        // Store cho metadata (thông tin cache)
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Đảm bảo DB đã sẵn sàng
   */
  private async ensureDB(): Promise<boolean> {
    return this.dbReady;
  }

  /**
   * Lưu danh sách hóa đơn vào cache
   */
  async saveInvoices(invoices: HddtInvoice[], fromDate: string, toDate: string): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_INVOICES, STORE_METADATA], 'readwrite');
      const invoiceStore = transaction.objectStore(STORE_INVOICES);
      const metadataStore = transaction.objectStore(STORE_METADATA);

      // Lưu từng hóa đơn
      invoices.forEach(invoice => {
        invoiceStore.put(invoice);
      });

      // Lưu metadata
      const metadata: CacheMetadata = {
        key: 'purchase_invoices',
        lastUpdated: Date.now(),
        fromDate,
        toDate
      };
      metadataStore.put(metadata);

      transaction.oncomplete = () => {
        console.log(`Đã cache ${invoices.length} hóa đơn`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('Lỗi khi lưu cache:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Lấy hóa đơn từ cache theo khoảng thời gian
   */
  async getInvoicesByDateRange(fromDate: string, toDate: string): Promise<HddtInvoice[]> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_INVOICES, 'readonly');
      const store = transaction.objectStore(STORE_INVOICES);
      const request = store.getAll();

      request.onsuccess = () => {
        const allInvoices: HddtInvoice[] = request.result || [];

        // Parse dates để filter
        const from = this.parseDate(fromDate);
        const to = this.parseDate(toDate);
        to.setHours(23, 59, 59, 999); // Cuối ngày

        // Filter theo ngày
        const filtered = allInvoices.filter(inv => {
          const invDate = new Date(inv.tdlap);
          return invDate >= from && invDate <= to;
        });

        // Sort theo ngày giảm dần
        filtered.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());

        resolve(filtered);
      };

      request.onerror = () => {
        console.error('Lỗi khi đọc cache:', request.error);
        resolve([]);
      };
    });
  }

  /**
   * Lấy tất cả hóa đơn trong cache
   */
  async getAllInvoices(): Promise<HddtInvoice[]> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_INVOICES, 'readonly');
      const store = transaction.objectStore(STORE_INVOICES);
      const request = store.getAll();

      request.onsuccess = () => {
        const invoices: HddtInvoice[] = request.result || [];
        // Sort theo ngày giảm dần
        invoices.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());
        resolve(invoices);
      };

      request.onerror = () => {
        console.error('Lỗi khi đọc cache:', request.error);
        resolve([]);
      };
    });
  }

  /**
   * Kiểm tra cache có dữ liệu trong khoảng thời gian không
   */
  async hasDataForDateRange(fromDate: string, toDate: string): Promise<boolean> {
    const metadata = await this.getMetadata();
    if (!metadata) return false;

    // So sánh ngày
    const cacheFrom = this.parseDate(metadata.fromDate);
    const cacheTo = this.parseDate(metadata.toDate);
    const requestFrom = this.parseDate(fromDate);
    const requestTo = this.parseDate(toDate);

    // Cache hợp lệ nếu khoảng thời gian yêu cầu nằm trong cache
    return requestFrom >= cacheFrom && requestTo <= cacheTo;
  }

  /**
   * Lấy metadata của cache
   */
  async getMetadata(): Promise<CacheMetadata | null> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_METADATA, 'readonly');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get('purchase_invoices');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Kiểm tra cache có còn hạn không (mặc định 1 giờ)
   */
  async isCacheValid(maxAgeMs: number = 60 * 60 * 1000): Promise<boolean> {
    const metadata = await this.getMetadata();
    if (!metadata) return false;

    const age = Date.now() - metadata.lastUpdated;
    return age < maxAgeMs;
  }

  /**
   * Xóa toàn bộ cache
   */
  async clearCache(): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_INVOICES, STORE_METADATA], 'readwrite');
      transaction.objectStore(STORE_INVOICES).clear();
      transaction.objectStore(STORE_METADATA).clear();

      transaction.oncomplete = () => {
        console.log('Đã xóa cache');
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Tìm kiếm hóa đơn trong cache
   */
  async searchInvoices(query: string): Promise<HddtInvoice[]> {
    const allInvoices = await this.getAllInvoices();
    if (!query.trim()) return allInvoices;

    const lowerQuery = query.toLowerCase().trim();

    return allInvoices.filter(inv => {
      return (
        inv.nbten?.toLowerCase().includes(lowerQuery) ||
        inv.nbmst?.toLowerCase().includes(lowerQuery) ||
        inv.shdon?.toString().includes(lowerQuery) ||
        inv.khhdon?.toLowerCase().includes(lowerQuery) ||
        inv.nmten?.toLowerCase().includes(lowerQuery) ||
        inv.nmmst?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Parse date từ format dd/MM/yyyy
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  }

  /**
   * Lấy số lượng hóa đơn trong cache
   */
  async getInvoiceCount(): Promise<number> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_INVOICES, 'readonly');
      const store = transaction.objectStore(STORE_INVOICES);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  // ==================== INVOICE DETAIL CACHE ====================

  /**
   * Tạo cache key cho chi tiết hóa đơn
   */
  private createDetailCacheKey(nbmst: string, khhdon: string, shdon: number, khmshdon: number): string {
    return `${nbmst}_${khhdon}_${shdon}_${khmshdon}`;
  }

  /**
   * Lưu chi tiết hóa đơn vào cache
   */
  async saveInvoiceDetail(detail: HddtInvoiceDetail): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    // Kiểm tra store tồn tại
    if (!this.db.objectStoreNames.contains(STORE_INVOICE_DETAILS)) {
      console.warn('Store invoice_details chưa tồn tại, bỏ qua cache');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readwrite');
        const store = transaction.objectStore(STORE_INVOICE_DETAILS);

        // Thêm timestamp để biết khi nào được cache
        const detailWithTimestamp = {
          ...detail,
          _cachedAt: Date.now()
        };

        store.put(detailWithTimestamp);

        transaction.oncomplete = () => {
          console.log(`Đã cache chi tiết hóa đơn: ${detail.khhdon}-${detail.shdon}`);
          resolve();
        };

        transaction.onerror = () => {
          console.error('Lỗi khi lưu chi tiết hóa đơn:', transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Lỗi khi truy cập invoice_details store:', error);
        resolve(); // Không reject để không crash app
      }
    });
  }

  /**
   * Lấy chi tiết hóa đơn từ cache theo ID
   */
  async getInvoiceDetailById(id: string): Promise<HddtInvoiceDetail | null> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readonly');
      const store = transaction.objectStore(STORE_INVOICE_DETAILS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Lấy chi tiết hóa đơn từ cache theo params (nbmst, khhdon, shdon, khmshdon)
   */
  async getInvoiceDetailByParams(
    nbmst: string,
    khhdon: string,
    shdon: number,
    khmshdon: number
  ): Promise<HddtInvoiceDetail | null> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return null;

    // Kiểm tra store tồn tại
    if (!this.db.objectStoreNames.contains(STORE_INVOICE_DETAILS)) {
      console.warn('Store invoice_details chưa tồn tại');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readonly');
        const store = transaction.objectStore(STORE_INVOICE_DETAILS);
        const index = store.index('nbmst_khhdon_shdon');
        const request = index.get([nbmst, khhdon, shdon]);

        request.onsuccess = () => {
          const result = request.result;
          // Kiểm tra khmshdon vì index chỉ có 3 field
          if (result && result.khmshdon === khmshdon) {
            resolve(result);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        console.error('Lỗi khi truy cập invoice_details store:', error);
        resolve(null);
      }
    });
  }

  /**
   * Kiểm tra chi tiết hóa đơn đã được cache chưa
   */
  async hasInvoiceDetail(
    nbmst: string,
    khhdon: string,
    shdon: number,
    khmshdon: number
  ): Promise<boolean> {
    const detail = await this.getInvoiceDetailByParams(nbmst, khhdon, shdon, khmshdon);
    return detail !== null;
  }

  /**
   * Xóa chi tiết hóa đơn khỏi cache
   */
  async deleteInvoiceDetail(id: string): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readwrite');
      const store = transaction.objectStore(STORE_INVOICE_DETAILS);
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Xóa tất cả chi tiết hóa đơn trong cache
   */
  async clearInvoiceDetails(): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readwrite');
      const store = transaction.objectStore(STORE_INVOICE_DETAILS);
      store.clear();

      transaction.oncomplete = () => {
        console.log('Đã xóa cache chi tiết hóa đơn');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Lấy số lượng chi tiết hóa đơn đã cache
   */
  async getInvoiceDetailCount(): Promise<number> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_INVOICE_DETAILS, 'readonly');
      const store = transaction.objectStore(STORE_INVOICE_DETAILS);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }

  // ==================== SOLD INVOICES CACHE (HÓA ĐƠN BÁN RA) ====================

  /**
   * Lưu danh sách hóa đơn bán ra vào cache
   */
  async saveSoldInvoices(invoices: HddtSoldInvoice[], fromDate: string, toDate: string): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
      console.warn('Store sold_invoices chưa tồn tại');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORE_SOLD_INVOICES, STORE_METADATA], 'readwrite');
        const invoiceStore = transaction.objectStore(STORE_SOLD_INVOICES);
        const metadataStore = transaction.objectStore(STORE_METADATA);

        // Lưu từng hóa đơn
        invoices.forEach(invoice => {
          invoiceStore.put(invoice);
        });

        // Lưu metadata
        const metadata: CacheMetadata = {
          key: 'sold_invoices',
          lastUpdated: Date.now(),
          fromDate,
          toDate
        };
        metadataStore.put(metadata);

        transaction.oncomplete = () => {
          console.log(`Đã cache ${invoices.length} hóa đơn bán ra`);
          resolve();
        };

        transaction.onerror = () => {
          console.error('Lỗi khi lưu cache hóa đơn bán ra:', transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Lỗi khi truy cập sold_invoices store:', error);
        resolve();
      }
    });
  }

  /**
   * Lấy hóa đơn bán ra từ cache theo khoảng thời gian
   */
  async getSoldInvoicesByDateRange(fromDate: string, toDate: string): Promise<HddtSoldInvoice[]> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return [];

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICES, 'readonly');
        const store = transaction.objectStore(STORE_SOLD_INVOICES);
        const request = store.getAll();

        request.onsuccess = () => {
          const allInvoices: HddtSoldInvoice[] = request.result || [];

          // Parse dates để filter
          const from = this.parseDate(fromDate);
          const to = this.parseDate(toDate);
          to.setHours(23, 59, 59, 999);

          // Filter theo ngày
          const filtered = allInvoices.filter(inv => {
            const invDate = new Date(inv.tdlap);
            return invDate >= from && invDate <= to;
          });

          // Sort theo ngày giảm dần
          filtered.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());

          resolve(filtered);
        };

        request.onerror = () => {
          resolve([]);
        };
      } catch (error) {
        console.error('Lỗi khi đọc cache hóa đơn bán ra:', error);
        resolve([]);
      }
    });
  }

  /**
   * Lấy tất cả hóa đơn bán ra trong cache
   */
  async getAllSoldInvoices(): Promise<HddtSoldInvoice[]> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return [];

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICES, 'readonly');
        const store = transaction.objectStore(STORE_SOLD_INVOICES);
        const request = store.getAll();

        request.onsuccess = () => {
          const invoices: HddtSoldInvoice[] = request.result || [];
          invoices.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());
          resolve(invoices);
        };

        request.onerror = () => {
          resolve([]);
        };
      } catch (error) {
        resolve([]);
      }
    });
  }

  /**
   * Lấy metadata của cache hóa đơn bán ra
   */
  async getSoldMetadata(): Promise<CacheMetadata | null> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_METADATA, 'readonly');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get('sold_invoices');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Kiểm tra cache hóa đơn bán ra có còn hạn không
   */
  async isSoldCacheValid(maxAgeMs: number = 60 * 60 * 1000): Promise<boolean> {
    const metadata = await this.getSoldMetadata();
    if (!metadata) return false;

    const age = Date.now() - metadata.lastUpdated;
    return age < maxAgeMs;
  }

  /**
   * Xóa cache hóa đơn bán ra
   */
  async clearSoldCache(): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORE_SOLD_INVOICES, STORE_METADATA], 'readwrite');
        transaction.objectStore(STORE_SOLD_INVOICES).clear();

        // Xóa metadata của sold_invoices
        const metadataStore = transaction.objectStore(STORE_METADATA);
        metadataStore.delete('sold_invoices');

        transaction.oncomplete = () => {
          console.log('Đã xóa cache hóa đơn bán ra');
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Lỗi khi xóa cache hóa đơn bán ra:', error);
        resolve();
      }
    });
  }

  /**
   * Tìm kiếm hóa đơn bán ra trong cache
   */
  async searchSoldInvoices(query: string): Promise<HddtSoldInvoice[]> {
    const allInvoices = await this.getAllSoldInvoices();
    if (!query.trim()) return allInvoices;

    const lowerQuery = query.toLowerCase().trim();

    return allInvoices.filter(inv => {
      return (
        inv.nbten?.toLowerCase().includes(lowerQuery) ||
        inv.nbmst?.toLowerCase().includes(lowerQuery) ||
        inv.shdon?.toString().includes(lowerQuery) ||
        inv.khhdon?.toLowerCase().includes(lowerQuery) ||
        inv.nmten?.toLowerCase().includes(lowerQuery) ||
        inv.nmmst?.toLowerCase().includes(lowerQuery) ||
        inv.nmtnmua?.toLowerCase().includes(lowerQuery) ||
        inv.mhdon?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Lấy số lượng hóa đơn bán ra trong cache
   */
  async getSoldInvoiceCount(): Promise<number> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return 0;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICES)) {
      return 0;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICES, 'readonly');
        const store = transaction.objectStore(STORE_SOLD_INVOICES);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      } catch (error) {
        resolve(0);
      }
    });
  }

  // ==================== SOLD INVOICE DETAIL CACHE ====================

  /**
   * Lưu chi tiết hóa đơn bán ra vào cache
   */
  async saveSoldInvoiceDetail(detail: HddtInvoiceDetail): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICE_DETAILS)) {
      console.warn('Store sold_invoice_details chưa tồn tại');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICE_DETAILS, 'readwrite');
        const store = transaction.objectStore(STORE_SOLD_INVOICE_DETAILS);

        const detailWithTimestamp = {
          ...detail,
          _cachedAt: Date.now()
        };

        store.put(detailWithTimestamp);

        transaction.oncomplete = () => {
          console.log(`Đã cache chi tiết hóa đơn bán ra: ${detail.khhdon}-${detail.shdon}`);
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Lỗi khi lưu chi tiết hóa đơn bán ra:', error);
        resolve();
      }
    });
  }

  /**
   * Lấy chi tiết hóa đơn bán ra từ cache theo params
   */
  async getSoldInvoiceDetailByParams(
    nbmst: string,
    khhdon: string,
    shdon: number,
    khmshdon: number
  ): Promise<HddtInvoiceDetail | null> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return null;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICE_DETAILS)) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICE_DETAILS, 'readonly');
        const store = transaction.objectStore(STORE_SOLD_INVOICE_DETAILS);
        const index = store.index('nbmst_khhdon_shdon');
        const request = index.get([nbmst, khhdon, shdon]);

        request.onsuccess = () => {
          const result = request.result;
          if (result && result.khmshdon === khmshdon) {
            resolve(result);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        console.error('Lỗi khi đọc chi tiết hóa đơn bán ra:', error);
        resolve(null);
      }
    });
  }

  /**
   * Xóa cache chi tiết hóa đơn bán ra
   */
  async clearSoldInvoiceDetails(): Promise<void> {
    const ready = await this.ensureDB();
    if (!ready || !this.db) return;

    if (!this.db.objectStoreNames.contains(STORE_SOLD_INVOICE_DETAILS)) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(STORE_SOLD_INVOICE_DETAILS, 'readwrite');
        const store = transaction.objectStore(STORE_SOLD_INVOICE_DETAILS);
        store.clear();

        transaction.oncomplete = () => {
          console.log('Đã xóa cache chi tiết hóa đơn bán ra');
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        resolve();
      }
    });
  }
}
