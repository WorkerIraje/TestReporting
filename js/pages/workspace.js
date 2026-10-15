// Test Cases workspace: tabs (Create / Upload / Reporting), bookmarks, navigator and the
// project menu. Each tab is a sub-view with its own mount/cleanup.

import { store, hasContent } from '../core/store.js';
import { APP } from '../core/config.js';
import { h, clear, button, iconButton, pickFiles, saveBlob } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, progressOverlay, openModal } from '../ui/modal.js';
import { openPopover, openMenu, closePopover } from '../ui/popover.js';
import { testId, plural, timeAgo, safeFileName, todayISO } from '../core/util.js';
import { saveProject, openProject } from '../services/project-file.js';
import { downloadTemplate } from './welcome.js';
import { openNavigator } from './navigator.js';
import * as editor from './editor.js';
import * as upload from './upload.js';
import * as report from './report.js';

const VIEWS = { create: editor, upload, report };
let restoredBannerShown = false;

export const ws = {
  /** Jump to a test case card from anywhere in the workspace. */
  openCase(index) {
    store.goTo(index);
    if (!location.hash.startsWith('#/testcases/create')) location.hash = '#/testcases/create';
  },
};

let ctx = null;

export function mount(root, params) {
  const title = h('h1', 'Test Cases');
  const sub = h('p');
  const tabs = h('nav.tabs', { role: 'tablist', 'aria-label': 'Test case views' });
  const bookmarkBtn = h('button.icon-btn.is-outlined', {
    type: 'button', 'aria-label': 'Bookmarked test cases', 'data-tip': 'Bookmarks', 'aria-haspopup': 'dialog',
    onclick: () => showBookmarks(bookmarkBtn),
  }, icon('bookmark'), h('span.badge', { hidden: true }));
  const navBtn = button('All test cases', { variant: 'secondary', size: 'sm', iconLeft: 'list', onclick: () => openNavigator(ws) });
  const moreBtn = iconButton('more', 'More actions', { class: 'icon-btn is-outlined', 'aria-haspopup': 'menu', onclick: () => showMenu(moreBtn) });
  const tools = h('div.ws-tools',
    button('Download template', { variant: 'soft', size: 'sm', iconLeft: 'download', onclick: downloadTemplate }),
    navBtn, bookmarkBtn, moreBtn);
  const banner = h('div');
  const view = h('div.ws-view');

  root.append(h('section.page.page-wide',
    h('div.ws-head', h('div.ws-title', title, sub), tabs, tools),
    banner,
    view));

  const renderTabs = (active) => {
    clear(tabs);
    const s = store.stats();
    const tab = (key, ic, label, extra) => h('a.tab', {
      href: `#/testcases/${key}`, role: 'tab', 'aria-selected': String(active === key),
    }, icon(ic), label, extra);
    tabs.append(
      tab('create', 'edit', 'Create', h('span.count', String(store.count))),
      tab('upload', 'upload', 'Upload'),
      tab('report', 'chart', 'Reporting', s.executed ? h('span.count', `${Math.round(s.passRate * 100)}%`) : null));
  };

  const renderSub = () => {
    const meaningful = store.state.cases.filter(hasContent).length;
    sub.textContent = meaningful
      ? `${plural(meaningful, 'test case')} in this session · up to ${APP.maxCases.toLocaleString()} supported`
      : 'Write, import and report your test cases';
    const n = store.bookmarks().length;
    const badge = bookmarkBtn.querySelector('.badge');
    badge.hidden = !n;
    badge.textContent = n > 99 ? '99+' : String(n);
    bookmarkBtn.classList.toggle('has-marks', n > 0);
  };

  const renderBanner = () => {
    clear(banner);
    const r = store.state.restored;
    if (!r || restoredBannerShown) return;
    restoredBannerShown = true;
    const el = h('div.banner', { role: 'status' },
      icon('restart'),
      h('div.grow', h('b', 'Welcome back. '), `Your last session was restored: ${plural(r.count, 'test case')}, saved ${timeAgo(r.savedAt)}.`),
      button('Start a new session', { variant: 'ghost', size: 'sm', onclick: async () => { if (await newSession()) el.remove(); } }),
      iconButton('x', 'Dismiss', { onclick: () => el.remove() }));
    banner.append(el);
  };

  const offs = [
    store.on('structure', () => { renderTabs(ctx.tab); renderSub(); }),
    store.on('case', () => renderSub()),
    store.on('bookmark', () => renderSub()),
  ];

  ctx = { tab: null, view, renderTabs, cleanupView: null, offs, navBtn, bookmarkBtn };
  renderBanner();
  renderSub();
  update(params);

  return () => {
    closePopover();
    ctx.cleanupView?.();
    offs.forEach((off) => off());
    ctx = null;
  };
}

