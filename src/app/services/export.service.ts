/**
 * Export & Print Service for Accounting Ledgers
 * Handles export to PDF, Excel, and printing with proper month/year information
 */
import { Injectable } from '@angular/core';
import { FilterService } from './filter.service';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  constructor(private filterService: FilterService) {}

  /**
   * Export data to CSV format
   */
  exportToCSV<T extends { [key: string]: any }>(
    data: T[],
    fileName: string,
    columns: { key: string; header: string; nestedKey?: string }[]
  ): void {
    const filter = this.filterService.getFilter();
    const csv = this.generateCSV(data, columns, filter);
    this.downloadFile(csv, `${fileName}_${filter.month}_${filter.year}.csv`, 'text/csv');
  }

  /**
   * Export data to JSON format
   */
  exportToJSON<T extends { [key: string]: any }>(
    data: T[],
    fileName: string
  ): void {
    const filter = this.filterService.getFilter();
    const metadata = {
      ledgerName: fileName,
      month: filter.month,
      year: filter.year,
      exportDate: new Date().toISOString(),
      recordCount: data.length,
    };

    const payload = {
      metadata,
      data,
    };

    const json = JSON.stringify(payload, null, 2);
    this.downloadFile(json, `${fileName}_${filter.month}_${filter.year}.json`, 'application/json');
  }

  /**
   * Prepare data for printing (adds header with month/year info)
   */
  printData<T extends { [key: string]: any }>(
    data: T[],
    ledgerTitle: string
  ): void {
    const filter = this.filterService.getFilter();
    const printWindow = window.open('', '', 'height=600,width=900');

    if (!printWindow) {
      alert('Không thể mở cửa sổ in. Vui lòng kiểm tra bộ chặn pop-up.');
      return;
    }

    const htmlContent = this.generatePrintHTML(data, ledgerTitle, filter);
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Trigger print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  /**
   * Generate CSV content
   */
  private generateCSV<T extends { [key: string]: any }>(
    data: T[],
    columns: { key: string; header: string; nestedKey?: string }[],
    filter: any
  ): string {
    const filter_header = `Tháng ${filter.month}, Năm ${filter.year}\n\n`;
    
    // Header row
    const headerRow = columns.map(c => `"${c.header}"`).join(',');
    
    // Data rows
    const dataRows = data.map(row =>
      columns
        .map(col => {
          let value = col.nestedKey ? row[col.key]?.[col.nestedKey] : row[col.key];
          // Escape quotes and wrap in quotes if needed
          if (value === null || value === undefined) return '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return [filter_header, headerRow, ...dataRows].join('\n');
  }

  /**
   * Generate print-friendly HTML
   */
  private generatePrintHTML<T extends { [key: string]: any }>(
    data: T[],
    ledgerTitle: string,
    filter: any
  ): string {
    const filter_info = `Tháng ${filter.month}, Năm ${filter.year}`;
    const exportTime = new Date().toLocaleString('vi-VN');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${ledgerTitle} - ${filter_info}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            padding: 20px;
            background: white;
          }
          
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .header h1 {
            font-size: 16px;
            font-weight: 600;
            text-transform: uppercase;
            color: #1976d2;
            margin-bottom: 8px;
          }
          
          .header p {
            font-size: 13px;
            color: #666;
            margin: 4px 0;
          }
          
          .export-info {
            text-align: right;
            font-size: 11px;
            color: #999;
            margin-bottom: 16px;
            border-top: 1px solid #ddd;
            padding-top: 8px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          th {
            background-color: #1976d2;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            border: 1px solid #1565c0;
          }
          
          td {
            padding: 6px 8px;
            border: 1px solid #ddd;
            font-size: 12px;
          }
          
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          
          .number {
            text-align: right;
            font-family: 'Roboto Mono', monospace;
          }
          
          .footer-note {
            font-size: 10px;
            color: #999;
            text-align: center;
            margin-top: 20px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
          }
          
          @media print {
            body {
              padding: 0;
              background: white;
            }
            
            .export-info {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${ledgerTitle}</h1>
          <p><strong>${filter_info}</strong></p>
          <p>Theo Thông tư 88/2021/TT-BTC</p>
        </div>
        
        <div class="export-info">
          Xuất lúc: ${exportTime}<br>
          Số bản ghi: ${data.length}
        </div>
        
        <p style="text-align: center; margin-bottom: 12px; font-weight: 500;">
          Tổng ${data.length} bút toán
        </p>
        
        <table>
          <thead>
            <tr>
              ${Object.keys(data[0] || {})
                .filter(key => key !== 'id')
                .map(key => `<th>${key}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                row => `
              <tr>
                ${Object.entries(row)
                  .filter(([key]) => key !== 'id')
                  .map(
                    ([, value]) => `
                  <td class="${typeof value === 'number' ? 'number' : ''}">
                    ${value === null || value === undefined ? '' : value}
                  </td>
                `
                  )
                  .join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="footer-note">
          <p>Tài liệu này được xuất từ hệ thống quản lý sổ kế toán hộ kinh doanh</p>
          <p>Chỉ là một tháng cho mỗi tài liệu để đảm bảo tính liên tục của kế toán</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Download file helper
   */
  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', fileName);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  /**
   * Generate print-ready table HTML for embedding
   */
  generateTableHTML<T extends { [key: string]: any }>(
    data: T[],
    columns: { key: string; header: string; nestedKey?: string }[],
    ledgerTitle: string
  ): string {
    const filter = this.filterService.getFilter();
    const headerRows = columns.map(c => `<th>${c.header}</th>`).join('');
    const dataRows = data
      .map(
        row =>
          `<tr>${columns
            .map(col => {
              const value = col.nestedKey ? row[col.key]?.[col.nestedKey] : row[col.key];
              const isNumber = typeof value === 'number';
              return `<td class="${isNumber ? 'number' : ''}">${value ?? ''}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');

    return `
      <div class="print-section">
        <h2>${ledgerTitle}</h2>
        <p class="print-period">Tháng ${filter.month}, Năm ${filter.year}</p>
        <table class="print-table">
          <thead>
            <tr>${headerRows}</tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
      </div>
    `;
  }
}
