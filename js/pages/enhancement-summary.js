// Enhancement Report · Summary tab: report details, priority overview, priority × status matrix,
// module and category breakdowns, every request with its screenshots, then "Next" (PDF / DOCX / HTML).

import { PRIORITY, ENH_STATUS, PROPOSED } from '../core/workspaces.js';
import { h, clear, button, saveBlob } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openModal, progressOverlay } from '../ui/modal.js';
import { openLightbox } from '../ui/lightbox.js';
import { plural, debounce, safeFileName, todayISO } from '../core/util.js';
import { pct } from '../reports/model.js';
import { priorityStatusMatrix, groupBreakdown, statusLabel, statusTone, ENH_SCOPES, buildEnhancementDocument } from '../reports/enhancement-model.js';

const PAGE = 40;
const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: 'file-pdf', text: 'Print-ready A4 with sharp text and full-width screenshots.', ext: 'pdf' },
  { key: 'docx', label: 'Word (DOCX)', icon: 'file-text', text: 'Editable report for Microsoft Word, WPS or Google Docs.', ext: 'docx' },
  { key: 'html', label: 'HTML', icon: 'file-code', text: 'One self-contained page with search, filters and image zoom.', ext: 'html' },
];
const PRIORITY_KEYS = PRIORITY.map((p) => p.toLowerCase());

let lastChoice = { format: 'pdf', scope: 'all', layout: 'page' };