export function update(params) {
  if (!ctx) return;
  const tab = VIEWS[params.tab] ? params.tab : 'create';
  ctx.renderTabs(tab);
  if (ctx.tab === tab) return;
  closePopover();
  ctx.cleanupView?.();
  clear(ctx.view);
  ctx.tab = tab;
  document.body.dataset.tab = tab;
  ctx.cleanupView = VIEWS[tab].mount(ctx.view, ws) || null;
  scrollTo({ top: 0, behavior: 'instant' });
}

function showBookmarks(anchor) {
  const marks = store.bookmarks();
  const list = h('div.popover-list');
  const render = () => {
    clear(list);
    const items = store.bookmarks();
    if (!items.length) {
      list.append(h('div.empty-note', icon('bookmark'), h('p', 'No bookmarks yet.'), h('p.muted', 'Press Ctrl + B on any card to bookmark it.')));
      return;
    }
    for (const { c, i } of items) {
      list.append(h('div.pop-item', {
        role: 'button', tabindex: 0,
        onclick: (e) => { if (!e.target.closest('.icon-btn')) { closePopover(); ws.openCase(i); } },
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { closePopover(); ws.openCase(i); } },
      },
      h('span.nid', testId(i)),
      h('span', h('b', c.title || 'Untitled test case'), h('small.muted', c.module || 'No module')),
      iconButton('x', 'Remove bookmark', { onclick: () => { store.toggleBookmark(c.id); render(); } })));
    }
  };
  render();
  openPopover(anchor, [
    h('div.popover-head',
      h('h3', icon('bookmark'), `Bookmarks (${marks.length})`),
      marks.length ? button('Clear all', { variant: 'ghost', size: 'sm', onclick: () => { store.clearBookmarks(); closePopover(); toast('All bookmarks cleared', { type: 'success' }); } }) : null),
    list,
  ], { label: 'Bookmarks' });
}

function showMenu(anchor) {
  openMenu(anchor, [
    { icon: 'save', label: 'Save project file', hint: 'All test cases and screenshots in one .iqa file', run: saveProjectFile },
    { icon: 'folder-open', label: 'Open project file', hint: 'Continue a session saved by you or a teammate', run: openProjectFile },
    'sep',
    { icon: 'restart', label: 'Start a new session', hint: 'Clears every test case in this browser', danger: true, run: newSession },
  ], { label: 'More actions' });
}

async function saveProjectFile() {
  const p = progressOverlay('Saving project file');
  try {
    const blob = await saveProject(store, (f) => p.update(f, 'Packing test cases and screenshots…'));
    const name = `${safeFileName(store.state.report.product || store.state.report.title || 'Iraje_QA')}_${todayISO()}${APP.projectExt}`;
    saveBlob(blob, name);
    toast(`Saved ${name}`, { type: 'success', title: 'Project file ready' });
  } catch (err) {
    console.error(err);
    toast(err.message || 'The project could not be saved.', { type: 'error' });
  } finally {
    p.close();
  }
}

async function openProjectFile() {
  const [file] = await pickFiles({ accept: APP.projectExt });
  if (!file) return;
  let mode = 'replace';
  if (store.state.cases.some(hasContent)) {
    mode = await openModal({
      title: 'Open project file',
      subtitle: `"${file.name}"`,
      iconName: 'folder-open',
      body: h('p', 'You already have test cases in this session. Replace them, or add the project\'s test cases after them?'),
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Add after mine', value: 'append' },
        { label: 'Replace mine', value: 'replace', variant: 'primary', autofocus: true },
      ],
    });
    if (!mode) return;
  }
  const p = progressOverlay('Opening project');
  try {
    const data = await openProject(file, (f) => p.update(f, 'Checking screenshots…'));
    const first = await store.loadCases(data.cases, data.images, { mode, report: data.report });
    toast(`${plural(data.cases.length, 'test case')} loaded from ${file.name}`, { type: 'success', title: 'Project opened' });
    ws.openCase(first);
  } catch (err) {
    toast(err.message || 'The project could not be opened.', { type: 'error', title: err.title || 'Could not open project' });
  } finally {
    p.close();
  }
}

export async function newSession() {
  const ok = await confirmDialog({
    title: 'Start a new session?',
    message: 'Every test case, screenshot and bookmark in this browser will be removed. Save a project file first if you may need them again.',
    confirmLabel: 'Clear everything',
    danger: true,
  });
  if (!ok) return false;
  await store.reset();
  toast('New session started', { type: 'success' });
  ws.openCase(0);
  return true;
}
