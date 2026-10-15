// Reporting tab: report details, execution overview, the full test case summary with
// screenshots, then "Download TestSheet" and "Next" (PDF / DOCX / HTML report).

import { store, hasContent, isComplete, missingFields } from '../core/store.js';
import { REPORT_FIELDS, FIELD_BY_KEY } from '../core/config.js';
import { h, clear, button, saveBlob } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openModal, progressOverlay } from '../ui/modal.js';
import { openLightbox } from '../ui/lightbox.js';
import { testId, plural, debounce, safeFileName, todayISO, nextFrame } from '../core/util.js';
import { buildTestSheet } from '../services/template.js';
import { buildTestCaseDocument, moduleBreakdown, severityBreakdown, pct } from '../reports/model.js';

const PAGE = 40;
const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: 'file-pdf', text: 'Print-ready A4 with sharp text and full-width screenshots.', ext: 'pdf' },
  { key: 'docx', label: 'Word (DOCX)', icon: 'file-text', text: 'Editable report for Microsoft Word, WPS or Google Docs.', ext: 'docx' },
  { key: 'html', label: 'HTML', icon: 'file-code', text: 'One self-contained page with search, filters and image zoom.', ext: 'html' },
];

let lastChoice = { format: 'pdf', scope: 'all', layout: 'page' };

