/**
 * LEDGER 8 - ĐỐI CHIẾU HÓA ĐƠN ĐẦU VÀO
 * So sánh tự động Gmail vs GDT (hoadondientu.gdt.gov.vn)
 */

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, map, tap } from 'rxjs/operators';

import {
  InvoiceServiceV2,
  Invoice,
  InvoiceFilter,
  Pagination,
  FieldDiff,
  PortalLink,
  LiveReconcileRow
} from '../invoice.service.v2';
import { AccountantCacheService } from '../accountant-cache.service';
import { HddtService, HddtInvoice } from '../../../services/hddt.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ledger-8-dong-bo-hoa-don-v2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './ledger-8-dong-bo-hoa-don-v2.component.html',
  styleUrls: ['./ledger-8-dong-bo-hoa-don-v2.component.css']
})
export class Ledger8DongBoHoaDonV2Component implements OnInit, OnDestroy {
  filterForm: FormGroup;

  // Gmail labels for supplier filter
  gmailLabels: {id: string, name: string, displayName: string}[] = [];
  labelMappings: {labelId: string, labelName: string, displayName: string, supplierTaxCode: string, supplierName: string}[] = [];

  // Loading states
  loadingLabels = false;

  // Current filter
  currentFilter: InvoiceFilter = {};

  private destroy$ = new Subject<void>();

  // === Main Tabs ===
  activeMainTab: 'reconcile' | 'portal' = 'reconcile';

  // === Portal Links Tab ===
  portalLinks: Invoice[] = [];
  portalLinksFiltered: Invoice[] = [];
  loadingPortalLinks = false;
  portalLinksPagination: Pagination = {
    hasNext: false, hasPrev: false, firstDocId: null, lastDocId: null, pageSize: 50, count: 0
  };
  portalLinksCurrentFilter: InvoiceFilter = {};
  portalLinksLabelId = '';
  portalLinksLabelSearch = '';
  labelDropdownOpen = false;
  portalLinksFromDate = new Date().toISOString().split('T')[0];
  portalLinksToDate = new Date().toISOString().split('T')[0];
  portalLinksSearchNo = '';

