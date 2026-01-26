/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SUPPLIER SERVICE - DANH MỤC NHÀ CUNG CẤP
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, map, delay } from 'rxjs';
import {
  Supplier,
  SupplierType,
  SupplierGroup,
  SupplierStatus,
  SupplierFilter,
  generateSupplierCode,
  validateSupplier
} from '../models/supplier.models';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {

  private suppliersSubject = new BehaviorSubject<Supplier[]>([]);
  public suppliers$ = this.suppliersSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.loadDemoData();
  }

  private loadDemoData(): void {
    const demoSuppliers: Supplier[] = [
      {
        id: 'SUP-001',
        code: 'NCC0001',
        name: 'Công ty CP Lương Thực Miền Nam',
        shortName: 'LTMN',
        supplierType: 'MANUFACTURER',
        supplierGroup: 'GOODS',
        taxCode: '0301234567',
        legalRepresentative: 'Trần Văn A',
        address: '100 Điện Biên Phủ',
        district: 'Quận 1',
        province: 'TP. Hồ Chí Minh',
        phone: '028-3823-1234',
        email: 'sales@ltmn.com.vn',
        website: 'www.ltmn.com.vn',
        contacts: [
          { name: 'Nguyễn Thị B', position: 'Phòng Kinh doanh', phone: '0903456789', email: 'b.nguyen@ltmn.com.vn' }
        ],
        bankAccounts: [
          { bankName: 'Vietcombank', accountNumber: '0071000123456', accountHolder: 'CONG TY CP LUONG THUC MIEN NAM', branch: 'CN Quận 1' }
        ],
        paymentTermDays: 30,
        creditLimit: 1000000000,
        accountCode: '331',
        status: 'ACTIVE',
        note: 'NCC chính cung cấp gạo, lương thực',
        createdAt: new Date('2024-01-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-06-01')
      },
      {
        id: 'SUP-002',
        code: 'NCC0002',
        name: 'Công ty TNHH Dầu Thực Vật',
        shortName: 'DTV',
        supplierType: 'MANUFACTURER',
        supplierGroup: 'GOODS',
        taxCode: '0312456789',
        address: '55 Trường Chinh',
        district: 'Tân Bình',
        province: 'TP. Hồ Chí Minh',
        phone: '028-3844-5678',
        email: 'order@dtv.vn',
        contacts: [],
        bankAccounts: [],
        paymentTermDays: 45,
        accountCode: '331',
        status: 'ACTIVE',
        createdAt: new Date('2024-02-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-02-01')
      },
      {
        id: 'SUP-003',
        code: 'NCC0003',
        name: 'Công ty Điện Lực TP.HCM',
        shortName: 'EVN HCM',
        supplierType: 'SERVICE',
        supplierGroup: 'UTILITY',
        taxCode: '0300123456',
        address: '35 Tôn Đức Thắng',
        district: 'Quận 1',
        province: 'TP. Hồ Chí Minh',
        phone: '1900 545454',
        email: 'cskh@evnhcmc.vn',
        website: 'www.evnhcmc.vn',
        contacts: [],
        bankAccounts: [],
        paymentTermDays: 15,
        accountCode: '331',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-15'),
        createdBy: 'admin',
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'SUP-004',
        code: 'NCC0004',
        name: 'Công ty CP Vinamilk',
        shortName: 'Vinamilk',
        supplierType: 'MANUFACTURER',
        supplierGroup: 'GOODS',
        taxCode: '0300588772',
        address: '10 Tân Trào',
        district: 'Quận 7',
        province: 'TP. Hồ Chí Minh',
        phone: '028-5415-5555',
        email: 'order@vinamilk.com.vn',
        website: 'www.vinamilk.com.vn',
        contacts: [],
        bankAccounts: [],
        paymentTermDays: 30,
        creditLimit: 500000000,
        accountCode: '331',
        status: 'ACTIVE',
        createdAt: new Date('2024-03-01'),
        createdBy: 'admin',
        updatedAt: new Date('2024-03-01')
      },
      {
        id: 'SUP-005',
        code: 'NCC0005',
        name: 'Công ty TNHH Vận Tải ABC',
        shortName: 'VT ABC',
        supplierType: 'SERVICE',
        supplierGroup: 'SERVICE',
        taxCode: '0309876543',
        address: '200 Nguyễn Văn Linh',
        district: 'Quận 7',
        province: 'TP. Hồ Chí Minh',
        phone: '028-3773-9999',
        contacts: [],
        bankAccounts: [],
        paymentTermDays: 15,
        accountCode: '331',
        status: 'INACTIVE',
        note: 'Tạm ngừng hợp tác',
        createdAt: new Date('2024-02-15'),
        createdBy: 'admin',
        updatedAt: new Date('2024-11-01')
      }
    ];

    this.suppliersSubject.next(demoSuppliers);
  }

  // CRUD Operations
  getSuppliers(filter?: SupplierFilter): Observable<Supplier[]> {
    return this.suppliers$.pipe(
      map(suppliers => {
        if (!filter) return suppliers;
        return suppliers.filter(s => {
          if (filter.search) {
            const keyword = filter.search.toLowerCase();
            const fields = [s.code, s.name, s.shortName || '', s.taxCode || '', s.phone || ''].join(' ').toLowerCase();
            if (!fields.includes(keyword)) return false;
          }
          if (filter.supplierType && s.supplierType !== filter.supplierType) return false;
          if (filter.supplierGroup && s.supplierGroup !== filter.supplierGroup) return false;
          if (filter.status && s.status !== filter.status) return false;
          return true;
        });
      })
    );
  }

  getSupplierById(id: string): Observable<Supplier | undefined> {
    return this.suppliers$.pipe(map(suppliers => suppliers.find(s => s.id === id)));
  }

  getSupplierByCode(code: string): Observable<Supplier | undefined> {
    return this.suppliers$.pipe(map(suppliers => suppliers.find(s => s.code === code)));
  }

  createSupplier(supplier: Partial<Supplier>): Observable<Supplier> {
    const errors = validateSupplier(supplier);
    if (errors.length > 0) throw new Error(errors.join(', '));

    const suppliers = this.suppliersSubject.value;
    if (suppliers.some(s => s.code === supplier.code)) {
      throw new Error('Mã NCC đã tồn tại');
    }

    const now = new Date();
    const newSupplier: Supplier = {
      id: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
      code: supplier.code!,
      name: supplier.name!,
      shortName: supplier.shortName,
      supplierType: supplier.supplierType || 'OTHER',
      supplierGroup: supplier.supplierGroup || 'OTHER',
      taxCode: supplier.taxCode,
      businessLicense: supplier.businessLicense,
      legalRepresentative: supplier.legalRepresentative,
      address: supplier.address!,
      ward: supplier.ward,
      district: supplier.district,
      province: supplier.province,
      country: supplier.country,
      phone: supplier.phone,
      fax: supplier.fax,
      email: supplier.email,
      website: supplier.website,
      contacts: supplier.contacts || [],
      bankAccounts: supplier.bankAccounts || [],
      paymentTermDays: supplier.paymentTermDays || 0,
      creditLimit: supplier.creditLimit,
      accountCode: supplier.accountCode || '331',
      status: supplier.status || 'ACTIVE',
      note: supplier.note,
      createdAt: now,
      createdBy: 'admin',
      updatedAt: now
    };

    this.suppliersSubject.next([...suppliers, newSupplier]);
    return of(newSupplier).pipe(delay(300));
  }

  updateSupplier(id: string, updates: Partial<Supplier>): Observable<Supplier> {
    const suppliers = this.suppliersSubject.value;
    const index = suppliers.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Không tìm thấy NCC');

    if (updates.code && updates.code !== suppliers[index].code) {
      if (suppliers.some(s => s.code === updates.code && s.id !== id)) {
        throw new Error('Mã NCC đã tồn tại');
      }
    }

    const updated: Supplier = {
      ...suppliers[index],
      ...updates,
      updatedAt: new Date(),
      updatedBy: 'admin'
    };

    suppliers[index] = updated;
    this.suppliersSubject.next([...suppliers]);
    return of(updated).pipe(delay(300));
  }

  deleteSupplier(id: string): Observable<boolean> {
    const suppliers = this.suppliersSubject.value;
    if (!suppliers.find(s => s.id === id)) throw new Error('Không tìm thấy NCC');
    this.suppliersSubject.next(suppliers.filter(s => s.id !== id));
    return of(true).pipe(delay(300));
  }

  // Utilities
  getNextSupplierCode(): Observable<string> {
    return this.suppliers$.pipe(
      map(suppliers => {
        const maxNum = suppliers.reduce((max, s) => {
          const num = parseInt(s.code.replace('NCC', ''), 10);
          return num > max ? num : max;
        }, 0);
        return generateSupplierCode(maxNum + 1);
      })
    );
  }

  getSupplierDropdown(): Observable<{ id: string; code: string; name: string }[]> {
    return this.suppliers$.pipe(
      map(suppliers =>
        suppliers
          .filter(s => s.status === 'ACTIVE')
          .map(s => ({ id: s.id, code: s.code, name: s.name }))
      )
    );
  }

  getCountByGroup(): Observable<Record<SupplierGroup, number>> {
    return this.suppliers$.pipe(
      map(suppliers => {
        const counts: Record<SupplierGroup, number> = {
          GOODS: 0, MATERIAL: 0, ASSET: 0, SERVICE: 0, UTILITY: 0, OTHER: 0
        };
        suppliers.forEach(s => {
          if (s.status === 'ACTIVE') counts[s.supplierGroup]++;
        });
        return counts;
      })
    );
  }
}
