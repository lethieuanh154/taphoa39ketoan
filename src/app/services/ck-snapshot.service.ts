import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReconSnapshotRow } from '../utils/transfer-reconcile.util';

/**
 * Bản lưu "CK nhiều lần" / "CK dư" do BanHang ghi (13/11/2026): nhân viên chạy Đối soát CK ở BanHang (có sao kê + HĐĐT) → Flask ghi
 * Firestore `bank_recon_snapshots` (project taphoa39-supplies-invoices, 1 doc / ngày bán) → KeToanBackEnd
 * GET /api/bank-reconciliation/ck-snapshots (chỉ đọc). KeToan đối soát bán ra theo XML nên không tự tách được 2 tab này.
 */
const LOG = '[CkSnapshot]';

export interface CkSnapshotDay {
  schema: string;
  day: string;
  multi: ReconSnapshotRow[];
  excess: ReconSnapshotRow[];
  multiCount: number;
  excessCount: number;
  runFrom: string;
  runTo: string;
  statementFiles: string[];
  bankCount: number;
  savedAt: string;     // giờ VN 'YYYY-MM-DDTHH:mm:ss.SSS'
}

export interface CkSnapshotRange { from: string; to: string; days: CkSnapshotDay[]; missing: string[]; }

@Injectable({ providedIn: 'root' })
export class CkSnapshotService {
  private http = inject(HttpClient);

  async load(from: string, to: string): Promise<CkSnapshotRange> {
    const t0 = performance.now();
    const params = new HttpParams().set('from', from).set('to', to);
    const r = await firstValueFrom(this.http.get<{ success: boolean } & CkSnapshotRange>(
      `${environment.ketoanBackendUrl}/api/bank-reconciliation/ck-snapshots`, { params }));
    console.info(`${LOG} ${from} → ${to}: ${r.days.length} ngày có bản lưu, thiếu ${r.missing.length} ngày `
      + `(${((performance.now() - t0) / 1000).toFixed(1)} giây)`);
    return { from: r.from, to: r.to, days: r.days || [], missing: r.missing || [] };
  }
}
