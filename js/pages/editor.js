// The card editor shared by every workspace: one large card per test case or enhancement request
// with every field of the workspace, live validation, screenshots (browse / drag & drop / paste) and
// fast keyboard navigation. Only the visible card is rendered, so thousands of cards stay instant.

import { APP } from '../core/config.js';
import { h, clear, button, iconButton, autoGrow, pickFiles } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast, undoToast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { openLightbox } from '../ui/lightbox.js';
import { sortable } from '../ui/sortable.js';
import { modKey, plural, isBlank } from '../core/util.js';
import { processImageFiles, imageFilesFrom, hasFiles } from '../services/images.js';

const blocking = () => document.querySelector('dialog[open], .drawer, .lightbox, .progress-overlay');

export function mount(root, ws) {
  const { store, def } = ws;
  const { fields: FIELDS, groups: GROUPS, fieldByKey: FIELD_BY_KEY, requiredKeys: REQUIRED_KEYS, noun, itemId } = def;
  const { isComplete, missingFields, hasContent } = store;
  const firstKey = FIELDS[0].key;
  const clearRules = FIELDS.filter((f) => f.clears);
  const inputs = {};   // key -> { wrap, get, set, focus, el }
  let current = store.current;
  let lastShake = 0;
  let pendingAnim = null;

  // every navigation goes through here so the card animates in the right direction
  const navTo = (i, anim) => {
    pendingAnim = anim;
    const moved = store.goTo(i);
    pendingAnim = null;
    return moved;
  };

  // ---------- header ----------
  const idChip = h('span.tc-id');
  const headTitle = h('span.tc-head-title');
  const bookmarkBtn = h('button.bookmark-btn', {
    type: 'button', 'aria-pressed': 'false', 'data-tip': `Bookmark (${modKey}+B)`,
    onclick: () => toggleBookmark(),
  }, icon('bookmark'));
  const counterPrev = iconButton('chevron-left', `Previous ${noun.one}`, { onclick: () => prev() });
  const counterNext = iconButton('chevron-right', `Next ${noun.one}`, { onclick: () => next() });
  const counterValue = h('button.counter-value', { type: 'button', 'data-tip': `Jump to a ${noun.one}`, onclick: () => editCounter() });
  const counter = h('div.counter', { role: 'group', 'aria-label': `${noun.One} position` }, counterPrev, counterValue, counterNext);
  const inlineFirst = iconButton('first', `Go to first ${noun.one}`, { class: 'icon-btn inline-edge', onclick: () => goFirst() });
  const inlineLast = iconButton('last', `Go to last ${noun.one}`, { class: 'icon-btn inline-edge', onclick: () => goLast() });
  const live = h('span.sr-only', { 'aria-live': 'polite' });

  // ---------- progress ----------
  const progressText = h('span.tc-progress-text');
  const progressFill = h('div.tc-progress-fill');
  const progress = h('div.tc-progress', progressText, h('div.tc-progress-track', progressFill));

  // ---------- body ----------
  const body = h('div.tc-body');
  GROUPS.forEach((g, gi) => {
    const grid = h('div.field-grid');
    for (const f of FIELDS.filter((x) => x.group === g.key)) {
      const field = buildField(f);
      inputs[f.key] = field;
      grid.append(field.wrap);
    }
    body.append(h('section.tc-section',
      h('div.tc-section-head', h('span.num', String(gi + 1)), h('h3', g.title), h('span.hint', g.hint)),
      grid));
  });

  // evidence
  const shots = h('div.shots');
  const shotsMeta = h('div.shots-meta');
  const dropzone = h('div.dropzone', { tabindex: 0, role: 'button', 'aria-label': 'Add screenshots: browse, drop or paste images' },
    h('div.chip-icon.is-soft', icon('image')),
    h('div.dropzone-copy',
      h('strong', 'Attach screenshots'),
      h('span', `Drag & drop images here, press ${modKey}+V to paste from the clipboard, or browse. PNG, JPEG, GIF, WebP or BMP.`)),
    h('div.dropzone-actions',
      button('Browse', { variant: 'primary', size: 'sm', iconLeft: 'upload', onclick: (e) => { e.stopPropagation(); browseImages(); } })));
  dropzone.addEventListener('click', (e) => { if (!e.target.closest('button')) browseImages(); });
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); browseImages(); } });
  body.append(h('section.tc-section',
    h('div.tc-section-head', h('span.num', String(GROUPS.length + 1)), h('h3', def.evidence.title), h('span.hint', def.evidence.hint)),
    dropzone, shots, shotsMeta));

  // ---------- footer ----------
  const prevBtn = button('Prev', { variant: 'secondary', iconLeft: 'chevron-left', class: 'btn-prev', onclick: () => prev() });
  const clearBtn = button('Clear', { variant: 'ghost', iconLeft: 'eraser', onclick: () => clearCurrent() });
  const deleteBtn = button('Delete', { variant: 'danger-soft', iconLeft: 'trash', onclick: () => deleteCurrent() });
  const nextBtn = button('Next', { variant: 'primary', iconRight: 'chevron-right', class: 'btn-next', onclick: () => next() });
  const nextWrap = h('div.next-wrap', { 'data-tip-pos': 'top-end', onclick: (e) => { if (nextBtn.disabled && e.target === nextWrap) showMissing(); } }, nextBtn);
  const foot = h('footer.tc-foot', prevBtn, h('div.tc-foot-mid', clearBtn, deleteBtn), nextWrap);

  const card = h('article.tc-card', { 'aria-label': `${noun.One} editor` },
    h('header.tc-head', idChip, headTitle, bookmarkBtn, h('div.tc-nav', inlineFirst, counter, inlineLast), live),
    progress, body, foot);

  // ---------- edge navigation + finish ----------
  const edgeFirst = h('button.edge-nav.is-first', { type: 'button', 'aria-label': `Go to first ${noun.one}`, onclick: () => goFirst() },
    icon('chevron-left'), h('span.edge-label', `Go to first ${noun.one}`));
  const edgeLast = h('button.edge-nav.is-last', { type: 'button', 'aria-label': `Go to last ${noun.one}`, onclick: () => goLast() },
    icon('chevron-right'), h('span.edge-label', `Go to last ${noun.one}`));
  const finishBtn = button('Finish', { variant: 'primary', size: 'lg', iconLeft: 'check-circle', onclick: () => finish() });
  const hints = h('div.shortcut-hints',
    h('span', h('kbd', modKey), '+', h('kbd', 'Enter'), 'next'),
    h('span', h('kbd', modKey), '+', h('kbd', 'Shift'), '+', h('kbd', 'Enter'), 'previous'),
    h('span', h('kbd', modKey), '+', h('kbd', 'B'), 'bookmark'),
    h('span', h('kbd', 'Tab'), 'next field'),
    h('span', h('kbd', modKey), '+', h('kbd', 'V'), 'paste screenshot'));

  // edge arrows live on <body> so the page-enter animation never moves them
  document.body.append(edgeFirst, edgeLast);
  root.append(h('div.editor', card,
    h('div.finish-row', finishBtn, h('p.muted', def.finishHint), hints)));

  // ---------- field builders ----------

  function buildField(f) {
    const id = `f-${f.key}`;
    const label = h('label.field-label', { for: id },
      f.label,
      f.required ? h('span.req', { 'aria-hidden': 'true' }, '*') : h('span.opt', '(optional)'),
      h('span.tick', icon('check')));
    const wrap = h(`div.field${f.wide ? '.is-wide' : ''}`, { dataset: { key: f.key } }, label);
    let el;
    let get;
    let set;
    let fit = () => {};

    if (f.kind === 'segment') {
      label.removeAttribute('for');
      label.id = `${id}-label`;
      const group = h('div.segmented', { role: 'radiogroup', 'aria-labelledby': label.id, 'aria-required': f.required ? 'true' : null });
      const opts = f.options.map((value) => h('button.seg', {
        type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: -1, dataset: { value },
        onclick: () => {
          const now = current[f.key] === value ? '' : value;
          store.setField(current.id, f.key, now);
          set(current[f.key]);
          afterChange(f.key);
        },
      }, value));
      group.append(...opts);
      group.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const enabled = opts.filter((o) => !o.disabled);
        const at = enabled.indexOf(document.activeElement);
        const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        const target = enabled[(at + step + enabled.length) % enabled.length];
        target.focus();
        target.click();
      });
      get = () => opts.find((o) => o.getAttribute('aria-checked') === 'true')?.dataset.value || '';
      set = (v) => {
        let focusable = null;
        for (const o of opts) {
          const on = o.dataset.value === v;
          o.setAttribute('aria-checked', String(on));
          if (on) focusable = o;
        }
        opts.forEach((o) => { o.tabIndex = -1; });
        (focusable || opts[0]).tabIndex = 0;
      };
      el = group;
      wrap.append(group);
      if (f.hint) wrap.append(h('span.field-hint', f.hint));
      return { wrap, el, get, set, fit, focus: () => (opts.find((o) => o.tabIndex === 0) || opts[0]).focus(), opts, group };
    }

    if (f.kind === 'select') {
      el = h('select.select', { id, name: f.key });
      const fillOptions = (value) => {
        const list = store.state.lists[f.list] || [];
        clear(el);
        el.append(h('option', { value: '' }, 'Select…'));
        for (const v of list) el.append(h('option', { value: v }, v));
        if (value && !list.includes(value)) el.append(h('option', { value }, value));
        el.value = value || '';
      };
      el.addEventListener('change', () => { store.setField(current.id, f.key, el.value); afterChange(f.key); });
      get = () => el.value;
      set = (v) => fillOptions(v);
      wrap.append(el);
      return { wrap, el, get, set, fit, focus: () => el.focus(), refresh: () => fillOptions(el.value) };
    }

    if (f.kind === 'textarea') {
      el = h('textarea.textarea', { id, name: f.key, rows: f.rows || 2, placeholder: f.placeholder || '', spellcheck: true, maxlength: APP.maxFieldLength });
      fit = autoGrow(el);
    } else {
      el = h('input.input', { id, name: f.key, type: 'text', placeholder: f.placeholder || '', autocomplete: 'off', maxlength: APP.maxFieldLength, spellcheck: f.kind !== 'combo' });
      if (f.kind === 'combo') {
        const dl = h('datalist', { id: `${id}-list` });
        el.setAttribute('list', dl.id);
        el.addEventListener('focus', () => {
          clear(dl);
          for (const v of store.suggestions(f.key)) dl.append(h('option', { value: v }));
        });
        wrap.append(dl);
      }
    }
    if (f.required) el.setAttribute('aria-required', 'true');
    el.addEventListener('input', () => {
      store.setField(current.id, f.key, el.value);
      afterChange(f.key);
    });
    get = () => el.value;
    set = (v) => { if (el.value !== v) el.value = v; fit(); };
    wrap.append(el);
    if (f.enterHint) wrap.append(h('span.field-hint', h('kbd', 'Enter'), ' adds a new line · ', h('kbd', modKey), '+', h('kbd', 'Enter'), ` goes to the next ${noun.one}`));
    return { wrap, el, get, set, fit, focus: () => el.focus() };
  }

  // ---------- rendering ----------

  function fill(anim) {
    current = store.current;
    const i = store.index;
    for (const f of FIELDS) {
      inputs[f.key].set(current[f.key] || '');
      inputs[f.key].wrap.classList.remove('is-invalid');
    }
    renderShots();
    refresh();
    if (anim) {
      body.classList.remove('anim-next', 'anim-prev', 'anim-jump');
      void body.offsetWidth;
      body.classList.add(`anim-${anim}`);
      // bring the top of the new card into view when the user was further down the form
      const headerH = document.getElementById('appHeader')?.offsetHeight || 0;
      if (card.isConnected && card.getBoundingClientRect().top < headerH) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    live.textContent = `${noun.One} ${i + 1} of ${store.count}`;
    requestAnimationFrame(() => FIELDS.forEach((f) => inputs[f.key].fit()));
  }

  function refresh() {
    const i = store.index;
    const n = store.count;
    const done = REQUIRED_KEYS.length - missingFields(current).length;
    const complete = done === REQUIRED_KEYS.length;
    idChip.textContent = itemId(i);
    const t = (current.title || '').split('\n')[0].trim();
    headTitle.textContent = t || `Untitled ${noun.one}`;
    headTitle.classList.toggle('is-empty', !t);
    clear(counterValue).append(String(i + 1), h('span.sep', '/'), String(n));
    counterValue.setAttribute('aria-label', `${noun.One} ${i + 1} of ${n}. Click to jump.`);
    bookmarkBtn.setAttribute('aria-pressed', String(current.bookmarked));
    bookmarkBtn.dataset.tip = current.bookmarked ? `Remove bookmark (${modKey}+B)` : `Bookmark (${modKey}+B)`;
    bookmarkBtn.setAttribute('aria-label', current.bookmarked ? 'Remove bookmark' : `Bookmark this ${noun.one}`);
    progressText.textContent = complete ? 'All required fields done' : `${done} of ${REQUIRED_KEYS.length} required fields`;
    progressFill.style.width = `${(done / REQUIRED_KEYS.length) * 100}%`;
    progress.classList.toggle('is-complete', complete);

    const atFirst = i === 0;
    const atLast = i === n - 1;
    prevBtn.disabled = atFirst;
    counterPrev.disabled = atFirst;
    nextBtn.disabled = !complete;
    counterNext.disabled = !complete;
    nextWrap.dataset.tip = complete
      ? (atLast ? `Save and start ${noun.one} ${n + 1}` : `Go to ${noun.one} ${i + 2}`)
      : 'Fill all required (*) fields to continue';
    clearBtn.disabled = !hasContent(current);
    deleteBtn.disabled = n === 1 && !hasContent(current);
    edgeFirst.disabled = inlineFirst.disabled = atFirst;
    edgeLast.disabled = inlineLast.disabled = atLast;

    for (const f of FIELDS) {
      const filled = !isBlank(current[f.key]);
      inputs[f.key].wrap.classList.toggle('is-filled', filled && f.required);
      if (filled) inputs[f.key].wrap.classList.remove('is-invalid');
    }
    // fields that a rule clears (e.g. Severity when the Status is Pass) are disabled while it holds
    for (const f of clearRules) {
      const held = current[f.key] === f.clears.when;
      for (const k of f.clears.fields) {
        inputs[k].opts?.forEach((o) => { o.disabled = held; });
        inputs[k].group?.classList.toggle('is-disabled', held);
      }
    }
  }

  function afterChange(key) {
    for (const f of clearRules) if (f.key === key) for (const k of f.clears.fields) inputs[k].set(current[k]);
    refresh();
  }

  // ---------- screenshots ----------

  async function renderShots() {
    const c = current;
    clear(shots);
    const ids = c.images.slice();
    shotsMeta.textContent = ids.length ? `${plural(ids.length, 'screenshot')} · drag to reorder · click to view` : '';
    shotsMeta.hidden = !ids.length;
    const nodes = ids.map((id, k) => {
      const img = h('img', { alt: `Screenshot ${k + 1}`, loading: 'lazy', decoding: 'async', draggable: false });
      const node = h('div.shot', { dataset: { id }, tabindex: 0, role: 'button', 'aria-label': `View screenshot ${k + 1}` },
        img,
        h('span.shot-num', `#${k + 1}`),
        h('button.shot-handle.drag-handle', { type: 'button', 'aria-label': 'Drag to reorder', tabindex: -1 }, icon('move')),
        h('button.shot-remove', {
          type: 'button', 'aria-label': `Remove screenshot ${k + 1}`,
          onclick: (e) => { e.stopPropagation(); removeShot(id); },
        }, icon('x')));
      node.addEventListener('click', (e) => { if (!e.target.closest('button')) viewShots(k); });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viewShots(k); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeShot(id); }
      });
      store.imageUrl(id, 'thumb').then((url) => { if (url) img.src = url; });
      return node;
    });
    shots.append(...nodes);
  }

  function viewShots(start) {
    const c = current;
    openLightbox(c.images.map((id, k) => ({
      load: () => store.imageUrl(id, 'full'),
      caption: `${itemId(store.indexOf(c.id))} · Screenshot ${k + 1} of ${c.images.length}`,
    })), start);
  }

  function removeShot(id) {
    const handle = store.removeImage(current.id, id);
    undoToast('Screenshot removed', handle);
  }

  async function addImageFiles(files, source) {
    const c = current;
    const room = APP.maxImagesPerCase - c.images.length;
    if (room <= 0) {
      toast(`A ${noun.one} can hold up to ${APP.maxImagesPerCase} screenshots.`, { type: 'warning' });
      return;
    }
    const { records, rejected } = await processImageFiles(files.slice(0, room + 5), { source });
    const added = await store.addImages(c.id, records);
    if (added) toast(`${plural(added, 'screenshot')} added to ${itemId(store.indexOf(c.id))}`, { type: 'success' });
    if (rejected.length) {
      toast(rejected.slice(0, 3).map((r) => `${r.name}: ${r.reason}`).join(' · '), { type: 'error', title: `${plural(rejected.length, 'file')} not added` });
    }
    if (records.length > added) toast(`Only ${APP.maxImagesPerCase} screenshots fit on one ${noun.one}.`, { type: 'warning' });
  }

  async function browseImages() {
    const files = await pickFiles({ accept: 'image/png,image/jpeg,image/gif,image/webp,image/bmp', multiple: true });
    if (files.length) addImageFiles(files, 'file');
  }

  const offSort = sortable(shots, {
    itemSelector: '.shot',
    handleSelector: '.drag-handle',
    layout: 'grid',
    onMove: (from, to) => {
      if (from === to) renderShots();
      else store.moveImage(current.id, from, to);
    },
  });

  // drag & drop onto the card
  let dragDepth = 0;
  const onDragEnter = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth++;
    dropzone.classList.add('is-over');
  };
  const onDragOver = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropzone.classList.remove('is-over');
  };
  const onDrop = (e) => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('is-over');
    const files = imageFilesFrom(e.dataTransfer);
    if (files.length) addImageFiles(files, 'drop');
  };
  card.addEventListener('dragenter', onDragEnter);
  card.addEventListener('dragover', onDragOver);
  card.addEventListener('dragleave', onDragLeave);
  card.addEventListener('drop', onDrop);
  // stop the browser from navigating away when a file is dropped outside the card
  const docDrag = (e) => { if (hasFiles(e.dataTransfer) && !card.contains(e.target)) { e.preventDefault(); if (e.type === 'drop') toast(`Drop screenshots onto the ${noun.one} card.`, { type: 'info' }); } };
  document.addEventListener('dragover', docDrag);
  document.addEventListener('drop', docDrag);

  // clipboard paste (images only; text pastes into fields normally)
  const onPaste = (e) => {
    if (blocking()) return;
    const all = imageFilesFrom(e.clipboardData);
    const files = all.filter((f) => f.type.startsWith('image/'));
    const t = e.target;
    const inTextField = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'));
    if (!files.length) {
      if (all.length && !inTextField) toast('Only images can be pasted as screenshots.', { type: 'warning' });
      return;
    }
    const hasText = [...(e.clipboardData.types || [])].includes('text/plain');
    if (inTextField && hasText) return; // e.g. cells copied from Excel: keep the text
    e.preventDefault();
    addImageFiles(files, 'paste');
  };
  document.addEventListener('paste', onPaste);

  // ---------- navigation ----------

  function showMissing() {
    const missing = missingFields(current);
    if (!missing.length) return false;
    for (const key of missing) inputs[key].wrap.classList.add('is-invalid');
    const first = inputs[missing[0]];
    if (Date.now() - lastShake > 400) {
      lastShake = Date.now();
      for (const key of missing) {
        const w = inputs[key].wrap;
        w.classList.remove('shake');
        void w.offsetWidth;
        w.classList.add('shake');
      }
    }
    first.wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    first.focus();
    toast(`Still needed: ${missing.map((k) => FIELD_BY_KEY[k].label).join(', ')}`, { type: 'warning', title: 'Complete the required fields' });
    return true;
  }

  function next({ fromKeyboard = false } = {}) {
    if (!isComplete(current)) {
      showMissing();
      return;
    }
    if (store.index < store.count - 1) {
      navTo(store.index + 1, 'next');
      if (fromKeyboard) inputs[firstKey].focus({ preventScroll: true });
      return;
    }
    const at = store.addCase();
    if (at < 0) {
      toast(def.maxItemsMessage, { type: 'warning', title: 'Limit reached' });
      return;
    }
    navTo(at, 'next');
    inputs[firstKey].focus({ preventScroll: true });
  }

  function prev({ fromKeyboard = false } = {}) {
    if (store.index === 0) return;
    navTo(store.index - 1, 'prev');
    if (fromKeyboard) inputs[firstKey].focus({ preventScroll: true });
  }

  function goFirst() {
    navTo(0, 'prev');
  }

  function goLast() {
    navTo(store.count - 1, 'next');
  }

  function toggleBookmark() {
    const on = store.toggleBookmark(current.id);
    bookmarkBtn.classList.remove('pop');
    void bookmarkBtn.offsetWidth;
    bookmarkBtn.classList.add('pop');
    toast(on ? `${itemId(store.index)} bookmarked` : `Bookmark removed from ${itemId(store.index)}`, { type: on ? 'success' : 'info', duration: 2200 });
  }

  function clearCurrent() {
    if (!hasContent(current)) return;
    const handle = store.clearCase(current.id);
    undoToast(`${itemId(store.index)} cleared`, handle);
    inputs[firstKey].focus();
  }

  function deleteCurrent() {
    const label = itemId(store.index);
    const handle = store.deleteCase(store.index);
    undoToast(`${label} deleted`, handle);
  }

  function editCounter() {
    const input = h('input.counter-input', { type: 'number', min: 1, max: store.count, value: store.index + 1, 'aria-label': `Go to ${noun.one} (1 to ${store.count})` });
    counterValue.replaceWith(input);
    input.select();
    let finished = false;
    const done = (go) => {
      if (finished) return;
      finished = true;
      const n = Number(input.value);
      input.replaceWith(counterValue);
      if (go && Number.isInteger(n) && n >= 1 && n <= store.count && n - 1 !== store.index) {
        navTo(n - 1, n - 1 > store.index ? 'next' : 'prev');
      } else if (go && (!Number.isInteger(n) || n < 1 || n > store.count)) {
        toast(`Enter a number from 1 to ${store.count}.`, { type: 'warning' });
      }
      counterValue.focus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
    });
    input.addEventListener('blur', () => done(true));
  }

  async function finish() {
    const dropped = store.pruneEmpty();
    if (dropped) toast(`${plural(dropped, `empty ${noun.one}`)} removed`, { type: 'info' });
    const cases = store.state.cases;
    if (!cases.some(hasContent)) {
      toast(`Add at least one ${noun.one} before finishing.`, { type: 'warning' });
      inputs[firstKey].focus();
      return;
    }
    const incomplete = cases.map((c, i) => ({ c, i })).filter((x) => !isComplete(x.c));
    if (incomplete.length) {
      const list = h('ul', incomplete.slice(0, 6).map(({ c, i }) => h('li', h('b', itemId(i)), ` — missing ${missingFields(c).map((k) => FIELD_BY_KEY[k].label).join(', ')}`)));
      if (incomplete.length > 6) list.append(h('li', `…and ${incomplete.length - 6} more`));
      const choice = await openModal({
        title: `${plural(incomplete.length, noun.one, noun.many)} ${incomplete.length === 1 ? 'is' : 'are'} incomplete`,
        iconName: 'alert-triangle',
        tone: 'warning',
        body: [h('p', `These ${noun.many} are missing required fields. You can fix them now, or continue and they will be reported as they are.`), list],
        actions: [
          { label: 'Continue anyway', value: 'continue' },
          { label: `Fix ${itemId(incomplete[0].i)}`, value: 'fix', variant: 'primary', autofocus: true },
        ],
      });
      if (!choice) return;
      if (choice === 'fix') {
        navTo(incomplete[0].i, 'jump');
        showMissing();
        return;
      }
    }
    location.hash = ws.routes.report;
  }

  // ---------- keyboard ----------

  const onKey = (e) => {
    if (e.isComposing || blocking()) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev({ fromKeyboard: true });
      else next({ fromKeyboard: true });
      return;
    }
    if (mod && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleBookmark();
      return;
    }
    // Enter in a single-line field moves to the next field instead of doing nothing
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && e.target.matches?.('.tc-card input.input')) {
      e.preventDefault();
      const focusables = [...card.querySelectorAll('input.input, textarea, select, .seg[tabindex="0"]')].filter((x) => !x.disabled);
      const at = focusables.indexOf(e.target);
      focusables[at + 1]?.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  // ---------- store events ----------

  const offs = [
    store.on('navigate', () => fill(pendingAnim || 'jump')),
    store.on('structure', () => { fill(store.current !== current ? 'jump' : null); }),
    store.on('case', ({ id, key }) => {
      if (id !== current.id) return;
      if (key === '*') fill(null);
      else refresh();
    }),
    store.on('images', ({ id }) => { if (id === current.id) { renderShots(); refresh(); } }),
    store.on('bookmark', () => refresh()),
    store.on('lists', () => FIELDS.forEach((f) => inputs[f.key].refresh?.())),
  ];

  fill('jump');
  if (!hasContent(current)) setTimeout(() => inputs[firstKey].focus({ preventScroll: true }), 50);

  return () => {
    offs.forEach((off) => off());
    offSort();
    edgeFirst.remove();
    edgeLast.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('dragover', docDrag);
    document.removeEventListener('drop', docDrag);
    store.flush();
  };
}
