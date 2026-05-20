/**
 * ACCOUNTANT CACHE SERVICE
 * IndexedDB cache cho các trang kế toán
 * Giảm thiểu việc gọi API bằng cách cache data theo filter
 */

import { Injectable } from '@angular/core';
import { IndexedDBService } from '../../services/indexed-db.service';
import { Invoice, InvoiceFilter, Pagination, ReconciliationSummary, Supplier } from './invoice.service.v2';
import { OutputInvoice, OutputInvoiceFilter, OutputPagination, OutputReconciliationSummary } from './output-invoice.service.v2';

// Database config
const DB_NAME = 'accountant_cache';
const DB_VERSION = 2;

// Store names
const STORE_INVOICES = 'invoices';
const STORE_SUPPLIERS = 'suppliers';
const STORE_SUMMARY = 'summary';
const STORE_CACHE_META = 'cache_meta';

// Output invoice stores
const STORE_OUTPUT_INVOICES = 'output_invoices';
const STORE_OUTPUT_CUSTOMERS = 'output_customers';
const STORE_OUTPUT_SUMMARY = 'output_summary';

// Lookup stores (gmail labels, providers)
const STORE_GMAIL_LABELS = 'gmail_labels';
const STORE_PROVIDERS = 'providers';

// Cache expiry (30 phút)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

// Lookup cache expiry (24 giờ — labels/providers ít thay đổi)
const LOOKUP_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface CachedInvoiceData {
  filterKey: string;
  invoices: Invoice[];
  pagination: Pagination;
  timestamp: number;
}

export interface CachedSummary {
  key: string;
  summary: ReconciliationSummary;
  timestamp: number;
}

export interface CacheMeta {
  key: string;
  lastUpdated: number;
  source: string;
}

// Output invoice cache interfaces
export interface CachedOutputInvoiceData {
  filterKey: string;
  invoices: OutputInvoice[];
  pagination: OutputPagination;
  timestamp: number;
}

export interface CachedOutputSummary {
  key: string;
  summary: OutputReconciliationSummary;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AccountantCacheService {
  private initialized = false;

  constructor(private indexedDB: IndexedDBService) {}

  /**
   * Khởi tạo database với các object stores
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.indexedDB.getDB(DB_NAME, DB_VERSION, (db) => {
        // Store cho invoices (cache theo filter)
        if (!db.objectStoreNames.contains(STORE_INVOICES)) {
          db.createObjectStore(STORE_INVOICES, { keyPath: 'filterKey' });
        }

        // Store cho suppliers
        if (!db.objectStoreNames.contains(STORE_SUPPLIERS)) {
          db.createObjectStore(STORE_SUPPLIERS, { keyPath: 'taxCode' });
        }

        // Store cho reconciliation summary
        if (!db.objectStoreNames.contains(STORE_SUMMARY)) {
          db.createObjectStore(STORE_SUMMARY, { keyPath: 'key' });
        }

        // Store cho cache metadata
        if (!db.objectStoreNames.contains(STORE_CACHE_META)) {
          db.createObjectStore(STORE_CACHE_META, { keyPath: 'key' });
        }

        // Output invoice stores
        if (!db.objectStoreNames.contains(STORE_OUTPUT_INVOICES)) {
          db.createObjectStore(STORE_OUTPUT_INVOICES, { keyPath: 'filterKey' });
        }

        if (!db.objectStoreNames.contains(STORE_OUTPUT_CUSTOMERS)) {
          db.createObjectStore(STORE_OUTPUT_CUSTOMERS, { keyPath: 'name' });
        }

        if (!db.objectStoreNames.contains(STORE_OUTPUT_SUMMARY)) {
          db.createObjectStore(STORE_OUTPUT_SUMMARY, { keyPath: 'key' });
        }

        // Lookup stores
        if (!db.objectStoreNames.contains(STORE_GMAIL_LABELS)) {
          db.createObjectStore(STORE_GMAIL_LABELS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_PROVIDERS)) {
          db.createObjectStore(STORE_PROVIDERS, { keyPath: 'key' });
        }
      });

      this.initialized = true;
      console.log('✅ AccountantCacheService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AccountantCacheService:', error);
    }
  }

  // ==========================================================================
  // INVOICES CACHE
  // ==========================================================================

  /**
   * Tạo cache key từ filter
   */
  private createFilterKey(filter: InvoiceFilter): string {
    const parts = [
      filter.source || 'all',
      filter.monthKey || '',
      filter.year || '',
      filter.fromDate || '',
      filter.toDate || '',
      filter.supplierTaxCode || '',
      filter.reconcileStatus || '',
      filter.pageSize || 50,
      filter.cursor || '',
      filter.direction || ''
    ];
    return parts.join('|');
  }

  /**
   * Lấy invoices từ cache
   */
  async getCachedInvoices(filter: InvoiceFilter): Promise<{ invoices: Invoice[]; pagination: Pagination } | null> {
    await this.init();

    try {
      const filterKey = this.createFilterKey(filter);
      const cached = await this.indexedDB.getByKey<CachedInvoiceData>(
        DB_NAME,
        DB_VERSION,
        STORE_INVOICES,
        filterKey
      );

      if (!cached) return null;

      // Check expiry
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        console.log('📦 Cache expired for filter:', filterKey);
        await this.indexedDB.delete(DB_NAME, DB_VERSION, STORE_INVOICES, filterKey);
        return null;
      }

      console.log('📦 Cache hit for filter:', filterKey);
      return {
        invoices: cached.invoices,
        pagination: cached.pagination
      };
    } catch (error) {
      console.error('❌ Error getting cached invoices:', error);
      return null;
    }
  }

