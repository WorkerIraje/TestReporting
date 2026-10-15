// Enhancement Report · Upload tab: import a filled Word enhancement template; every
// Title / Description / Reference screenshot block becomes an enhancement card.

import { h, clear, button, pickFiles, saveBlob } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { plural, formatBytes } from '../core/util.js';
import { ImportError } from '../services/importer.js';
import { hasFiles } from '../services/images.js';
import { buildTemplate, parseTemplate, TEMPLATE_FILE_NAME, ACCEPT_DOCX } from '../services/enhancement-template.js';

const STEPS = [
  ['type', 'Checking file type, size and signature'],
  ['parse', 'Reading the document safely'],
  ['blocks', 'Finding enhancement blocks'],
  ['images', 'Extracting reference screenshots'],
];

let templateBusy = false;

/** Builds the branded Word template and downloads it. */
export async function downloadEnhancementTemplate() {
  if (templateBusy) return;
  templateBusy = true;
  try {
    saveBlob(await buildTemplate(), TEMPLATE_FILE_NAME);
    toast(`${TEMPLATE_FILE_NAME} downloaded. Fill one block per enhancement, then upload it here.`, { type: 'success', title: 'Template ready' });
  } catch (err) {
    console.error(err);
    toast(err.message || 'The template could not be created.', { type: 'error' });
  } finally {
    templateBusy = false;
  }
}

export function mount(root, ws) {
  const { store, def } = ws;
  let busy = false;
  const status = h('div.upload-card', { hidden: true, 'aria-live': 'polite' });

  const drop = h('div.upload-drop', {
    tabindex: 0, role: 'button', 'aria-label': 'Choose a filled enhancement template to upload',
    onclick: (e) => { if (!e.target.closest('.btn')) browse(); },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); browse(); } },
  },
  h('div.chip-icon', icon('upload-cloud')),
  h('h2', 'Drop your filled enhancement template here'),
  h('p', 'or browse for it. Each Title / Description / Reference screenshot block becomes an enhancement card.'),
  h('div.formats', h('span.chip', icon('file-text'), '.docx')),
  h('div.result-actions',
    button('Browse file', { variant: 'primary', iconLeft: 'folder-open', onclick: () => browse() }),
    button('Download template', { variant: 'secondary', iconLeft: 'download', onclick: downloadEnhancementTemplate })));

  const rules = h('div.upload-rules',
    rule('shield', 'Word template only', 'Blocks are found by their Title, Description and Reference screenshot labels. Description goes into Current behaviour.'),
    rule('layers', `Up to ${def.maxUploadItems} per upload`, `Bigger documents import the first ${def.maxUploadItems} blocks. A session holds up to ${def.maxItems.toLocaleString()} requests.`),
    rule('lock', 'Checked in your browser', `Max ${formatBytes(def.maxUploadBytes)}. The file is validated locally and never uploaded anywhere; linked pictures are never fetched.`));

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
    if (files.length > 1) toast('One document at a time: only the first file was used.', { type: 'info' });
    if (files[0]) handle(files[0]);
  };
  document.addEventListener('dragenter', onEnter);
  document.addEventListener('dragover', onOver);
  document.addEventListener('dragleave', onLeave);
  document.addEventListener('drop', onDrop);

  async function browse() {
    if (busy) return;
    const [file] = await pickFiles({ accept: ACCEPT_DOCX });
    if (file) handle(file);
  }

  async function handle(file) {
    if (busy) return;
    busy = true;
    status.hidden = false;
    clear(status);
    const stepEls = Object.fromEntries(STEPS.map(([key, label]) => [key, h('div.step', h('span.si', icon('clock')), h('span', label))]));
    const head = h('div.result-head', h('div.chip-icon', icon('file-text')),
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
      const result = await parseTemplate(file, { onStep: setStep });
      setStep(null);
      let mode = 'replace';
      const existing = store.state.cases.filter(store.hasContent).length;
      if (existing) {
        mode = await openModal({
          title: `${plural(result.items.length, 'request')} ready to import`,
          subtitle: `From "${file.name}"`,
          iconName: 'file-text',
          body: h('p', `You already have ${plural(existing, 'request')} in this session. Replace them, or add the imported requests after them?`),
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
      const before = mode === 'append' ? existing : 0;
      const first = await store.loadCases(result.items, result.images, { mode });
      const added = store.count - before;
      const shots = result.items.slice(0, added).reduce((n, it) => n + it.images.length, 0);
      const warnings = [];
      if (result.truncated) warnings.push(`Your document has ${result.found.toLocaleString()} filled blocks. Only the first ${def.maxUploadItems} were imported (limit per upload). Upload the rest as a second document with "Add after mine".`);
      if (added < result.items.length) warnings.push(`Only ${added} fit: ${def.maxItemsMessage}`);
      if (result.ignoredRows) warnings.push(`${plural(result.ignoredRows, 'row')} of text outside the Title and Description rows ${result.ignoredRows === 1 ? 'was' : 'were'} not imported (pictures in them were).`);
      for (const r of result.rejected.slice(0, 5)) warnings.push(`${r.name}: ${r.reason}.`);
      if (result.rejected.length > 5) warnings.push(`…and ${result.rejected.length - 5} more screenshots were skipped.`);
      warnings.push('Module, Proposed improvement, Business value and Priority still need filling on each card.');
      const openBtn = button(`Open ${plural(added, 'request')}`, { variant: 'primary', iconRight: 'arrow-right', onclick: () => ws.openCase(first) });
      showResult(warnings.length > 1 ? 'warning' : 'ok',
        `${plural(added, 'request')} imported`,
        `${plural(shots, 'screenshot')} · ${mode === 'append' ? 'added after your existing requests' : 'loaded as a new session'}${result.skipped ? ` · ${plural(result.skipped, 'empty block')} skipped` : ''}`,
        warnings, [openBtn, tryAgain('Upload another document')]);
      toast(`${plural(added, 'request')} imported`, { type: 'success' });
      openBtn.focus();
    } catch (err) {
      if (active) {
        stepEls[active].className = 'step is-error';
        stepEls[active].firstChild.replaceWith(h('span.si', icon('x')));
      }
      if (err instanceof ImportError) {
        showResult('error', err.title, err.message, err.details, [
          button('Download template', { variant: 'primary', iconLeft: 'download', onclick: downloadEnhancementTemplate }),
          tryAgain('Try another file'),
        ]);
      } else {
        console.error(err);
        showResult('error', 'Import failed', 'Something unexpected went wrong while reading the document.', [String(err.message || err)], [tryAgain('Try again')]);
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
