import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CompanyInfo {
  name: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  representative: string;
  position: string;
  accountant: string;
  bankAccount: string;
  bankName: string;
}

interface SystemConfig {
  fiscalYearStart: number;
  defaultCurrency: string;
  decimalPlaces: number;
  dateFormat: string;
  autoNumbering: boolean;
  requireApproval: boolean;
  allowNegativeStock: boolean;
  defaultVATRate: number;
  costingMethod: string;
}

@Component({
  selector: 'app-system-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-settings-page.component.html',
  styleUrl: './system-settings-page.component.css'
})
export class SystemSettingsPageComponent implements OnInit {
  activeSection: string = 'company';

  sections = [
    { id: 'company', name: 'Thông tin công ty', icon: '🏢' },
    { id: 'accounting', name: 'Cài đặt kế toán', icon: '📊' },
    { id: 'voucher', name: 'Chứng từ', icon: '📋' },
    { id: 'notification', name: 'Thông báo', icon: '🔔' },
    { id: 'backup', name: 'Sao lưu & Khôi phục', icon: '💾' }
  ];

  companyInfo: CompanyInfo = {
    name: 'CÔNG TY TNHH TẠP HÓA 39',
    taxCode: '0123456789',
    address: '39 Nguyễn Huệ, Phường 1, Quận 1, TP.HCM',
    phone: '028 1234 5678',
    email: 'ketoan@taphoa39.vn',
    website: 'www.taphoa39.vn',
    representative: 'Nguyễn Văn A',
    position: 'Giám đốc',
    accountant: 'Trần Thị B',
    bankAccount: '1234567890',
    bankName: 'Vietcombank - Chi nhánh HCM'
  };

  systemConfig: SystemConfig = {
    fiscalYearStart: 1,
    defaultCurrency: 'VND',
    decimalPlaces: 0,
    dateFormat: 'DD/MM/YYYY',
    autoNumbering: true,
    requireApproval: true,
    allowNegativeStock: false,
    defaultVATRate: 10,
    costingMethod: 'AVERAGE'
  };

  voucherPrefixes = [
    { type: 'Phiếu thu', prefix: 'PT', lastNumber: 125 },
    { type: 'Phiếu chi', prefix: 'PC', lastNumber: 98 },
    { type: 'Phiếu nhập kho', prefix: 'PNK', lastNumber: 56 },
    { type: 'Phiếu xuất kho', prefix: 'PXK', lastNumber: 78 },
    { type: 'Hóa đơn bán', prefix: 'HDB', lastNumber: 234 },
    { type: 'Hóa đơn mua', prefix: 'HDM', lastNumber: 45 }
  ];

  ngOnInit(): void {}

  saveCompanyInfo(): void {
    alert('Đã lưu thông tin công ty');
  }

  saveSystemConfig(): void {
    alert('Đã lưu cài đặt hệ thống');
  }

  backupData(): void {
    alert('Đang tạo bản sao lưu...\n\nTính năng đang phát triển');
  }

  restoreData(): void {
    alert('Tính năng khôi phục đang phát triển');
  }
}