export function mount(root, ws) {
  const { store, def } = ws;
  const cases = store.state.cases;
  if (!cases.some(store.hasContent)) {
    root.append(h('div.panel.empty-note',
      icon('lightbulb'),
      h('h2', 'Nothing to summarise yet'),
      h('p.muted', 'Write enhancement requests card by card or upload a filled Word template; the summary and reports appear here.'),
      h('div.result-actions', { style: { justifyContent: 'center', marginTop: '18px' } },
        button('Create requests', { variant: 'primary', iconLeft: 'edit', onclick: () => { location.hash = ws.routes.create; } }),
        button('Upload a Word file', { variant: 'secondary', iconLeft: 'upload', onclick: () => { location.hash = `#/${def.route}/upload`; } }))));
    return null;
  }

  const wrap = h('div.report');
  root.append(wrap);

  // ---------- report details ----------
  const details = h('div.details-grid');
  for (const f of def.reportFields) {
    const id = `r-${f.key}`;
    const input = h('input.input', {
      id, type: f.type || 'text', value: store.state.report[f.key] || '', placeholder: f.placeholder || '', maxlength: 200, autocomplete: 'off',
    });
    input.addEventListener('input', () => store.setReport(f.key, input.value));
    details.append(h('div.field', h('label.field-label', { for: id }, f.label), input));
  }
  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('file-text')),
      h('div.grow', h('h2', 'Report details'), h('p', 'Shown on the report cover and in the review & sign-off block.'))),
    details));

  // ---------- overview ----------
  const s = store.stats();
  const kpi = (cls, label, value, sub) => h(`div.kpi${cls ? `.${cls}` : ''}`, h('div.kpi-label', label), h('div.kpi-value', value), h('div.kpi-sub', sub));
  const share = (n) => (s.total ? `${pct(n / s.total)} of total` : '—');
  const width = (n) => `${s.total ? (n / s.total) * 100 : 0}%`;
  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('chart')), h('div.grow', h('h2', 'Overview'), h('p', `${plural(s.total, 'request')} · ${plural(s.images, 'screenshot')}`))),
    h('div.kpis',
      kpi('', 'Total', s.total.toLocaleString(), plural(s.complete, 'complete request')),
      ...PRIORITY.map((p, i) => kpi(`is-${PRIORITY_KEYS[i]}`, p, s[PRIORITY_KEYS[i]].toLocaleString(), share(s[PRIORITY_KEYS[i]]))),
      kpi('is-rate', 'Approved + Planned', s.approvedPlanned.toLocaleString(), `${s.proposed.toLocaleString()} proposed · ${s.review.toLocaleString()} under review`)),
    h('div.split-bar', { role: 'img', 'aria-label': PRIORITY.map((p, i) => `${p} ${s[PRIORITY_KEYS[i]]}`).join(', ') },
      ...PRIORITY_KEYS.map((k) => h(`span.is-${k}`, { style: { width: width(s[k]) } })),
      h('span.is-notrun', { style: { width: width(s.noPriority) } })),
    h('div.legend',
      ...PRIORITY.map((p, i) => legend(`var(--sev-${PRIORITY_KEYS[i]})`, `${p} ${s[PRIORITY_KEYS[i]]}`)),
      s.noPriority ? legend('#C9D1E0', `No priority ${s.noPriority}`) : null)));

  // ---------- matrix and breakdowns ----------
  const statuses = [PROPOSED, ...ENH_STATUS];
  wrap.append(h('section.panel',
    h('div.panel-head', h('div.grow', h('h2', 'Priority × status'), h('p', 'How far each priority has moved through review'))),
    h('div.table-wrap', h('table.data',
      h('thead', h('tr', h('th', 'Priority'), statuses.map((st) => h('th.num', st)), h('th.num', 'Total'))),
      h('tbody', priorityStatusMatrix(cases).map((m) => h('tr',
        h('td', h(`span.sev${PRIORITY.includes(m.name) ? `.is-${m.name.toLowerCase()}` : ''}`, m.name)),
        statuses.map((st) => h('td.num', m.counts[st] || 0)),
        h('td.num', h('b', m.total)))))))));

  const groupPanel = (title, head, key, emptyLabel, [one, many]) => {
    const rows = groupBreakdown(cases, key, emptyLabel);
    return h('section.panel',
      h('div.panel-head', h('div.grow', h('h2', title), h('p', plural(rows.length, one, many)))),
      h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', head), h('th.num', 'Total'), PRIORITY.map((p) => h('th.num', p)))),
        h('tbody', rows.map((g) => h('tr', h('td', g.name), h('td.num', h('b', g.total)),
          PRIORITY_KEYS.map((k) => h('td.num', g[k] ? h(`span.sev.is-${k}`, g[k]) : '0'))))))));
  };
  wrap.append(h('div.two-col',
    groupPanel('By module', 'Module / Feature', 'module', '(No module)', ['module', 'modules']),
    groupPanel('By category', 'Category', 'category', '(No category)', ['category', 'categories'])));

  // ---------- request list ----------
  let filter = 'all';
  let query = '';
  let shown = 0;
  let filtered = [];
  const list = h('div.case-list');
  const more = h('div.load-more');
  const filterBar = h('div.filters');
  const search = h('input.input', { type: 'search', placeholder: 'Search requests…', 'aria-label': 'Search requests' });
  search.addEventListener('input', debounce(() => { query = search.value.trim().toLowerCase(); renderList(); }, 150));

  const FILTERS = [['all', 'All', () => true], ...PRIORITY.map((p) => [p, p, (c) => c.priority === p]), ['incomplete', 'Incomplete', (c) => !store.isComplete(c)]];
  const renderFilters = () => {
    clear(filterBar);
    for (const [key, label, test] of FILTERS) {
      filterBar.append(h('button.filter', { type: 'button', 'aria-pressed': String(filter === key), onclick: () => { filter = key; renderFilters(); renderList(); } },
        label, h('span.n', String(cases.filter(test).length))));
    }
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) renderMore();
  }, { rootMargin: '600px' });

  function renderList() {
    const test = FILTERS.find((f) => f[0] === filter)[2];
    filtered = cases.map((c, i) => ({ c, i })).filter(({ c }) => test(c) && (!query || def.searchText(c).toLowerCase().includes(query)));
    clear(list);
    shown = 0;
    if (!filtered.length) list.append(h('div.empty-note', icon('search'), h('p', 'No requests match.')));
    renderMore();
  }

  function renderMore() {
    const slice = filtered.slice(shown, shown + PAGE);
    list.append(...slice.map(({ c, i }) => requestItem(ws, c, i)));
    shown += slice.length;
    clear(more);
    io.disconnect();
    if (shown < filtered.length) {
      more.append(button(`Show more (${(filtered.length - shown).toLocaleString()} left)`, { variant: 'secondary', size: 'sm', onclick: renderMore }));
      io.observe(more);
    }
  }

  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('list')), h('div.grow', h('h2', 'Enhancement requests'), h('p', 'Everything that goes into the reports. Click a screenshot to zoom, or Edit to change a request.'))),
    h('div.list-tools', h('div.search', icon('search'), search), filterBar),
    h('div', { style: { height: '16px' } }),
    list, more));

  renderFilters();
  renderList();

  // ---------- action bar ----------
  wrap.append(h('div.action-bar',
    h('div.grow', h('b', plural(cases.length, 'request')), ` · ${plural(s.images, 'screenshot')} · ${(s.critical + s.high).toLocaleString()} Critical + High`),
    button('Next', { variant: 'primary', iconRight: 'arrow-right', onclick: () => chooseReport(ws) })));

  return () => io.disconnect();
}

function legend(color, label) {
  const i = h('i');
  i.style.background = color;
  return h('span', i, label);
}

