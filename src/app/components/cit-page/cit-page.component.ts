import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CITDeclaration {
  id: string;
  quarter: number;
  year: number;
  declarationNo: string;
  revenue: number;
  expenses: number;
  taxableIncome: number;
  taxRate: number;
  citAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'PAID';
  submissionDeadline: Date;
  createdAt: Date;
}

@Component({
  selector: 'app-cit-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cit-page.component.html',
  styleUrl: './cit-page.component.css'
})
export class CITPageComponent implements OnInit {
  declarations: CITDeclaration[] = [];
  filterYear: number;
  years: number[] = [];
  showDetailModal = false;
  selectedDeclaration: CITDeclaration | null = null;

  // Statistics
  yearStats = {
    totalRevenue: 0,
    totalExpenses: 0,
    totalTaxableIncome: 0,
    totalCIT: 0,
    paidCIT: 0
  };

  constructor() {
    const now = new Date();
    this.filterYear = now.getFullYear();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    this.loadDemoData();
    this.calculateStats();
  }

  loadDemoData(): void {
    this.declarations = [
      {
        id: 'CIT001',
        quarter: 4,
        year: 2025,
        declarationNo: 'TNDN-2025-Q4',
        revenue: 2500000000,
        expenses: 2100000000,
        taxableIncome: 400000000,
        taxRate: 20,
        citAmount: 80000000,
        status: 'PAID',
        submissionDeadline: new Date(2026, 0, 30),
        createdAt: new Date(2025, 11, 20)
      },
      {
        id: 'CIT002',
        quarter: 3,
        year: 2025,
        declarationNo: 'TNDN-2025-Q3',
        revenue: 2200000000,
        expenses: 1900000000,
        taxableIncome: 300000000,
        taxRate: 20,
        citAmount: 60000000,
        status: 'PAID',
        submissionDeadline: new Date(2025, 9, 30),
        createdAt: new Date(2025, 8, 25)
      }
    ];
  }

  calculateStats(): void {
    const yearData = this.declarations.filter(d => d.year === this.filterYear);
    this.yearStats = {
      totalRevenue: yearData.reduce((sum, d) => sum + d.revenue, 0),
      totalExpenses: yearData.reduce((sum, d) => sum + d.expenses, 0),
      totalTaxableIncome: yearData.reduce((sum, d) => sum + d.taxableIncome, 0),
      totalCIT: yearData.reduce((sum, d) => sum + d.citAmount, 0),
      paidCIT: yearData.filter(d => d.status === 'PAID').reduce((sum, d) => sum + d.citAmount, 0)
    };
  }

  onYearChange(): void {
    this.calculateStats();
  }

  viewDeclaration(dec: CITDeclaration): void {
    this.selectedDeclaration = dec;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedDeclaration = null;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getQuarterLabel(q: number): string {
    return `Quý ${q}`;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'DRAFT': 'Nháp',
      'SUBMITTED': 'Đã nộp',
      'PAID': 'Đã nộp thuế'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }
}