export function mount(root) {
  const cases = store.state.cases;
  if (!cases.some(hasContent)) {
    root.append(h('div.panel.empty-note',
      icon('clipboard-check'),
      h('h2', 'Nothing to report yet'),
      h('p.muted', 'Create test cases card by card or upload your filled template; the summary and reports appear here.'),
      h('div.result-actions', { style: { justifyContent: 'center', marginTop: '18px' } },
        button('Create test cases', { variant: 'primary', iconLeft: 'edit', onclick: () => { location.hash = '#/testcases/create'; } }),
        button('Upload a sheet', { variant: 'secondary', iconLeft: 'upload', onclick: () => { location.hash = '#/testcases/upload'; } }))));
    return null;
  }

  const wrap = h('div.report');
  root.append(wrap);

  // ---------- report details ----------
  const details = h('div.details-grid');
  for (const f of REPORT_FIELDS) {
    const id = `r-${f.key}`;
    const input = h('input.input', {
      id, type: f.type || 'text', value: store.state.report[f.key] || '', placeholder: f.placeholder || '', maxlength: 200, autocomplete: 'off',
    });
    input.addEventListener('input', () => store.setReport(f.key, input.value));
    details.append(h('div.field', h('label.field-label', { for: id }, f.label), input));
  }
  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('file-text')),
      h('div.grow', h('h2', 'Report details'), h('p', 'Shown on the report cover and written into the TestSheet\'s Summary sheet.'))),
    details));

  // ---------- overview ----------
  const s = store.stats();
  const kpi = (cls, label, value, sub) => h(`div.kpi${cls ? `.${cls}` : ''}`, h('div.kpi-label', label), h('div.kpi-value', value), h('div.kpi-sub', sub));
  const width = (n) => `${s.total ? (n / s.total) * 100 : 0}%`;
  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('chart')), h('div.grow', h('h2', 'Execution overview'), h('p', `${plural(s.total, 'test case')} · ${plural(s.images, 'screenshot')}`))),
    h('div.kpis',
      kpi('', 'Total', s.total.toLocaleString(), `${plural(s.complete, 'complete case')}`),
      kpi('', 'Executed', s.executed.toLocaleString(), `${pct(s.coverage)} coverage`),
      kpi('is-pass', 'Pass', s.pass.toLocaleString(), s.executed ? `${pct(s.pass / s.executed)} of executed` : '—'),
      kpi('is-fail', 'Fail', s.fail.toLocaleString(), s.executed ? `${pct(s.fail / s.executed)} of executed` : '—'),
      kpi('is-blocked', 'Blocked', s.blocked.toLocaleString(), s.executed ? `${pct(s.blocked / s.executed)} of executed` : '—'),
      kpi('is-rate', 'Pass rate', pct(s.passRate), `${s.notRun.toLocaleString()} not run`)),
    h('div.split-bar', { role: 'img', 'aria-label': `Pass ${s.pass}, Fail ${s.fail}, Blocked ${s.blocked}, Not run ${s.notRun}` },
      h('span.is-pass', { style: { width: width(s.pass) } }), h('span.is-fail', { style: { width: width(s.fail) } }),
      h('span.is-blocked', { style: { width: width(s.blocked) } }), h('span.is-notrun', { style: { width: width(s.notRun) } })),
    h('div.legend',
      legend('var(--pass)', `Pass ${s.pass}`), legend('var(--fail)', `Fail ${s.fail}`),
      legend('var(--blocked)', `Blocked ${s.blocked}`), legend('#C9D1E0', `Not run ${s.notRun}`))));

  const modules = moduleBreakdown(cases);
  const sev = severityBreakdown(cases);
  wrap.append(h('div.two-col',
    h('section.panel',
      h('div.panel-head', h('div.grow', h('h2', 'Module-wise progress'), h('p', `${plural(modules.length, 'module')}`))),
      h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', 'Module / Feature'), h('th.num', 'Total'), h('th.num', 'Pass'), h('th.num', 'Fail'), h('th.num', 'Blocked'), h('th.num', 'Not run'), h('th', 'Pass rate'))),
        h('tbody', modules.map((m) => h('tr',
          h('td', m.name), h('td.num', m.total), h('td.num', m.pass), h('td.num', m.fail), h('td.num', m.blocked), h('td.num', m.notRun),
          h('td', h('span.mini-bar', h('i', { style: { width: pct(m.passRate) } })), m.executed ? pct(m.passRate) : '—'))))))),
    h('section.panel',
      h('div.panel-head', h('div.grow', h('h2', 'Open issues by severity'), h('p', 'Fail and Blocked test cases'))),
      h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', 'Severity'), h('th.num', 'Fail'), h('th.num', 'Blocked'), h('th.num', 'Total'))),
        h('tbody', sev.map((r) => h('tr',
          h('td', h(`span.sev.is-${r.name.toLowerCase().replace(/\s+/g, '-')}`, r.name)), h('td.num', r.fail), h('td.num', r.blocked), h('td.num', h('b', r.total))))))))));

  // ---------- test case summary ----------
  let filter = 'all';
  let query = '';
  let shown = 0;
  let filtered = [];
  const list = h('div.case-list');
  const more = h('div.load-more');
  const filterBar = h('div.filters');
  const search = h('input.input', { type: 'search', placeholder: 'Search test cases…', 'aria-label': 'Search test cases' });
  search.addEventListener('input', debounce(() => { query = search.value.trim().toLowerCase(); renderList(); }, 150));

  const FILTERS = [['all', 'All'], ['Pass', 'Pass'], ['Fail', 'Fail'], ['Blocked', 'Blocked'], ['none', 'Not run'], ['incomplete', 'Incomplete']];
  const test = {
    all: () => true, Pass: (c) => c.status === 'Pass', Fail: (c) => c.status === 'Fail', Blocked: (c) => c.status === 'Blocked',
    none: (c) => !c.status, incomplete: (c) => !isComplete(c),
  };
  const renderFilters = () => {
    clear(filterBar);
    for (const [key, label] of FILTERS) {
      filterBar.append(h('button.filter', { type: 'button', 'aria-pressed': String(filter === key), onclick: () => { filter = key; renderFilters(); renderList(); } },
        label, h('span.n', String(cases.filter(test[key]).length))));
    }
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) renderMore();
  }, { rootMargin: '600px' });

  function renderList() {
    filtered = cases.map((c, i) => ({ c, i })).filter(({ c }) => test[filter](c) && (!query
      || `${c.title}\n${c.module}\n${c.field}\n${c.steps}\n${c.expected}\n${c.actual}\n${c.comments}`.toLowerCase().includes(query)));
    clear(list);
    shown = 0;
    if (!filtered.length) list.append(h('div.empty-note', icon('search'), h('p', 'No test cases match.')));
    renderMore();
  }

  function renderMore() {
    const slice = filtered.slice(shown, shown + PAGE);
    list.append(...slice.map(({ c, i }) => caseItem(c, i)));
    shown += slice.length;
    clear(more);
    io.disconnect();
    if (shown < filtered.length) {
      more.append(button(`Show more (${(filtered.length - shown).toLocaleString()} left)`, { variant: 'secondary', size: 'sm', onclick: renderMore }));
      io.observe(more);
    }
  }

  wrap.append(h('section.panel',
    h('div.panel-head', h('div.chip-icon.is-soft', icon('list')), h('div.grow', h('h2', 'Test case summary'), h('p', 'Everything that goes into the reports. Click a screenshot to zoom, or Edit to change a test case.'))),
    h('div.list-tools', h('div.search', icon('search'), search), filterBar),
    h('div', { style: { height: '16px' } }),
    list, more));

  renderFilters();
  renderList();

  // ---------- action bar ----------
  wrap.append(h('div.action-bar',
    h('div.grow', h('b', plural(cases.length, 'test case')), ` · ${plural(s.images, 'screenshot')} · ${pct(s.passRate)} pass rate`),
    button('Download TestSheet', { variant: 'secondary', iconLeft: 'file-sheet', onclick: downloadTestSheet }),
    button('Next', { variant: 'primary', iconRight: 'arrow-right', onclick: chooseReport })));

  return () => io.disconnect();
}

function legend(color, label) {
  const i = h('i');
  i.style.background = color;
  return h('span', i, label);
}

