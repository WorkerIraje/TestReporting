// Report documents and shared report assets. A report document is the neutral description of a
// report (cover, summary, index, items, sign-off) that the PDF, DOCX and HTML renderers draw;
// this file builds the test case document, enhancement-model.js the enhancement one.

import { SEVERITY, APP } from '../core/config.js';
import { testId, formatDate, isBlank } from '../core/util.js';
import { fetchBinary } from '../core/loader.js';

const STATUS_TONE = { Pass: 'pass', Fail: 'fail', Blocked: 'blocked' };
const statusTone = (status) => STATUS_TONE[status] || 'none';
const sevTone = (severity) => (SEVERITY.includes(severity) ? severity.toLowerCase() : null);

/** Shared head of every report document. */
export function documentHead({ title, subtitle, report, meta, keywords, now }) {
  const generatedAt = now;
  return {
    title,
    subtitle,
    report,
    author: report.preparedBy || 'Iraje Software',
    keywords,
    appName: APP.name,
    generatedAt,
    generatedLabel: formatDate(generatedAt, true),
    coverFallback: 'Iraje Software · Quality Assurance',
    meta: meta.map(([label, value]) => [label, isBlank(value) ? '—' : String(value)]),
  };
}

export function buildTestCaseDocument(store, { scope = 'all', layout = 'page', now = new Date() } = {}) {
  const all = store.state.cases.map((c, i) => ({ ...c, tid: testId(i), index: i }));
  const cases = scope === 'defects' ? all.filter((c) => c.status === 'Fail' || c.status === 'Blocked') : all;
  const s = store.stats(all);
  const r = store.state.report;
  const product = r.product?.trim() || '';
  const title = r.title?.trim() || `${product ? `${product} ` : ''}${scope === 'defects' ? 'Defect Report' : 'Test Execution Report'}`;
  const ofTotal = (n) => (s.total ? `${pct(n / s.total)} of total` : '—');
  const bar = [
    { label: 'Pass', value: s.pass, tone: 'pass' },
    { label: 'Fail', value: s.fail, tone: 'fail' },
    { label: 'Blocked', value: s.blocked, tone: 'blocked' },
    { label: 'Not run', value: s.notRun, tone: 'notrun' },
  ];
  const colored = (n, t) => ({ v: n, tone: n ? t : null });

  return {
    ...documentHead({
      title,
      subtitle: scope === 'defects' ? 'Defect report · Fail and Blocked test cases' : 'Test execution report',
      report: r,
      keywords: 'Iraje, QA, test report',
      now,
      meta: [
        ['Product', product],
        ['Build / Version', r.build],
        ['Environment', r.environment],
        ['Test Cycle', r.cycle],
        ['Prepared By', r.preparedBy],
        ['Reviewed By', r.reviewedBy],
        ['Report Date', r.date ? formatDate(r.date) : formatDate(now)],
        ['Test Cases in Report', `${cases.length.toLocaleString()}${scope === 'defects' ? ` of ${all.length.toLocaleString()}` : ''}`],
      ],
    }),
    scope,
    layout,
    noun: { one: 'test case', many: 'test cases' },
    headerLine: [product, r.build && `Build ${r.build}`, r.environment].filter(Boolean).join('  ·  '),
    productParts: [product, r.build && `Build ${r.build}`].filter(Boolean),
    glance: {
      label: 'Results at a glance',
      hero: { label: 'Pass rate', value: pct(s.passRate), sub: `${s.executed} of ${s.total} executed` },
      tiles: [
        { label: 'Pass', value: s.pass, sub: ofTotal(s.pass), tone: 'pass' },
        { label: 'Fail', value: s.fail, sub: ofTotal(s.fail), tone: 'fail' },
        { label: 'Blocked', value: s.blocked, sub: ofTotal(s.blocked), tone: 'blocked' },
        { label: 'Not run', value: s.notRun, sub: ofTotal(s.notRun), tone: 'none' },
      ],
      bar,
    },
    summary: {
      title: 'Executive summary',
      kpis: [
        { label: 'Total', value: s.total, tone: 'navy' },
        { label: 'Executed', value: s.executed, tone: 'navy' },
        { label: 'Pass', value: s.pass, tone: 'pass' },
        { label: 'Fail', value: s.fail, tone: 'fail' },
        { label: 'Blocked', value: s.blocked, tone: 'blocked' },
        { label: 'Pass rate', value: pct(s.passRate), tone: 'blue', highlight: true },
      ],
      barLabel: 'Status split',
      bar,
      tables: [
        {
          title: 'Module-wise progress',
          half: true,
          cols: [{ head: 'Module / Feature' }, { head: 'Total', w: 16, dxa: 1100, align: 'right' }, { head: 'Pass', w: 16, dxa: 1100, align: 'right' }, { head: 'Fail', w: 16, dxa: 1100, align: 'right' },
            { head: 'Blocked', w: 18, dxa: 1100, align: 'right' }, { head: 'Not run', w: 18, dxa: 1100, align: 'right' }, { head: 'Pass rate', w: 22, dxa: 1100, align: 'right', bold: true }],
          rows: moduleBreakdown(all).map((m) => [m.name, m.total, colored(m.pass, 'pass'), colored(m.fail, 'fail'), colored(m.blocked, 'blocked'), m.notRun,
            m.executed ? pct(m.passRate) : '—']),
        },
        {
          title: 'Open issues by severity (Fail + Blocked)',
          half: true,
          cols: [{ head: 'Severity' }, { head: 'Fail', w: 24, dxa: 1500, align: 'right' }, { head: 'Blocked', w: 24, dxa: 1500, align: 'right' }, { head: 'Total', w: 24, dxa: 1500, align: 'right', bold: true }],
          rows: severityBreakdown(all).map((x) => [{ v: x.name, tone: sevTone(x.name), bold: !!sevTone(x.name) }, x.fail, x.blocked, x.total]),
        },
      ],
    },
    index: {
      title: 'Test case index',
      cols: [{ head: 'ID', w: 17, dxa: 1100, bold: true, tone: 'blue' }, { head: 'Title / Description' }, { head: 'Module', w: 34, dxa: 2000 },
        { head: 'Status', w: 19, dxa: 1200 }, { head: 'Severity', w: 19, dxa: 1200 }, { head: 'Shots', w: 13, dxa: 800, align: 'right' }],
      rows: cases.map((c) => [c.tid, c.title || 'Untitled test case', c.module || '—',
        { v: c.status || 'Not run', tone: statusTone(c.status), bold: true, badge: true },
        { v: c.severity || '—', tone: sevTone(c.severity) }, c.images.length]),
    },
    items: cases.map((c) => ({
      id: c.tid,
      title: c.title,
      untitled: 'Untitled test case',
      badge: { text: c.status || 'Not run', tone: statusTone(c.status) },
      accent: statusTone(c.status),
      facts: [
        { label: 'Module / Feature', value: c.module },
        { label: 'Field / Control', value: c.field },
        { label: 'Test Type', value: c.type },
        { label: 'Account Type', value: c.account },
        { label: 'Severity', value: c.severity, tone: sevTone(c.severity) },
        { label: 'Tester', value: c.tester },
      ],
      factsPerRow: 3,
      sections: [
        c.pre ? { type: 'block', title: 'Preconditions', text: c.pre } : null,
        { type: 'block', title: 'Test steps', text: c.steps },
        c.data ? { type: 'block', title: 'Test data', text: c.data } : null,
        { type: 'compare', left: { title: 'Expected result', text: c.expected }, right: { title: 'Actual result', text: c.actual }, tone: statusTone(c.status) },
        c.comments ? { type: 'block', title: 'Comments / Defect ID', text: c.comments } : null,
      ].filter(Boolean),
      images: c.images,
      evidenceLabel: 'Evidence',
      filterKey: c.status ? c.status.toLowerCase() : 'none',
      searchText: `${c.tid} ${c.title} ${c.module} ${c.field} ${c.steps} ${c.expected} ${c.actual} ${c.comments}`.toLowerCase(),
    })),
    filters: [{ key: 'all', label: 'All' }, { key: 'pass', label: 'Pass' }, { key: 'fail', label: 'Fail' }, { key: 'blocked', label: 'Blocked' }, { key: 'none', label: 'Not run' }],
    searchPlaceholder: 'Search test cases…',
    signoff: null,
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