function requestItem(ws, c, i) {
  const { store, def } = ws;
  const rid = def.itemId(i);
  const prio = c.priority ? c.priority.toLowerCase() : 'none';
  const block = (title, text, cls = '') => (text ? h(`div.case-block${cls}`, h('h4', title), h('p', text)) : null);
  const shots = h('div.case-shots');
  c.images.forEach((id, k) => {
    const img = h('img', { alt: `Screenshot ${k + 1}`, loading: 'lazy', decoding: 'async' });
    const node = h('div.shot', { role: 'button', tabindex: 0, 'aria-label': `View screenshot ${k + 1} of ${rid}` }, img, h('span.shot-num', `#${k + 1}`));
    const view = () => openLightbox(c.images.map((x, n) => ({ load: () => store.imageUrl(x, 'full'), caption: `${rid} · Screenshot ${n + 1} of ${c.images.length}` })), k);
    node.addEventListener('click', view);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view(); } });
    store.imageUrl(id, 'thumb').then((url) => { if (url) img.src = url; });
    shots.append(node);
  });
  const missing = store.missingFields(c);
  return h(`article.case-item.is-${prio}`,
    h('div.case-top',
      h('span.tc-id', rid),
      h('h3', c.title || 'Untitled request'),
      h(`span.status-badge.is-${statusTone(c.status)}`, statusLabel(c.status)),
      c.bookmarked ? h('span.chip', { style: { color: 'var(--bookmark)', background: 'var(--bookmark-bg)', borderColor: '#FBC7D2' } }, icon('bookmark', { filled: true }), 'Bookmarked') : null,
      button('Edit', { variant: 'ghost', size: 'sm', iconLeft: 'edit', onclick: () => ws.openCase(i) })),
    h('div.case-meta',
      h('span', 'Priority: ', c.priority ? h(`b.sev.is-${prio}`, c.priority) : h('b', '—')),
      c.module ? h('span', 'Module: ', h('b', c.module)) : null,
      c.category ? h('span', 'Category: ', h('b', c.category)) : null),
    h('div.case-cols', block('Current behaviour', c.current) || h('div'), block('Proposed improvement', c.proposed, '.is-proposed') || h('div')),
    block('Business value', c.value),
    block('Acceptance criteria', c.acceptance),
    missing.length ? h('span.case-incomplete', icon('alert-circle'), `Missing: ${missing.map((k) => def.fieldByKey[k].label).join(', ')}`) : null,
    c.images.length ? shots : null);
}

async function chooseReport(ws) {
  const choice = { ...lastChoice };
  const formatCards = h('div.format-grid', { role: 'radiogroup', 'aria-label': 'Report format' });
  const renderFormats = () => {
    clear(formatCards);
    for (const f of FORMATS) {
      formatCards.append(h('button.format-card', {
        type: 'button', role: 'radio', 'aria-checked': String(choice.format === f.key),
        onclick: () => { choice.format = f.key; renderFormats(); },
        ondblclick: () => document.querySelector('dialog[open] .modal-foot .btn-primary')?.click(),
      }, h('span.check', icon('check')), h('div.chip-icon', icon(f.icon)), h('b', f.label), h('span', f.text)));
    }
  };
  renderFormats();
  const cases = ws.store.state.cases;
  const scopeSel = h('select.select', { id: 'rep-scope' },
    ENH_SCOPES.map((x) => h('option', { value: x.key }, `${x.label} (${cases.filter(x.test).length})`)));
  scopeSel.value = choice.scope;
  scopeSel.addEventListener('change', () => { choice.scope = scopeSel.value; });
  const layoutSel = h('select.select', { id: 'rep-layout' },
    h('option', { value: 'page' }, 'One request per page'),
    h('option', { value: 'flow' }, 'Continuous (compact)'));
  layoutSel.value = choice.layout;
  layoutSel.addEventListener('change', () => { choice.layout = layoutSel.value; });

  const go = await openModal({
    title: 'Download enhancement report',
    subtitle: 'Every page carries the Iraje logo and a subtle "Iraje Software" watermark.',
    iconName: 'download',
    size: 'lg',
    body: [formatCards, h('div.option-row',
      h('div.field', h('label.field-label', { for: 'rep-scope' }, 'Include'), scopeSel),
      h('div.field', h('label.field-label', { for: 'rep-layout' }, 'Layout (PDF & Word)'), layoutSel))],
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Generate & download', value: true, variant: 'primary', iconLeft: 'download', autofocus: true },
    ],
  });
  if (!go) return;
  lastChoice = choice;
  await generateReport(ws, choice);
}

export async function generateReport(ws, { format, scope, layout }) {
  const fmt = FORMATS.find((f) => f.key === format);
  const model = buildEnhancementDocument(ws.store, { scope, layout });
  if (!model.items.length) {
    toast('There are no requests in this selection.', { type: 'warning' });
    return;
  }
  const p = progressOverlay(`Building the ${fmt.label} report`);
  try {
    const mod = await import(`../reports/${format}-report.js`);
    const blob = await mod.build(model, { store: ws.store, onProgress: (f, text) => p.update(f, text) });
    const name = `${safeFileName(model.title, 'Enhancement_Report')}_${todayISO()}.${fmt.ext}`;
    saveBlob(blob, name);
    toast(`${name} downloaded`, { type: 'success', title: 'Report ready' });
  } catch (err) {
    console.error(err);
    toast(err.message || 'The report could not be generated.', { type: 'error', title: 'Report failed' });
  } finally {
    p.close();
  }
}