function caseItem(c, i) {
  const st = c.status ? c.status.toLowerCase() : 'none';
  const block = (title, text, cls = '') => (text ? h(`div.case-block${cls}`, h('h4', title), h('p', text)) : null);
  const shots = h('div.case-shots');
  c.images.forEach((id, k) => {
    const img = h('img', { alt: `Screenshot ${k + 1}`, loading: 'lazy', decoding: 'async' });
    const node = h('div.shot', { role: 'button', tabindex: 0, 'aria-label': `View screenshot ${k + 1} of ${testId(i)}` }, img, h('span.shot-num', `#${k + 1}`));
    const view = () => openLightbox(c.images.map((x, n) => ({ load: () => store.imageUrl(x, 'full'), caption: `${testId(i)} · Screenshot ${n + 1} of ${c.images.length}` })), k);
    node.addEventListener('click', view);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view(); } });
    store.imageUrl(id, 'thumb').then((url) => { if (url) img.src = url; });
    shots.append(node);
  });
  const missing = missingFields(c);
  return h(`article.case-item.is-${st}`,
    h('div.case-top',
      h('span.tc-id', testId(i)),
      h('h3', c.title || 'Untitled test case'),
      h(`span.status-badge${c.status ? `.is-${st}` : ''}`, c.status || 'Not run'),
      c.bookmarked ? h('span.chip', { style: { color: 'var(--bookmark)', background: 'var(--bookmark-bg)', borderColor: '#FBC7D2' } }, icon('bookmark', { filled: true }), 'Bookmarked') : null,
      button('Edit', { variant: 'ghost', size: 'sm', iconLeft: 'edit', onclick: () => { store.goTo(i); location.hash = '#/testcases/create'; } })),
    h('div.case-meta',
      c.module ? h('span', 'Module: ', h('b', c.module)) : null,
      c.field ? h('span', 'Field: ', h('b', c.field)) : null,
      c.type ? h('span', 'Type: ', h('b', c.type)) : null,
      c.account ? h('span', 'Account: ', h('b', c.account)) : null,
      c.severity ? h('span', 'Severity: ', h(`b.sev.is-${c.severity.toLowerCase()}`, c.severity)) : null,
      c.tester ? h('span', 'Tester: ', h('b', c.tester)) : null),
    block('Test steps', c.steps),
    h('div.case-cols', block('Expected result', c.expected) || h('div'), block('Actual result', c.actual, '.is-actual') || h('div')),
    c.comments ? block('Comments / Defect ID', c.comments) : null,
    missing.length ? h('span.case-incomplete', icon('alert-circle'), `Missing: ${missing.map((k) => FIELD_BY_KEY[k].label).join(', ')}`) : null,
    c.images.length ? shots : null);
}

async function downloadTestSheet() {
  const p = progressOverlay('Building your TestSheet');
  try {
    p.update(0.2, 'Filling the Iraje template…');
    await nextFrame();
    const blob = await buildTestSheet(store.state.cases.filter(hasContent), store.state.report, store.state.lists);
    p.update(1, 'Done');
    const name = `${safeFileName(store.state.report.product || 'Iraje')}_TestSheet_${todayISO()}.xlsx`;
    saveBlob(blob, name);
    toast(`${name} downloaded. Screenshots stay in the reports.`, { type: 'success', title: 'TestSheet ready' });
  } catch (err) {
    console.error(err);
    toast(err.message || 'The TestSheet could not be created.', { type: 'error' });
  } finally {
    p.close();
  }
}

async function chooseReport() {
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
  const s = store.stats();
  const scopeSel = h('select.select', { id: 'rep-scope' },
    h('option', { value: 'all' }, `All test cases (${s.total})`),
    h('option', { value: 'defects' }, `Defects only: Fail + Blocked (${s.fail + s.blocked})`));
  scopeSel.value = choice.scope;
  scopeSel.addEventListener('change', () => { choice.scope = scopeSel.value; });
  const layoutSel = h('select.select', { id: 'rep-layout' },
    h('option', { value: 'page' }, 'One test case per page'),
    h('option', { value: 'flow' }, 'Continuous (compact)'));
  layoutSel.value = choice.layout;
  layoutSel.addEventListener('change', () => { choice.layout = layoutSel.value; });

  const go = await openModal({
    title: 'Download test report',
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
  await generateReport(choice);
}

export async function generateReport({ format, scope, layout }) {
  const fmt = FORMATS.find((f) => f.key === format);
  const model = buildTestCaseDocument(store, { scope, layout });
  if (!model.items.length) {
    toast(scope === 'defects' ? 'There are no Fail or Blocked test cases to report.' : 'There are no test cases to report.', { type: 'warning' });
    return;
  }
  const p = progressOverlay(`Building the ${fmt.label} report`);
  try {
    const mod = await import(`../reports/${format}-report.js`);
    const blob = await mod.build(model, { store, onProgress: (f, text) => p.update(f, text) });
    const name = `${safeFileName(model.title, 'Test_Report')}_${todayISO()}.${fmt.ext}`;
    saveBlob(blob, name);
    toast(`${name} downloaded`, { type: 'success', title: 'Report ready' });
  } catch (err) {
    console.error(err);
    toast(err.message || 'The report could not be generated.', { type: 'error', title: 'Report failed' });
  } finally {
    p.close();
  }
}