  // === Live Reconciliation (Gmail vs GDT) ===
  liveReconciling = false;
  liveResults: LiveReconcileRow[] = [];
  liveSummary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0 };
  liveGmailCount = 0;
  liveGdtCount = 0;
  liveSaving = false;
  liveSaved = false;
  liveStatusLog: string[] = [];

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceServiceV2,
    private cacheService: AccountantCacheService,
    private hddtService: HddtService,
    private http: HttpClient
  ) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDateStr = today.toISOString().split('T')[0];
    const fromDateStr = thirtyDaysAgo.toISOString().split('T')[0];

    this.filterForm = this.fb.group({
      fromDate: [fromDateStr],
      toDate: [toDateStr],
      gmailLabel: [''],
      pageSize: [25]
    });
  }

  ngOnInit(): void {
    this.loadGmailLabels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================================================
  // FILTER METHODS
  // ==========================================================================

  applyFilter(): void {
    const values = this.filterForm.value;
    const baseFilter: InvoiceFilter = { pageSize: values.pageSize };
    if (values.fromDate) baseFilter.fromDate = values.fromDate;
    if (values.toDate) baseFilter.toDate = values.toDate;
    if (values.gmailLabel) {
      const mapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
      if (mapping?.supplierTaxCode) {
        baseFilter.supplierTaxCode = mapping.supplierTaxCode;
      }
    }
    this.currentFilter = baseFilter;
  }

  /**
   * Load Gmail labels from KeToanBackEnd for supplier filter
   */
  async loadGmailLabels(): Promise<void> {
    this.loadingLabels = true;

    // Try IndexedDB cache first (24h expiry)
    const cached = await this.cacheService.getCachedGmailLabels();
    if (cached && cached.length > 0) {
      this.gmailLabels = cached.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
      this.loadingLabels = false;
      console.log('📦 Gmail labels from cache:', this.gmailLabels.length);
      this.loadLabelMappings();
      return;
    }

    // Cache miss → call API
    const gmailUid = localStorage.getItem('gmail_uid');
    const url = `${environment.ketoanBackendUrl}/api/gmail/labels${gmailUid ? '?uid=' + gmailUid : ''}`;
    console.log('🏷️ loadGmailLabels() → API', url);
    this.http.get<{success: boolean, labels: {id: string, name: string}[]}>(url)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingLabels = false))
      .subscribe({
        next: (response) => {
          const allLabels = response.labels || [];
          this.gmailLabels = allLabels.map(l => ({ id: l.id, name: l.name, displayName: l.name }));
          console.log('✅ Gmail labels from API:', this.gmailLabels.length);
          this.cacheService.cacheGmailLabels(allLabels);
          this.loadLabelMappings();
        },
        error: (err) => console.error('❌ loadGmailLabels error:', err)
      });
  }

  /**
   * Build label → supplierTaxCode mappings via name matching
   */
  loadLabelMappings(): void {
    console.log('🔗 loadLabelMappings() — matching', this.gmailLabels.length, 'labels to suppliers');
    this.invoiceService.getInternalSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers) => {
          this.labelMappings = this.gmailLabels.map(label => {
            const matched = suppliers.find(s =>
              s.name.toLowerCase().includes(label.displayName.toLowerCase()) ||
              label.displayName.toLowerCase().includes(s.name.toLowerCase())
            );
            return {
              labelId: label.id,
              labelName: label.name,
              displayName: label.displayName,
              supplierTaxCode: matched?.taxCode || '',
              supplierName: matched?.name || label.displayName
            };
          });
          const mapped = this.labelMappings.filter(m => m.supplierTaxCode).length;
          console.log(`✅ labelMappings built: ${this.labelMappings.length} labels, ${mapped} matched to taxCode`);
        },
        error: (err) => console.error('❌ loadLabelMappings error:', err)
      });
  }

  formatDiffValue(diff: FieldDiff): string {
    if (diff.diffType === 'number') {
      if (typeof diff.diff === 'number') {
        const prefix = diff.diff > 0 ? '+' : '';
        return prefix + this.formatCurrency(diff.diff);
      }
    }
    return String(diff.diff || '');
  }

  // ==========================================================================
  // PORTAL & PROVIDER METHODS
  // ==========================================================================

  /**
   * Open portal URL in new tab to view original invoice
   */
  openPortalUrl(invoice: Invoice): void {
    if (invoice.portalUrl) {
      window.open(invoice.portalUrl, '_blank');
    }
  }

  openGmailMessage(invoice: Invoice): void {
    const threadId = (invoice as any).gmailThreadId || (invoice as any).gmailMessageId;
    console.log('[openGmailMessage]', { threadId, gmailThreadId: (invoice as any).gmailThreadId, gmailMessageId: (invoice as any).gmailMessageId, invoice });
    if (threadId) {
      const url = `https://mail.google.com/mail/u/1/#all/${threadId}`;
      console.log('[openGmailMessage] Opening:', url);
      window.open(url, '_blank');
    }
  }

  get filteredGmailLabels() {
    if (!this.portalLinksLabelSearch.trim()) return this.gmailLabels;
    const q = this.portalLinksLabelSearch.toLowerCase();
    return this.gmailLabels.filter(l => l.displayName.toLowerCase().includes(q));
  }

  @HostListener('document:click')
  closeLabelDropdown() {
    this.labelDropdownOpen = false;
  }

  onLabelTriggerClick(e: Event) {
    e.stopPropagation();
    this.labelDropdownOpen = !this.labelDropdownOpen;
    if (this.labelDropdownOpen) this.portalLinksLabelSearch = '';
  }

  selectPortalLabel(id: string) {
    this.portalLinksLabelId = id;
    this.labelDropdownOpen = false;
  }

  getSelectedLabelName(): string {
    if (!this.portalLinksLabelId) return '';
    return this.gmailLabels.find(l => l.id === this.portalLinksLabelId)?.displayName || '';
  }

  getProviderClass(provider: string): string {
    const classes: Record<string, string> = {
      'VIETTEL': 'provider-viettel',
      'VNPT': 'provider-vnpt',
      'MISA': 'provider-misa',
      'VIN_HOADON': 'provider-vinhoadon',
      'KIOTVIET': 'provider-kiotviet',
      'MOBIFONE': 'provider-mobifone',
      'EINVOICE': 'provider-einvoice',
      'EHOADON': 'provider-ehoadon',
      'ASIAINVOICE': 'provider-asiainvoice',
      'MINVOICE': 'provider-minvoice',
      'WININVOICE': 'provider-wininvoice'
    };
    return classes[provider] || 'provider-default';
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  formatCurrency(amount: number | undefined): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(dateStr: string | undefined): string {
    return this.invoiceService.formatDate(dateStr);
  }

  /**
   * Reset filter to default
   */
  resetFilter(): void {
    const today = new Date().toISOString().split('T')[0];
    console.log('🔄 resetFilter() → today:', today);
    const now = new Date();
    const ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.filterForm.reset({ fromDate: ago.toISOString().split('T')[0], toDate: now.toISOString().split('T')[0], gmailLabel: '', pageSize: 25 });
    this.applyFilter();
  }

  /**
   * Force reload data (bỏ qua cache)
   * Dùng cho nút "Tải lại"
   */
  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading data...');
    await this.cacheService.clearAllCache();  // Xóa tất cả cache bao gồm summary
    this.applyFilter();
    this.loadGmailLabels();
  }

  switchMainTab(tab: 'reconcile' | 'portal'): void {
    this.activeMainTab = tab;
  }

  // ==========================================================================
  // PORTAL LINKS TAB
  // ==========================================================================

  loadPortalLinks(): void {
    this.loadingPortalLinks = true;

    const gmailUid = localStorage.getItem('gmail_uid') || '';

    // Calculate days_back from date filters
    let daysBack = 30;
    if (this.portalLinksFromDate) {
      const from = new Date(this.portalLinksFromDate);
      const now = new Date();
      daysBack = Math.max(1, Math.ceil((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    const params = {
      uid: gmailUid,
      labelId: this.portalLinksLabelId || undefined,
      daysBack,
      pageSize: 50,
    };

    console.log('🔗 loadPortalLinks() → Gmail direct', params);

    this.invoiceService.getPortalLinksFromGmail(params)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (response) => {
          console.log('🔗 [PortalLinks] Gmail returned:', {
            total: response.total,
            withPortalUrl: response.portalLinks.filter(p => p.portalUrl).length,
            withCredentials: response.portalLinks.filter(p => p.portalCredentials && Object.keys(p.portalCredentials).length > 0).length,
            withProvider: response.portalLinks.filter(p => p.invoiceProvider).length,
          });

          // Map PortalLink[] to Invoice[] for template compatibility
          this.portalLinks = response.portalLinks.map(pl => ({
            id: pl.gmailId,
            invoiceKey: pl.gmailId,
            invoiceNo: pl.invoiceNo || '',
            supplierName: pl.supplierName || pl.gmailFrom,
            supplierTaxCode: pl.supplierTaxCode || '',
            issueDate: pl.issueDate,
            issueDateKey: pl.issueDate?.split('T')[0] || '',
            monthKey: '',
            year: 0,
            totalBeforeVat: 0,
            vatRate: 0,
            vatAmount: 0,
            totalAmount: 0,
            source: 'AI_PDF' as any,
            reconcileStatus: 'PENDING' as any,
            createdAt: pl.issueDate,
            portalUrl: pl.portalUrl,
            portalPdfUrl: pl.portalPdfUrl,
            invoiceProvider: pl.invoiceProvider,
            portalCredentials: pl.portalCredentials,
            gmailFrom: pl.gmailFrom,
            gmailMessageId: pl.gmailId,
            gmailThreadId: (pl as any).gmailThreadId || pl.gmailId,
          } as Invoice));

          // Client-side date filtering (API only supports days_back, not exact range)
          if (this.portalLinksFromDate || this.portalLinksToDate) {
            this.portalLinks = this.portalLinks.filter(inv => {
              const d = inv.issueDateKey;
              if (!d) return true;
              if (this.portalLinksFromDate && d < this.portalLinksFromDate) return false;
              if (this.portalLinksToDate && d > this.portalLinksToDate) return false;
              return true;
            });
          }

          this.portalLinksPagination = {
            hasNext: false, hasPrev: false,
            firstDocId: null, lastDocId: null,
            pageSize: 50, count: response.total
          };
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error loading portal links from Gmail:', err)
      });
  }

  applyPortalLinksSearch(): void {
    if (!this.portalLinksSearchNo.trim()) {
      this.portalLinksFiltered = this.portalLinks;
      return;
    }
    const q = this.portalLinksSearchNo.trim().toLowerCase();
    this.portalLinksFiltered = this.portalLinks.filter(inv =>
      inv.invoiceNo?.toLowerCase().includes(q) ||
      inv.supplierName?.toLowerCase().includes(q) ||
      inv.invoiceProvider?.toLowerCase().includes(q)
    );
  }

  getLookupCode(inv: Invoice): string {
    if (!inv.portalCredentials) return '';
    const c = inv.portalCredentials as Record<string, string>;
    return c['lookupCode'] || '';
  }

  getSecretCode(inv: Invoice): string {
    if (!inv.portalCredentials) return '';
    const c = inv.portalCredentials as Record<string, string>;
    const parts: string[] = [];
    if (c['secretCode']) parts.push(c['secretCode']);
    if (c['taxCode']) parts.push(`MST: ${c['taxCode']}`);
    return parts.join(' | ');
  }

  nextPortalPage(): void {
    if (!this.portalLinksPagination.hasNext || !this.portalLinksPagination.lastDocId) return;
    this.loadingPortalLinks = true;
    this.invoiceService.getNextPage(this.portalLinksCurrentFilter, this.portalLinksPagination.lastDocId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (result) => {
          this.portalLinks = result.invoices;
          this.portalLinksPagination = result.pagination;
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error:', err)
      });
  }

  prevPortalPage(): void {
    if (!this.portalLinksPagination.hasPrev || !this.portalLinksPagination.firstDocId) return;
    this.loadingPortalLinks = true;
    this.invoiceService.getPrevPage(this.portalLinksCurrentFilter, this.portalLinksPagination.firstDocId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingPortalLinks = false))
      .subscribe({
        next: (result) => {
          this.portalLinks = result.invoices;
          this.portalLinksPagination = result.pagination;
          this.applyPortalLinksSearch();
        },
        error: (err) => console.error('Error:', err)
      });
  }

  // ==========================================================================
  // LIVE RECONCILIATION — Gmail vs GDT (parallel)
  // ==========================================================================

  runLiveReconciliation(): void {
    if (!this.hddtService.hasToken()) {
      alert('Chưa đăng nhập GDT. Vui lòng đăng nhập tại trang Hóa đơn mua vào trước.');
      return;
    }

    const values = this.filterForm.value;
    const fromDate = values.fromDate ? new Date(values.fromDate) : new Date();
    const toDate = values.toDate ? new Date(values.toDate) : new Date();

    // Gmail params
    const gmailUid = localStorage.getItem('gmail_uid') || '';
    let daysBack = 30;
    if (values.fromDate) {
      const now = new Date();
      daysBack = Math.max(1, Math.ceil((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    const labelMapping = this.labelMappings.find(m => m.labelName === values.gmailLabel);
    const labelId = labelMapping ? this.gmailLabels.find(l => l.name === values.gmailLabel)?.id : undefined;
    const mst = labelMapping?.supplierTaxCode || '';

    this.liveReconciling = true;
    this.liveResults = [];
    this.liveSaved = false;
    this.liveStatusLog = [`[${new Date().toLocaleTimeString()}] Bắt đầu đối chiếu...`];

    const addLog = (msg: string) => this.liveStatusLog = [...this.liveStatusLog, `[${new Date().toLocaleTimeString()}] ${msg}`];

    addLog(`Đang tải Gmail (daysBack=${daysBack}) và GDT (${values.fromDate} → ${values.toDate})...`);

    forkJoin({
      gmail: this.invoiceService.getPortalLinksFromGmail({
        uid: gmailUid,
        labelId,
        daysBack,
        pageSize: 200,
        parseAttachments: true,
      }).pipe(tap(res => addLog(`Gmail: ${(res.portalLinks || []).length} portal links`))),
      gdt: this.hddtService.getPurchaseInvoicesInRange(fromDate, toDate, true)
        .pipe(tap(inv => addLog(`GDT: ${(inv || []).length} hóa đơn`))),
    }).pipe(
      switchMap(({ gmail, gdt }) => {
        let gmailLinks = gmail.portalLinks || [];

        const toScrape = gmailLinks
          .filter(pl => !pl.hasAmounts && !!pl.portalUrl)
          .map(pl => ({ gmailId: pl.gmailId, portalUrl: pl.portalUrl, provider: pl.invoiceProvider || '', credentials: pl.portalCredentials || {} }));

        if (!toScrape.length) {
          addLog('Không có portal nào cần scrape XML');
          return of({ gmailLinks, gdtInvoices: gdt || [] });
        }

        addLog(`Đang scrape XML từ ${toScrape.length} portal...`);
        return this.invoiceService.scrapePortalXml(toScrape).pipe(
          map(res => {
            const scraped = new Map((res.results || []).filter(r => r.success && r.amounts).map(r => [r.gmailId, r.amounts!]));
            addLog(`Scrape xong: ${scraped.size}/${toScrape.length} OK`);
            gmailLinks = gmailLinks.map(pl => scraped.has(pl.gmailId) ? { ...pl, ...scraped.get(pl.gmailId) } : pl);
            return { gmailLinks, gdtInvoices: gdt || [] };
          }),
          catchError(err => {
            addLog(`Scrape lỗi: ${err.message || err}`);
            return of({ gmailLinks, gdtInvoices: gdt || [] });
          })
        );
      }),
      takeUntil(this.destroy$),
      finalize(() => this.liveReconciling = false)
    ).subscribe({
      next: ({ gmailLinks, gdtInvoices }) => {
        // Filter by NCC MST if selected
        if (mst) {
          gmailLinks = gmailLinks.filter(pl => this._normalizeTaxCode(pl.supplierTaxCode) === this._normalizeTaxCode(mst));
          gdtInvoices = gdtInvoices.filter(inv => this._normalizeTaxCode(inv.nbmst) === this._normalizeTaxCode(mst));
        }

        // Filter Gmail by date range
        if (values.fromDate || values.toDate) {
          gmailLinks = gmailLinks.filter(pl => {
            const d = (pl.invoiceDate || pl.issueDate || '').split('T')[0];
            if (values.fromDate && d < values.fromDate) return false;
            if (values.toDate && d > values.toDate) return false;
            return true;
          });
        }

        this.liveGmailCount = gmailLinks.length;
        this.liveGdtCount = gdtInvoices.length;

        addLog(`Sau lọc: Gmail=${gmailLinks.length}, GDT=${gdtInvoices.length}`);
        addLog('Đang so khớp...');
        this._matchAndCompare(gmailLinks, gdtInvoices);
        addLog(`Hoàn tất: ${this.liveResults.length} kết quả`);
      },
      error: (err) => {
        console.error('❌ Live reconciliation error:', err);
        alert('Lỗi đối chiếu: ' + (err.message || err));
      }
    });
  }

  private _matchAndCompare(gmailLinks: PortalLink[], gdtInvoices: HddtInvoice[]): void {
    // Build maps with normalized keys
    const gmailMap = new Map<string, PortalLink>();
    for (const pl of gmailLinks) {
      const key = this._makeMatchKey(pl.invoiceNo, pl.supplierTaxCode);
      console.log(`[Gmail] raw="${pl.invoiceNo}" taxCode="${pl.supplierTaxCode}" → key="${key}"`);
      if (key && key !== '|') gmailMap.set(key, pl);
      else console.warn(`[Gmail] SKIPPED (empty key): invoiceNo="${pl.invoiceNo}" from="${pl.gmailFrom}"`);
    }

    const gdtMap = new Map<string, HddtInvoice>();
    for (const inv of gdtInvoices) {
      const key = this._makeMatchKey(String(inv.shdon), inv.nbmst);
      console.log(`[GDT]   raw="${inv.shdon}" taxCode="${inv.nbmst}" → key="${key}"`);
      if (key && key !== '|') gdtMap.set(key, inv);
      else console.warn(`[GDT]   SKIPPED (empty key): shdon="${inv.shdon}"`);
    }

    console.log(`[Reconcile] Gmail keys (${gmailMap.size}):`, [...gmailMap.keys()]);
    console.log(`[Reconcile] GDT keys   (${gdtMap.size}):`, [...gdtMap.keys()]);

    // Resolve Gmail entries with empty taxCode: find matching GDT key by invoiceNo only
    const resolvedGmailMap = new Map<string, PortalLink>();
    for (const [key, pl] of gmailMap) {
      if (key.endsWith('|')) {
        const noOnly = key.slice(0, -1);
        const gdtKey = [...gdtMap.keys()].find(k => k.startsWith(noOnly + '|'));
        if (gdtKey) {
          console.log(`[Reconcile] Gmail "${key}" → resolved to GDT key "${gdtKey}"`);
          resolvedGmailMap.set(gdtKey, pl);
        } else {
          resolvedGmailMap.set(key, pl);
        }
      } else {
        resolvedGmailMap.set(key, pl);
      }
    }
    console.log(`[Reconcile] Resolved Gmail keys:`, [...resolvedGmailMap.keys()]);

    const allKeys = new Set([...resolvedGmailMap.keys(), ...gdtMap.keys()]);
    const results: LiveReconcileRow[] = [];
    const summary = { total: 0, matched: 0, missingGmail: 0, missingGdt: 0, mismatch: 0, noAmount: 0 };

    for (const key of allKeys) {
      const gm = resolvedGmailMap.get(key);
      const gdt = gdtMap.get(key);
      summary.total++;

      const row: LiveReconcileRow = {
        invoiceKey: gdt ? `${gdt.khhdon}-${gdt.shdon}` : (gm?.invoiceNo || key),
        matchKey: key,
        status: 'MATCH',
        fieldDiffs: [],
      };

      if (gm) {
        row.gmailData = {
          invoiceNo: gm.invoiceNo || '',
          invoiceSymbol: gm.invoiceSymbol || '',
          supplierTaxCode: gm.supplierTaxCode || '',
          supplierName: gm.supplierName || '',
          totalBeforeVat: gm.totalBeforeVat || 0,
          vatAmount: gm.vatAmount || 0,
          totalAmount: gm.totalAmount || 0,
          invoiceDate: gm.invoiceDate || gm.issueDate || '',
          parseSource: gm.parseSource || 'none',
        };
      }

      if (gdt) {
        row.gdtData = {
          shdon: gdt.shdon,
          khhdon: gdt.khhdon,
          nbmst: gdt.nbmst,
          nbten: gdt.nbten,
          tgtcthue: gdt.tgtcthue,
          tgtthue: gdt.tgtthue,
          tgtttbso: gdt.tgtttbso,
          tdlap: gdt.tdlap,
        };
      }

      if (gm && gdt) {
        if (!gm.hasAmounts) {
          row.status = 'NO_AMOUNT';
          summary.noAmount++;
        } else {
          const diffs = this._compareAmounts(gm, gdt);
          if (diffs.length > 0) {
            row.status = 'MISMATCH';
            row.fieldDiffs = diffs;
            summary.mismatch++;
          } else {
            summary.matched++;
          }
        }
      } else if (!gm) {
        row.status = 'MISSING_GMAIL';
        summary.missingGmail++;
      } else {
        row.status = 'MISSING_GDT';
        summary.missingGdt++;
      }

      results.push(row);
    }

    // Sort: MISMATCH first, then MISSING, then MATCH
    const statusOrder: Record<string, number> = { 'MISMATCH': 0, 'MISSING_GMAIL': 1, 'MISSING_GDT': 2, 'NO_AMOUNT': 3, 'MATCH': 4 };
    results.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

    this.liveResults = results;
    this.liveSummary = summary;
    console.log('⚖️ Live reconciliation done:', summary);
  }

  private _makeMatchKey(invoiceNo: string, taxCode: string): string {
    const normalNo = this._normalizeInvoiceNo(invoiceNo);
    const normalTax = this._normalizeTaxCode(taxCode);
    return `${normalNo}|${normalTax}`;
  }

  private _normalizeInvoiceNo(no: string): string {
    if (!no) return '';
    // If format is "SYMBOL-NUMBER" (e.g. "1C26TAA-00038308"), extract part after last hyphen
    const parts = no.split('-');
    const lastPart = parts[parts.length - 1];
    const candidate = lastPart.replace(/\D/g, '');
    if (candidate) {
      const num = parseInt(candidate, 10);
      if (!isNaN(num)) return String(num);
    }
    // Fallback: strip all non-digits
    const num = parseInt(no.replace(/\D/g, ''), 10);
    return isNaN(num) ? no.trim().toLowerCase() : String(num);
  }

  private _normalizeTaxCode(taxCode: string): string {
    if (!taxCode) return '';
    // Strip branch suffix like -001
    return taxCode.replace(/-\d+$/, '').trim();
  }

  private _compareAmounts(gm: PortalLink, gdt: HddtInvoice): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const tolerance = 1;

    // Only compare if gmail has parsed amounts
    if (!gm.hasAmounts) return [];

    const fields: [string, string, number, number][] = [
      ['Tổng tiền trước thuế', 'totalBeforeVat', gm.totalBeforeVat || 0, gdt.tgtcthue || 0],
      ['Tiền thuế GTGT', 'vatAmount', gm.vatAmount || 0, gdt.tgtthue || 0],
      ['Tổng tiền thanh toán', 'totalAmount', gm.totalAmount || 0, gdt.tgtttbso || 0],
    ];

    for (const [label, field, gmVal, gdtVal] of fields) {
      if (Math.abs(gmVal - gdtVal) > tolerance) {
        diffs.push({
          field,
          fieldLabel: label,
          taxValue: gdtVal,
          internalValue: gmVal,
          diff: gmVal - gdtVal,
          diffType: 'number',
        });
      }
    }

    return diffs;
  }

  saveLiveResults(): void {
    if (this.liveResults.length === 0) return;

    this.liveSaving = true;
    this.invoiceService.saveLiveReconciliation(this.liveResults)
      .pipe(takeUntil(this.destroy$), finalize(() => this.liveSaving = false))
      .subscribe({
        next: (res) => {
          this.liveSaved = true;
          console.log('💾 Saved live reconciliation:', res.saved);
        },
        error: (err) => {
          console.error('❌ Save error:', err);
          alert('Lỗi lưu kết quả: ' + (err.message || err));
        }
      });
  }

  getLiveStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'MATCH': 'Khớp',
      'MISMATCH': 'Sai số',
      'MISSING_GMAIL': 'Thiếu Gmail',
      'MISSING_GDT': 'Thiếu GDT',
      'NO_AMOUNT': 'Chưa có số liệu',
    };
    return labels[status] || status;
  }

  getLiveStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'MATCH': 'live-match',
      'MISMATCH': 'live-mismatch',
      'MISSING_GMAIL': 'live-missing',
      'MISSING_GDT': 'live-missing',
      'NO_AMOUNT': 'live-no-amount',
    };
    return classes[status] || '';
  }

  formatGdtDate(tdlap: string): string {
    if (!tdlap) return '';
    try {
      const d = new Date(tdlap);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return tdlap;
    }
  }
}
