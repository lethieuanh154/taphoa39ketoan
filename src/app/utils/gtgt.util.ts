/**
 * 01/GTGT: [22] (thuế còn được khấu trừ kỳ trước, kế toán nhập) → [40a] [40] [41] [43] — như doi_soat.compute_tax.
 * Dùng chung: trang Số liệu khai thuế + trang Tổng quan. [22] kế toán nhập lưu localStorage `ketoan_v22_<mã lần đối soát>`.
 */
export const V22_KEY = 'ketoan_v22_';

export function recalcGtgt(tk: { [code: string]: number }, v22: number): { [code: string]: number } {
  const base = { ...tk };
  const n = (c: string) => Number(base[c] || 0);
  base['22'] = Math.round(v22 || 0);
  const x = n('36') - base['22'] + n('37') - n('38') - n('39a');
  base['40a'] = x > 0 ? x : 0;
  base['40'] = base['40a'] - n('40b');
  base['41'] = x < 0 ? -x : 0;
  base['43'] = base['41'] - n('42');
  return base;
}

/** [22] kế toán đã nhập cho lần đối soát (null = chưa nhập → dùng [22] trong XML tờ khai kỳ trước nếu có) */
export function savedV22(runId: string): number | null {
  try {
    const v = localStorage.getItem(V22_KEY + runId);
    return v === null || !Number.isFinite(Number(v)) ? null : Number(v);
  } catch {
    return null;
  }
}
