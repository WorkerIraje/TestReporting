// Enhancement report document (drawn by the shared PDF / Word / HTML renderers) and the
// breakdowns the Summary tab shows: priority × status matrix, by module, by category.

import { formatDate } from '../core/util.js';
import { PRIORITY, ENH_STATUS, PROPOSED } from '../core/workspaces.js';
import { documentHead, pct } from './model.js';

const STATUSES = [PROPOSED, ...ENH_STATUS];
const STATUS_TONE = { [PROPOSED]: 'proposed', 'Under review': 'review', Approved: 'approved', Planned: 'planned', Done: 'done', Rejected: 'rejected' };

export const statusLabel = (status) => status || PROPOSED;
export const statusTone = (status) => STATUS_TONE[statusLabel(status)] || 'proposed';
export const priorityTone = (priority) => (PRIORITY.includes(priority) ? priority.toLowerCase() : null);

export const ENH_SCOPES = Object.freeze([
  { key: 'all', label: 'All requests', subtitle: 'Enhancement report', test: () => true },
  { key: 'high', label: 'Critical + High only', subtitle: 'High-priority enhancements · Critical and High', test: (c) => c.priority === 'Critical' || c.priority === 'High' },
  { key: 'approved', label: 'Approved + Planned only', subtitle: 'Approved and planned enhancements', test: (c) => c.status === 'Approved' || c.status === 'Planned' },
]);

/** Rows Critical…Low (plus "Not set" when used), counts per status (blank = Proposed). */
export function priorityStatusMatrix(items) {
  const rows = [...PRIORITY, 'Not set'].map((name) => ({ name, counts: Object.fromEntries(STATUSES.map((s) => [s, 0])), total: 0 }));
  for (const c of items) {
    const row = rows.find((r) => r.name === c.priority) || rows[rows.length - 1];
    row.counts[statusLabel(c.status)] = (row.counts[statusLabel(c.status)] || 0) + 1;
    row.total++;
  }
  return rows.filter((r) => r.name !== 'Not set' || r.total);
}

