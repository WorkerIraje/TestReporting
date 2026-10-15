// Non-blocking notifications with an optional action (e.g. Undo).

import { h } from './dom.js';
import { icon } from './icons.js';

const ICON = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
let root = null;

function host() {
  if (!root) {
    root = h('div.toasts', { role: 'region', 'aria-label': 'Notifications' });
    document.body.append(root);
  }
  return root;
}

/**
 * toast('Saved', { type: 'success' })
 * toast('Test case deleted', { action: { label: 'Undo', run }, onExpire })
 */
export function toast(message, { type = 'info', title, action, duration, onExpire } = {}) {
  const ms = duration ?? (action ? 8000 : type === 'error' ? 7000 : 4000);
  let closed = false;
  let timer = 0;

  const close = (expired) => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
    if (expired && onExpire) onExpire();
  };

  const el = h(`div.toast.toast-${type}`, { role: type === 'error' ? 'alert' : 'status' },
    h('span.toast-icon', icon(ICON[type] || 'info')),
    h('div.toast-body', title ? h('strong.toast-title', title) : null, h('span.toast-msg', message)),
    action ? h('button.toast-action', {
      type: 'button',
      onclick: () => { action.run(); close(false); },
    }, action.label) : null,
    h('button.toast-close', { type: 'button', 'aria-label': 'Dismiss', onclick: () => close(true) }, icon('x')),
    h('span.toast-timer', { style: { animationDuration: `${ms}ms` } }));

  const start = () => { timer = setTimeout(() => close(true), ms); };
  el.addEventListener('mouseenter', () => { clearTimeout(timer); el.classList.add('is-paused'); });
  el.addEventListener('mouseleave', () => { el.classList.remove('is-paused'); start(); });

  const list = host();
  list.append(el);
  while (list.children.length > 4) list.firstElementChild.remove();
  start();
  return { close: () => close(true) };
}

/** Shows an Undo toast for a store operation that returned { undo, commit }. */
export function undoToast(message, handle) {
  if (!handle) return;
  toast(message, {
    type: 'info',
    action: { label: 'Undo', run: () => { handle.undo(); handle.commit?.(); } },
    onExpire: () => handle.commit?.(),
  });
}