  /**
   * Lưu invoices vào cache
   */
  async cacheInvoices(
    filter: InvoiceFilter,
    invoices: Invoice[],
    pagination: Pagination
  ): Promise<void> {
    await this.init();

    try {
      const filterKey = this.createFilterKey(filter);
      const cacheData: CachedInvoiceData = {
        filterKey,
        invoices,
        pagination,
        timestamp: Date.now()
      };

      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_INVOICES, cacheData);
      console.log('💾 Cached invoices for filter:', filterKey);
    } catch (error) {
      console.error('❌ Error caching invoices:', error);
    }
  }

  /**
   * Xóa cache invoices (khi cần reload mới)
   */
  async clearInvoicesCache(): Promise<void> {
    await this.init();

    try {
      await this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_INVOICES);
      console.log('🗑️ Cleared invoices cache');
    } catch (error) {
      console.error('❌ Error clearing invoices cache:', error);
    }
  }

  // ==========================================================================
  // SUPPLIERS CACHE
  // ==========================================================================

  /**
   * Lấy suppliers từ cache
   */
  async getCachedSuppliers(): Promise<Supplier[] | null> {
    await this.init();

    try {
      const suppliers = await this.indexedDB.getAll<Supplier>(
        DB_NAME,
        DB_VERSION,
        STORE_SUPPLIERS
      );

      if (!suppliers || suppliers.length === 0) return null;

      // Check metadata for expiry
      const meta = await this.indexedDB.getByKey<CacheMeta>(
        DB_NAME,
        DB_VERSION,
        STORE_CACHE_META,
        'suppliers'
      );

      if (meta && Date.now() - meta.lastUpdated > CACHE_EXPIRY_MS) {
        console.log('📦 Suppliers cache expired');
        return null;
      }

      console.log('📦 Suppliers cache hit:', suppliers.length);
      return suppliers;
    } catch (error) {
      console.error('❌ Error getting cached suppliers:', error);
      return null;
    }
  }

  /**
   * Lưu suppliers vào cache
   */
  async cacheSuppliers(suppliers: Supplier[]): Promise<void> {
    await this.init();

    try {
      // Clear old data
      await this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_SUPPLIERS);

      // Save new data
      await this.indexedDB.putMany(DB_NAME, DB_VERSION, STORE_SUPPLIERS, suppliers);

      // Update metadata
      const meta: CacheMeta = {
        key: 'suppliers',
        lastUpdated: Date.now(),
        source: 'api'
      };
      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_CACHE_META, meta);

      console.log('💾 Cached suppliers:', suppliers.length);
    } catch (error) {
      console.error('❌ Error caching suppliers:', error);
    }
  }

  // ==========================================================================
  // SUMMARY CACHE
  // ==========================================================================

  /**
   * Lấy reconciliation summary từ cache
   */
  async getCachedSummary(monthKey?: string, year?: number): Promise<ReconciliationSummary | null> {
    await this.init();

    try {
      const key = `summary_${monthKey || ''}_${year || ''}`;
      const cached = await this.indexedDB.getByKey<CachedSummary>(
        DB_NAME,
        DB_VERSION,
        STORE_SUMMARY,
        key
      );

      if (!cached) return null;

      // Check expiry (5 phút cho summary vì thay đổi thường xuyên)
      if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
        console.log('📦 Summary cache expired');
        return null;
      }

      console.log('📦 Summary cache hit');
      return cached.summary;
    } catch (error) {
      console.error('❌ Error getting cached summary:', error);
      return null;
    }
  }

  /**
   * Lưu reconciliation summary vào cache
   */
  async cacheSummary(summary: ReconciliationSummary, monthKey?: string, year?: number): Promise<void> {
    await this.init();

    try {
      const key = `summary_${monthKey || ''}_${year || ''}`;
      const cacheData: CachedSummary = {
        key,
        summary,
        timestamp: Date.now()
      };

      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_SUMMARY, cacheData);
      console.log('💾 Cached summary');
    } catch (error) {
      console.error('❌ Error caching summary:', error);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Xóa tất cả cache
   */
  async clearAllCache(): Promise<void> {
    await this.init();

    try {
      await Promise.all([
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_INVOICES),
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_SUPPLIERS),
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_SUMMARY),
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_CACHE_META)
      ]);
      console.log('🗑️ Cleared all accountant cache');
    } catch (error) {
      console.error('❌ Error clearing all cache:', error);
    }
  }

  /**
   * Invalidate cache cho một source cụ thể
   * Gọi sau khi import/delete để buộc reload
   */
  async invalidateBySource(source: string): Promise<void> {
    await this.init();

    try {
      // Xóa tất cả invoices cache vì không biết filter nào bị ảnh hưởng
      await this.clearInvoicesCache();
      // Xóa summary cache
      await this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_SUMMARY);
      console.log('🔄 Invalidated cache for source:', source);
    } catch (error) {
      console.error('❌ Error invalidating cache:', error);
    }
  }

  // ==========================================================================
  // OUTPUT INVOICES CACHE (for ledger-9)
  // ==========================================================================

  /**
   * Tạo cache key từ output filter
   */
  private createOutputFilterKey(filter: OutputInvoiceFilter): string {
    const parts = [
      'output',
      filter.source || 'all',
      filter.monthKey || '',
      filter.year || '',
      filter.fromDate || '',
      filter.toDate || '',
      filter.customerName || '',
      filter.reconcileStatus || '',
      filter.pageSize || 50,
      filter.afterDocId || '',
      filter.beforeDocId || ''
    ];
    return parts.join('|');
  }

  /**
   * Lấy output invoices từ cache
   */
  async getCachedOutputInvoices(filter: OutputInvoiceFilter): Promise<{ invoices: OutputInvoice[]; pagination: OutputPagination } | null> {
    await this.init();

    try {
      const filterKey = this.createOutputFilterKey(filter);
      const cached = await this.indexedDB.getByKey<CachedOutputInvoiceData>(
        DB_NAME,
        DB_VERSION,
        STORE_OUTPUT_INVOICES,
        filterKey
      );

      if (!cached) return null;

      // Check expiry
      if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        console.log('📦 Output cache expired for filter:', filterKey);
        await this.indexedDB.delete(DB_NAME, DB_VERSION, STORE_OUTPUT_INVOICES, filterKey);
        return null;
      }

      console.log('📦 Output cache hit for filter:', filterKey);
      return {
        invoices: cached.invoices,
        pagination: cached.pagination
      };
    } catch (error) {
      console.error('❌ Error getting cached output invoices:', error);
      return null;
    }
  }

  /**
   * Lưu output invoices vào cache
   */
  async cacheOutputInvoices(
    filter: OutputInvoiceFilter,
    invoices: OutputInvoice[],
    pagination: OutputPagination
  ): Promise<void> {
    await this.init();

    try {
      const filterKey = this.createOutputFilterKey(filter);
      const cacheData: CachedOutputInvoiceData = {
        filterKey,
        invoices,
        pagination,
        timestamp: Date.now()
      };

      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_OUTPUT_INVOICES, cacheData);
      console.log('💾 Cached output invoices for filter:', filterKey);
    } catch (error) {
      console.error('❌ Error caching output invoices:', error);
    }
  }

  /**
   * Lấy output reconciliation summary từ cache
   */
  async getCachedOutputSummary(monthKey?: string, year?: number): Promise<OutputReconciliationSummary | null> {
    await this.init();

    try {
      const key = `output_summary_${monthKey || ''}_${year || ''}`;
      const cached = await this.indexedDB.getByKey<CachedOutputSummary>(
        DB_NAME,
        DB_VERSION,
        STORE_OUTPUT_SUMMARY,
        key
      );

      if (!cached) return null;

      // Check expiry (5 phút cho summary)
      if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
        console.log('📦 Output summary cache expired');
        return null;
      }

      console.log('📦 Output summary cache hit');
      return cached.summary;
    } catch (error) {
      console.error('❌ Error getting cached output summary:', error);
      return null;
    }
  }

  /**
   * Lưu output reconciliation summary vào cache
   */
  async cacheOutputSummary(summary: OutputReconciliationSummary, monthKey?: string, year?: number): Promise<void> {
    await this.init();

    try {
      const key = `output_summary_${monthKey || ''}_${year || ''}`;
      const cacheData: CachedOutputSummary = {
        key,
        summary,
        timestamp: Date.now()
      };

      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_OUTPUT_SUMMARY, cacheData);
      console.log('💾 Cached output summary');
    } catch (error) {
      console.error('❌ Error caching output summary:', error);
    }
  }

  /**
   * Xóa tất cả output cache
   */
  async clearAllOutputCache(): Promise<void> {
    await this.init();

    try {
      await Promise.all([
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_OUTPUT_INVOICES),
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_OUTPUT_CUSTOMERS),
        this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_OUTPUT_SUMMARY)
      ]);
      console.log('🗑️ Cleared all output cache');
    } catch (error) {
      console.error('❌ Error clearing output cache:', error);
    }
  }

  /**
   * Invalidate output cache cho một source cụ thể
   */
  async invalidateOutputBySource(source: string): Promise<void> {
    await this.init();

    try {
      await this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_OUTPUT_INVOICES);
      await this.indexedDB.clear(DB_NAME, DB_VERSION, STORE_OUTPUT_SUMMARY);
      console.log('🔄 Invalidated output cache for source:', source);
    } catch (error) {
      console.error('❌ Error invalidating output cache:', error);
    }
  }

  // ==========================================================================
  // GMAIL LABELS CACHE (24h expiry)
  // ==========================================================================

  async getCachedGmailLabels(): Promise<{id: string, name: string}[] | null> {
    await this.init();
    try {
      const cached = await this.indexedDB.getByKey<{key: string, labels: {id: string, name: string}[], timestamp: number}>(
        DB_NAME, DB_VERSION, STORE_GMAIL_LABELS, 'gmail_labels'
      );
      if (!cached) return null;
      if (Date.now() - cached.timestamp > LOOKUP_CACHE_EXPIRY_MS) {
        await this.indexedDB.delete(DB_NAME, DB_VERSION, STORE_GMAIL_LABELS, 'gmail_labels');
        return null;
      }
      console.log('📦 Gmail labels cache hit:', cached.labels.length);
      return cached.labels;
    } catch (error) {
      console.error('❌ Error getting cached gmail labels:', error);
      return null;
    }
  }

  async cacheGmailLabels(labels: {id: string, name: string}[]): Promise<void> {
    await this.init();
    try {
      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_GMAIL_LABELS, {
        key: 'gmail_labels', labels, timestamp: Date.now()
      });
      console.log('💾 Cached gmail labels:', labels.length);
    } catch (error) {
      console.error('❌ Error caching gmail labels:', error);
    }
  }

  // ==========================================================================
  // PROVIDERS CACHE (24h expiry)
  // ==========================================================================

  async getCachedProviders(): Promise<{name: string, count: number}[] | null> {
    await this.init();
    try {
      const cached = await this.indexedDB.getByKey<{key: string, providers: {name: string, count: number}[], timestamp: number}>(
        DB_NAME, DB_VERSION, STORE_PROVIDERS, 'providers'
      );
      if (!cached) return null;
      if (Date.now() - cached.timestamp > LOOKUP_CACHE_EXPIRY_MS) {
        await this.indexedDB.delete(DB_NAME, DB_VERSION, STORE_PROVIDERS, 'providers');
        return null;
      }
      console.log('📦 Providers cache hit:', cached.providers.length);
      return cached.providers;
    } catch (error) {
      console.error('❌ Error getting cached providers:', error);
      return null;
    }
  }

  async cacheProviders(providers: {name: string, count: number}[]): Promise<void> {
    await this.init();
    try {
      await this.indexedDB.put(DB_NAME, DB_VERSION, STORE_PROVIDERS, {
        key: 'providers', providers, timestamp: Date.now()
      });
      console.log('💾 Cached providers:', providers.length);
    } catch (error) {
      console.error('❌ Error caching providers:', error);
    }
  }
}