/** Totals per value of `key` (module, category), split by priority, largest first. */
export function groupBreakdown(items, key, emptyLabel) {
  const map = new Map();
  for (const c of items) {
    const name = c[key]?.trim() || emptyLabel;
    const k = name.toLowerCase();
    if (!map.has(k)) map.set(k, { name, total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    const g = map.get(k);
    g.total++;
    const p = priorityTone(c.priority);
    if (p) g[p]++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildEnhancementDocument(store, { scope = 'all', layout = 'page', now = new Date() } = {}) {
  const { def } = store;
  const all = store.state.cases.map((c, i) => ({ ...c, rid: def.itemId(i) }));
  const sc = ENH_SCOPES.find((x) => x.key === scope) || ENH_SCOPES[0];
  const items = all.filter(sc.test);
  const s = store.stats(all);
  const r = store.state.report;
  const product = r.product?.trim() || '';
  const title = r.title?.trim() || `${product ? `${product} ` : ''}Enhancement Report`;
  const parts = [product, r.build && `Version ${r.build}`].filter(Boolean);
  const ofTotal = (n) => (s.total ? `${pct(n / s.total)} of total` : '—');
  const colored = (n, t) => ({ v: n, tone: n ? t : null });
  const bar = [
    ...PRIORITY.map((p) => ({ label: p, value: s[p.toLowerCase()], tone: p.toLowerCase() })),
    ...(s.noPriority ? [{ label: 'No priority', value: s.noPriority, tone: 'notrun' }] : []),
  ];
  const groupTable = (title2, head, key, emptyLabel) => ({
    title: title2,
    cols: [{ head }, { head: 'Total', w: 16, dxa: 1000, align: 'right', bold: true }, ...PRIORITY.map((p) => ({ head: p, w: 17, dxa: 1000, align: 'right' }))],
    rows: groupBreakdown(all, key, emptyLabel).map((g) => [g.name, g.total, colored(g.critical, 'critical'), colored(g.high, 'high'), colored(g.medium, 'medium'), colored(g.low, 'low')]),
  });

  return {
    ...documentHead({
      title,
      subtitle: sc.subtitle,
      report: r,
      keywords: 'Iraje, QA, enhancement report',
      now,
      meta: [
        ['Product', product],
        ['Version / Release', r.build],
        ['Prepared By', r.preparedBy],
        ['Reviewed By', r.reviewedBy],
        ['Approved By', r.approvedBy],
        ['Report Date', r.date ? formatDate(r.date) : formatDate(now)],
        ['Requests in Report', `${items.length.toLocaleString()}${scope !== 'all' ? ` of ${all.length.toLocaleString()}` : ''}`],
      ],
    }),
    scope,
    layout,
    noun: { one: 'request', many: 'requests' },
    headerLine: parts.join('  ·  '),
    productParts: parts,
    glance: {
      label: 'Priorities at a glance',
      hero: { label: 'Critical + High', value: s.critical + s.high, sub: `of ${s.total} request${s.total === 1 ? '' : 's'}` },
      tiles: PRIORITY.map((p) => ({ label: p, value: s[p.toLowerCase()], sub: ofTotal(s[p.toLowerCase()]), tone: p.toLowerCase() })),
      bar,
    },
    summary: {
      title: 'Executive summary',
      kpis: [
        { label: 'Total', value: s.total, tone: 'navy' },
        ...PRIORITY.map((p) => ({ label: p, value: s[p.toLowerCase()], tone: p.toLowerCase() })),
        { label: 'Approved + Planned', value: s.approvedPlanned, tone: 'blue', highlight: true },
      ],
      barLabel: 'Priority split',
      bar,
      tables: [
        {
          title: 'Priority × status',
          cols: [{ head: 'Priority' }, ...STATUSES.map((st) => ({ head: st, w: st === 'Under review' ? 24 : 21, dxa: st === 'Under review' ? 1400 : 1180, align: 'right' })),
            { head: 'Total', w: 16, dxa: 950, align: 'right', bold: true }],
          rows: priorityStatusMatrix(all).map((m) => [{ v: m.name, tone: priorityTone(m.name), bold: true }, ...STATUSES.map((st) => m.counts[st]), m.total]),
        },
        groupTable('By module', 'Module / Feature', 'module', '(No module)'),
        groupTable('By category', 'Category', 'category', '(No category)'),
      ],
    },
    index: {
      title: 'Request index',
      cols: [{ head: 'ID', w: 17, dxa: 1100, bold: true, tone: 'blue' }, { head: 'Title' }, { head: 'Module', w: 32, dxa: 1900 },
        { head: 'Priority', w: 19, dxa: 1150 }, { head: 'Status', w: 24, dxa: 1450 }, { head: 'Shots', w: 13, dxa: 800, align: 'right' }],
      rows: items.map((c) => [c.rid, c.title || 'Untitled request', c.module || '—',
        { v: c.priority || '—', tone: priorityTone(c.priority), bold: !!c.priority },
        { v: statusLabel(c.status), tone: statusTone(c.status), bold: true, badge: true }, c.images.length]),
    },
    items: items.map((c) => ({
      id: c.rid,
      title: c.title,
      untitled: 'Untitled request',
      badge: { text: c.priority || 'No priority', tone: priorityTone(c.priority) || 'none' },
      accent: priorityTone(c.priority) || 'none',
      facts: [
        { label: 'Module / Feature', value: c.module },
        { label: 'Category', value: c.category },
        { label: 'Priority', value: c.priority, tone: priorityTone(c.priority) },
        { label: 'Status', value: statusLabel(c.status), tone: statusTone(c.status) },
      ],
      factsPerRow: 4,
      sections: [
        { type: 'compare', left: { title: 'Current behaviour', text: c.current }, right: { title: 'Proposed improvement', text: c.proposed }, tone: 'blue' },
        { type: 'block', title: 'Business value', text: c.value },
        c.acceptance ? { type: 'block', title: 'Acceptance criteria', text: c.acceptance } : null,
      ].filter(Boolean),
      images: c.images,
      evidenceLabel: 'Reference screenshots',
      filterKey: c.priority ? c.priority.toLowerCase() : 'none',
      searchText: `${c.rid} ${c.title} ${c.module} ${c.category} ${c.current} ${c.proposed} ${c.value} ${c.acceptance} ${statusLabel(c.status)}`.toLowerCase(),
    })),
    filters: [{ key: 'all', label: 'All' }, ...PRIORITY.map((p) => ({ key: p.toLowerCase(), label: p }))],
    searchPlaceholder: 'Search requests…',
    signoff: {
      title: 'Review & sign-off',
      note: 'Signatures confirm that the requests in this report were reviewed and their priorities agreed.',
      rows: [
        { role: 'Prepared by', name: r.preparedBy || '' },
        { role: 'Reviewed by', name: r.reviewedBy || '' },
        { role: 'Approved by', name: r.approvedBy || '' },
      ],
    },
  };
}
