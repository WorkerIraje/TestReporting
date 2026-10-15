// Bootstrap: restores the autosaved session, wires the header and routes between pages.

import { store } from './core/store.js';
import { h, clear } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { showShortcuts } from './ui/shortcuts.js';
import { timeAgo } from './core/util.js';
import { readTemplateLists } from './services/template.js';
import * as welcome from './pages/welcome.js';
import * as home from './pages/home.js';
import * as workspace from './pages/workspace.js';

const ROUTES = [
  { path: /^\/?$/, page: welcome, nav: null },
  { path: /^\/home$/, page: home, nav: 'home' },
  { path: /^\/testcases(?:\/(create|upload|report))?$/, page: workspace, nav: 'testcases' },
];

const app = document.getElementById('app');
const nav = document.getElementById('headerNav');
const tools = document.getElementById('headerTools');
let cleanup = null;
let lastPage = null;

function renderNav(active, tab) {
  clear(nav);
  if (!active) return;
  const link = (href, name, label, current) => h('a', { href, 'aria-current': current ? 'page' : null }, icon(name), h('span', label));
  nav.append(
    link('#/home', 'home', 'Home', active === 'home'),
    link('#/testcases/create', 'clipboard-check', 'Test Cases', active === 'testcases' && tab !== 'report'),
    link('#/testcases/report', 'chart', 'Reporting', active === 'testcases' && tab === 'report'),
  );
}

function renderTools() {
  const label = h('span.label', 'All changes saved');
  const state = h('span.save-state.is-saved', { title: 'Your work is saved in this browser automatically' }, icon('check-circle'), label);
  let errorShown = false;
  store.on('saving', () => { state.className = 'save-state is-saving'; state.replaceChildren(icon('loader'), label); label.textContent = 'Saving…'; });
  store.on('saved', () => { state.className = 'save-state is-saved'; state.replaceChildren(icon('check-circle'), label); label.textContent = 'All changes saved'; state.title = `Saved ${timeAgo(Date.now())} in this browser`; errorShown = false; });
  store.on('save-error', () => {
    state.className = 'save-state is-error';
    state.replaceChildren(icon('alert-triangle'), label);
    label.textContent = 'Not saved';
    if (!errorShown) {
      errorShown = true;
      toast('Your browser refused to store more data (storage full or private mode). Save a project file to keep your work.', { type: 'error', title: 'Autosave failed', duration: 10000 });
    }
  });
  if (!store.state.persistent) {
    state.className = 'save-state is-error';
    label.textContent = 'Autosave off';
    state.title = 'This browser blocks local storage (private mode?). Use Save project file to keep your work.';
  }
  const help = h('button.icon-btn', { type: 'button', 'aria-label': 'Keyboard shortcuts', 'data-tip': 'Keyboard shortcuts', onclick: showShortcuts }, icon('keyboard'));
  tools.append(state, help);
  return state;
}

let saveState = null;

function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const match = ROUTES.map((r) => ({ r, m: r.path.exec(raw) })).find((x) => x.m);
  if (!match) {
    location.replace('#/');
    return;
  }
  const { r, m } = match;
  const params = { tab: m[1] || 'create' };
  renderNav(r.nav, params.tab);
  if (saveState) saveState.hidden = r.page !== workspace;
  document.body.dataset.page = r.nav || 'welcome';

  // the workspace handles its own tab switches without a full remount
  if (lastPage === r.page && r.page.update) {
    r.page.update(params);
    return;
  }
  if (cleanup) cleanup();
  clear(app);
  cleanup = r.page.mount(app, params) || null;
  lastPage = r.page;
  scrollTo({ top: 0, behavior: 'instant' });
}

async function boot() {
  try {
    await store.init();
  } catch (err) {
    console.error(err);
    toast('Your previous session could not be restored.', { type: 'error' });
  }
  saveState = renderTools();
  addEventListener('hashchange', route);
  route();
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
  idle(() => readTemplateLists().then((lists) => store.setLists(lists)));
}

addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast(e.reason?.message || 'Something went wrong. Please try again.', { type: 'error' });
});

boot();
