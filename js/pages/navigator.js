// "All test cases" drawer: search, filter, jump to any card and drag to reorder.

import { store, isComplete } from '../core/store.js';
import { h, clear, iconButton } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { sortable } from '../ui/sortable.js';
import { toast } from '../ui/toast.js';
import { testId, debounce } from '../core/util.js';

const FILTERS = [
  ['all', 'All', () => true],
  ['Pass', 'Pass', (c) => c.status === 'Pass'],
  ['Fail', 'Fail', (c) => c.status === 'Fail'],
  ['Blocked', 'Blocked', (c) => c.status === 'Blocked'],
  ['none', 'Not run', (c) => !c.status],
  ['incomplete', 'Incomplete', (c) => !isComplete(c)],
  ['bookmarked', 'Bookmarked', (c) => c.bookmarked],
];

let open = null;

export function openNavigator(ws) {
  if (open) return;
  let filter = 'all';
  let query = '';
  const previous = document.activeElement;

  const search = h('input.input', { type: 'search', placeholder: 'Search title, module, field, steps…', 'aria-label': 'Search test cases' });
  const filters = h('div.filters', { role: 'group', 'aria-label': 'Filter by status' });
  const hint = h('p.drawer-hint');
  const list = h('div.drawer-list', { role: 'list' });
  const title = h('h2', 'All test cases');

  const close = () => {
    if (!open) return;
    open = null;
    offs.forEach((off) => off());
    offSort();
    removeEventListener('keydown', onKey, true);
    drawer.classList.add('is-leaving');
    backdrop.classList.add('is-leaving');
    setTimeout(() => { drawer.remove(); backdrop.remove(); }, 220);
    previous?.focus?.({ preventScroll: true });
  };

  const backdrop = h('div.backdrop', { onclick: close });
  const drawer = h('aside.drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All test cases' },
    h('div.drawer-head',
      h('div.row', title, iconButton('x', 'Close', { onclick: close })),
      h('div.search', icon('search'), search),
      filters),
    hint,
    list);

  const matches = (c) => {
    if (!query) return true;
    const hay = `${c.title}\n${c.module}\n${c.field}\n${c.steps}\n${c.expected}\n${c.actual}\n${c.comments}\n${c.tester}`.toLowerCase();
    return query.split(/\s+/).every((q) => hay.includes(q));
  };

  function renderFilters() {
    clear(filters);
    const cases = store.state.cases;
    for (const [key, label, test] of FILTERS) {
      const n = cases.filter(test).length;
      filters.append(h('button.filter', {
        type: 'button', 'aria-pressed': String(filter === key),
        onclick: () => { filter = key; renderFilters(); renderList(); },
      }, label, h('span.n', String(n))));
    }
  }

  function renderList() {
    const cases = store.state.cases;
    const test = FILTERS.find((f) => f[0] === filter)[2];
    const frag = document.createDocumentFragment();
    let shown = 0;
    cases.forEach((c, i) => {
      if (!test(c) || !matches(c)) return;
      shown++;
      const item = h(`div.nav-item${i === store.index ? '.is-current' : ''}`, {
        role: 'listitem', tabindex: 0, dataset: { index: i },
        'aria-label': `${testId(i)} ${c.title || 'Untitled'}`,
        'aria-current': i === store.index ? 'true' : null,
      },
      h('span.drag-handle', { 'aria-hidden': 'true', title: 'Drag to reorder' }, icon('grip')),
      h('span.nid', testId(i)),
      h('span.ntitle', h('b', (c.title || 'Untitled test case').split('\n')[0]), h('small', [c.module, c.field].filter(Boolean).join(' · ') || 'No module yet')),
      h('span.nmeta',
        c.bookmarked ? h('span.mark-bookmark', { title: 'Bookmarked' }, icon('bookmark')) : null,
        !isComplete(c) ? h('span.mark-incomplete', { title: 'Missing required fields' }, icon('alert-circle')) : null,
        c.images.length ? h('span.muted', { title: 'Screenshots' }, icon('image')) : null,
        h(`span.dot${c.status ? `.is-${c.status.toLowerCase()}` : ''}`, { title: c.status || 'Not run' })));
      frag.append(item);
    });
    clear(list);
    if (!shown) list.append(h('div.empty-note', icon('search'), h('p', 'No test cases match.')));
    else list.append(frag);
    const reorderable = filter === 'all' && !query;
    hint.textContent = reorderable
      ? `${cases.length.toLocaleString()} test cases · drag ⠿ or press Alt+↑/↓ to reorder · IDs follow the order`
      : `${shown.toLocaleString()} of ${cases.length.toLocaleString()} shown · clear the search and filter to reorder`;
    list.classList.toggle('is-filtered', !reorderable);
    list.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
  }

  const go = (i) => {
    close();
    ws.openCase(i);
  };

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item && !e.target.closest('.drag-handle')) go(Number(item.dataset.index));
  });
  list.addEventListener('keydown', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    const i = Number(item.dataset.index);
    if (e.key === 'Enter') { e.preventDefault(); go(i); }
    else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (filter !== 'all' || query) { toast('Clear the search and filter to reorder.', { type: 'info' }); return; }
      const to = e.key === 'ArrowUp' ? i - 1 : i + 1;
      if (to < 0 || to >= store.count) return;
      store.moveCase(i, to);
      list.querySelector(`[data-index="${to}"]`)?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sib = e.key === 'ArrowDown' ? item.nextElementSibling : item.previousElementSibling;
      sib?.focus();
    }
  });

  const offSort = sortable(list, {
    itemSelector: '.nav-item',
    handleSelector: '.drag-handle',
    mouseAnywhere: false,
    scrollEl: list,
    enabled: () => filter === 'all' && !query,
    onMove: (from, to) => {
      if (from === to) renderList();
      else {
        store.moveCase(from, to);
        toast(`Moved to position ${to + 1}. Test IDs were renumbered.`, { type: 'success', duration: 2500 });
      }
    },
  });

  search.addEventListener('input', debounce(() => { query = search.value.trim().toLowerCase(); renderList(); }, 120));

  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open], .lightbox')) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  addEventListener('keydown', onKey, true);

  const offs = [
    store.on('structure', () => { renderFilters(); renderList(); }),
    store.on('bookmark', () => { renderFilters(); renderList(); }),
  ];

  document.body.append(backdrop, drawer);
  open = { close };
  renderFilters();
  renderList();
  search.focus({ preventScroll: true });
}

export const closeNavigator = () => open?.close();
