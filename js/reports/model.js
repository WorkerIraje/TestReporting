// Shared report model used by the PDF, DOCX and HTML generators and the Reporting tab.

import { SEVERITY, APP } from '../core/config.js';
import { testId, formatDate, isBlank } from '../core/util.js';
import { fetchBinary } from '../core/loader.js';

export function buildModel(store, { scope = 'all', layout = 'page' } = {}) {
  const all = store.state.cases.map((c, i) => ({ ...c, tid: testId(i), index: i }));
  const cases = scope === 'defects' ? all.filter((c) => c.status === 'Fail' || c.status === 'Blocked') : all;
  const stats = store.stats(all);
  const r = store.state.report;
  const product = r.product?.trim() || '';
  const title = r.title?.trim() || `${product ? `${product} ` : ''}${scope === 'defects' ? 'Defect Report' : 'Test Execution Report'}`;
  const generatedAt = new Date();
  return {
    title,
    subtitle: scope === 'defects' ? 'Defect report · Fail and Blocked test cases' : 'Test execution report',
    scope,
    layout,
    meta: [
      ['Product', product],
      ['Build / Version', r.build],
      ['Environment', r.environment],
      ['Test Cycle', r.cycle],
      ['Prepared By', r.preparedBy],
      ['Reviewed By', r.reviewedBy],
      ['Report Date', r.date ? formatDate(r.date) : formatDate(generatedAt)],
      ['Test Cases in Report', `${cases.length.toLocaleString()}${scope === 'defects' ? ` of ${all.length.toLocaleString()}` : ''}`],
    ].map(([label, value]) => [label, isBlank(value) ? '—' : String(value)]),
    report: r,
    stats,
    modules: moduleBreakdown(all),
    severity: severityBreakdown(all),
    cases,
    all,
    imageCount: cases.reduce((n, c) => n + c.images.length, 0),
    generatedAt,
    generatedLabel: formatDate(generatedAt, true),
    appName: APP.name,
  };
}

export function moduleBreakdown(cases) {
  const map = new Map();
  for (const c of cases) {
    const name = c.module?.trim() || '(No module)';
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, { name, total: 0, pass: 0, fail: 0, blocked: 0, notRun: 0 });
    const m = map.get(key);
    m.total++;
    if (c.status === 'Pass') m.pass++;
    else if (c.status === 'Fail') m.fail++;
    else if (c.status === 'Blocked') m.blocked++;
    else m.notRun++;
  }
  return [...map.values()].map((m) => {
    const executed = m.pass + m.fail + m.blocked;
    return { ...m, executed, passRate: executed ? m.pass / executed : 0 };
  }).sort((a, b) => b.total - a.total);
}

export function severityBreakdown(cases) {
  const rows = [...SEVERITY, 'Not set'].map((name) => ({ name, fail: 0, blocked: 0, total: 0 }));
  for (const c of cases) {
    if (c.status !== 'Fail' && c.status !== 'Blocked') continue;
    const row = rows.find((x) => x.name === c.severity) || rows[rows.length - 1];
    if (c.status === 'Fail') row.fail++;
    else row.blocked++;
    row.total++;
  }
  return rows;
}

export const pct = (x) => `${(x * 100).toFixed(x === 0 || x === 1 ? 0 : 1)}%`;

export const STATUS_COLORS = {
  Pass: '#15803D',
  Fail: '#D92D20',
  Blocked: '#C4560C',
  '': '#5B6680',
};
export const SEVERITY_COLORS = { Critical: '#9F1239', High: '#D92D20', Medium: '#C77700', Low: '#0E7490' };

// ---- shared assets (logo, watermark) ----

let logoCache = null;

/** Iraje logo as bytes + data URL + intrinsic size. */
export async function loadLogo() {
  if (logoCache) return logoCache;
  const buf = await fetchBinary(APP.logoUrl);
  const bytes = new Uint8Array(buf);
  const blob = new Blob([bytes], { type: 'image/png' });
  const bmp = await createImageBitmap(blob);
  const dataUrl = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
  logoCache = { bytes, dataUrl, w: bmp.width, h: bmp.height };
  bmp.close?.();
  return logoCache;
}

/** Faint diagonal "Iraje Software" watermark rendered to a transparent PNG. */
export async function watermarkPng({ width = 1400, height = 1800, text = 'Iraje Software', alpha = 0.07 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  await document.fonts?.load?.('600 120px Poppins').catch(() => {});
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.atan2(height, width));
  ctx.font = '600 150px Poppins, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = `rgba(4, 81, 204, ${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Loads a screenshot for embedding: bytes, format and pixel size. */
export async function loadShot(store, id) {
  const rec = await store.imageRecord(id);
  if (!rec) return null;
  const bytes = new Uint8Array(await rec.blob.arrayBuffer());
  return { bytes, blob: rec.blob, format: rec.type === 'image/jpeg' ? 'JPEG' : 'PNG', w: rec.w, h: rec.h, name: rec.name };
}
