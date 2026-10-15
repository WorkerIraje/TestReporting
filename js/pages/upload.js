// Upload tab: import a filled Iraje test case template and turn every row into a card.

import { store, hasContent } from '../core/store.js';
import { APP } from '../core/config.js';
import { h, clear, button, pickFiles } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { plural, formatBytes } from '../core/util.js';
import { readTestSheet, ImportError, ACCEPT } from '../services/importer.js';
import { hasFiles } from '../services/images.js';
import { downloadTemplate } from './welcome.js';

const STEPS = [
  ['type', 'Checking file type, size and signature'],
  ['parse', 'Reading the workbook safely'],
  ['structure', 'Matching the Iraje template columns'],
  ['rows', 'Converting rows into test case cards'],
];

export function mount(root, ws) {
  let busy = false;
  const status = h('div.upload-card', { hidden: true, 'aria-live': 'polite' });

  const drop = h('div.upload-drop', {
    tabindex: 0, role: 'button', 'aria-label': 'Choose a test case sheet to upload',
    onclick: (e) => { if (!e.target.closest('.btn')) browse(); },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); browse(); } },
  },
  h('div.chip-icon', icon('upload-cloud')),
  h('h2', 'Drop your filled test case sheet here'),
  h('p', 'or browse for it. Only the Iraje test case template is accepted; each row becomes a test case card you can edit, evidence and report.'),
  h('div.formats', ['.xlsx', '.xlsm', '.xls', '.csv'].map((x) => h('span.chip', icon('file-sheet'), x))),
  h('div.result-actions',
    button('Browse file', { variant: 'primary', iconLeft: 'folder-open', onclick: () => browse() }),
    button('Download template', { variant: 'secondary', iconLeft: 'download', onclick: downloadTemplate })));

  const rules = h('div.upload-rules',
    rule('shield', 'Template only', 'The header row must match the template exactly: Test ID through Comments / Defect ID.'),
    rule('layers', `Up to ${APP.maxUploadCases} per upload`, `Bigger sheets import the first ${APP.maxUploadCases}. Keep adding with Next, up to ${APP.maxCases.toLocaleString()} in total.`),
    rule('lock', 'Checked in your browser', `Max ${formatBytes(APP.maxUploadBytes)}. The file is validated locally and never uploaded anywhere.`));

  root.append(h('div.upload-wrap', h('div.upload-card', drop, rules), status));

  // drag & drop anywhere on the page while this tab is open
  let depth = 0;
  const onEnter = (e) => { if (hasFiles(e.dataTransfer)) { e.preventDefault(); depth++; drop.classList.add('is-over'); } };
  const onOver = (e) => { if (hasFiles(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  const onLeave = () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('is-over'); };
  const onDrop = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    depth = 0;
    drop.classList.remove('is-over');
    const files = [...e.dataTransfer.files];
    if (files.length > 1) toast('One sheet at a time: only the first file was used.', { type: 'info' });
    if (files[0]) handle(files[0]);
  };
  document.addEventListener('dragenter', onEnter);
  document.addEventListener('dragover', onOver);
  document.addEventListener('dragleave', onLeave);
  document.addEventListener('drop', onDrop);

  async function browse() {
    if (busy) return;
    const [file] = await pickFiles({ accept: ACCEPT });
    if (file) handle(file);
  }

  async function handle(file) {
    if (busy) return;
    busy = true;
    status.hidden = false;
    clear(status);
    const stepEls = Object.fromEntries(STEPS.map(([key, label]) => [key, h('div.step', h('span.si', icon('clock')), h('span', label))]));
    const head = h('div.result-head', h('div.chip-icon', icon('file-sheet')),
      h('div', h('h3', file.name), h('p', `${formatBytes(file.size)} · validating…`)));
    status.append(h('div.result', head, h('div.steps', Object.values(stepEls))));
    status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let active = null;
    const setStep = (key) => {
      if (active) {
        stepEls[active].className = 'step is-done';
        stepEls[active].firstChild.replaceWith(h('span.si', icon('check')));
      }
      active = stepEls[key] ? key : null;
      if (active) {
        stepEls[active].className = 'step is-active';
        stepEls[active].firstChild.replaceWith(h('span.si', icon('loader')));
      }
    };

    try {
      const result = await readTestSheet(file, { onStep: setStep });
      let mode = 'replace';
      if (store.state.cases.some(hasContent)) {
        mode = await openModal({
          title: `${plural(result.imported, 'test case')} ready to import`,
          subtitle: `From "${file.name}"`,
          iconName: 'file-sheet',
          body: h('p', `You already have ${plural(store.state.cases.filter(hasContent).length, 'test case')} in this session. Replace them, or add the imported test cases after them?`),
          actions: [
            { label: 'Cancel', value: null },
            { label: 'Add after mine', value: 'append' },
            { label: 'Replace mine', value: 'replace', variant: 'primary', autofocus: true },
          ],
        });
        if (!mode) {
          showResult('warning', 'Import cancelled', 'Nothing was changed.', [], [tryAgain()]);
          return;
        }
      }
      const before = mode === 'append' ? store.state.cases.filter(hasContent).length : 0;
      const first = await store.loadCases(result.cases, [], { mode, report: result.report });
      const added = store.count - before;
      const warnings = [...result.warnings];
      if (result.truncated) {
        warnings.unshift(`Your sheet has ${result.found.toLocaleString()} test cases. Only the first ${APP.maxUploadCases} were imported (limit per upload). Upload the rest as a second sheet with "Add after mine", or keep adding cards with Next.`);
      }
      if (result.reachedRowCap) warnings.push('Rows beyond the template\'s capacity were ignored.');
      if (added < result.imported) warnings.push(`Only ${added} fit: a session holds up to ${APP.maxCases.toLocaleString()} test cases.`);
      const openBtn = button(`Open ${plural(added, 'test case')}`, { variant: 'primary', iconRight: 'arrow-right', onclick: () => ws.openCase(first) });
      showResult(warnings.length ? 'warning' : 'ok',
        `${plural(added, 'test case')} imported`,
        `Sheet "${result.sheetName}" · ${mode === 'append' ? 'added after your existing test cases' : 'loaded as a new session'}${result.report?.product ? ` · ${result.report.product}` : ''}`,
        warnings, [openBtn, tryAgain('Upload another sheet')]);
      toast(`${plural(added, 'test case')} imported`, { type: 'success' });
      if (!warnings.length) setTimeout(() => { if (status.isConnected) ws.openCase(first); }, 1200);
      else openBtn.focus();
    } catch (err) {
      if (active) {
        stepEls[active].className = 'step is-error';
        stepEls[active].firstChild.replaceWith(h('span.si', icon('x')));
      }
      if (err instanceof ImportError) {
        showResult('error', err.title, err.message, err.details, [
          button('Download template', { variant: 'primary', iconLeft: 'download', onclick: downloadTemplate }),
          tryAgain('Try another file'),
        ]);
      } else {
        console.error(err);
        showResult('error', 'Import failed', 'Something unexpected went wrong while reading the file.', [String(err.message || err)], [tryAgain('Try again')]);
      }
    } finally {
      busy = false;
    }

    function showResult(kind, title, message, details, actions) {
      const ic = { ok: 'check-circle', warning: 'alert-triangle', error: 'x-circle' }[kind];
      head.replaceWith(h('div.result-head', h(`div.chip-icon.is-${kind}`, icon(ic)), h('div', h('h3', title), h('p', message))));
      const resultEl = status.querySelector('.result');
      if (details?.length) resultEl.append(h(`div.banner${kind === 'ok' ? '' : '.is-warning'}`, icon(kind === 'error' ? 'info' : 'alert-triangle'), h('ul.grow', details.map((d) => h('li', d)))));
      resultEl.append(h('div.result-actions', actions));
      status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function tryAgain(label = 'Choose a file') {
    return button(label, { variant: 'secondary', iconLeft: 'upload', onclick: () => browse() });
  }

  return () => {
    document.removeEventListener('dragenter', onEnter);
    document.removeEventListener('dragover', onOver);
    document.removeEventListener('dragleave', onLeave);
    document.removeEventListener('drop', onDrop);
  };
}

function rule(ic, title, text) {
  return h('div.rule', icon(ic), h('div', h('b', title), text));
}
