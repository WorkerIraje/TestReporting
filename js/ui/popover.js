// Anchored popovers and menus that close on outside click, Esc or when focus leaves.

import { h } from './dom.js';
import { icon } from './icons.js';

let active = null;

export function closePopover() {
  if (!active) return;
  const { el, anchor, off } = active;
  active = null;
  off();
  el.remove();
  anchor?.setAttribute('aria-expanded', 'false');
}

/**
 * openPopover(anchorButton, contentNode, { className, align: 'end' | 'start' })
 * Toggles: calling again with the same anchor closes it.
 */
export function openPopover(anchor, content, { className = '', align = 'end', label = '' } = {}) {
  if (active?.anchor === anchor) {
    closePopover();
    return null;
  }
  closePopover();
  const el = h(`div.popover${className ? `.${className}` : ''}`, { role: 'dialog', 'aria-label': label }, content);
  document.body.append(el);
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(12, Math.min(left, innerWidth - w - 12));
    el.style.left = `${left + scrollX}px`;
    el.style.top = `${r.bottom + 10 + scrollY}px`;
  };
  place();
  anchor.setAttribute('aria-expanded', 'true');
  const onDoc = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const onKey = (e) => { if (e.key === 'Escape') { closePopover(); anchor.focus(); } };
  const onResize = () => place();
  setTimeout(() => document.addEventListener('pointerdown', onDoc), 0);
  document.addEventListener('keydown', onKey);
  addEventListener('resize', onResize);
  active = {
    el,
    anchor,
    off: () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
    },
  };
  el.querySelector('button, [tabindex], input')?.focus({ preventScroll: true });
  return el;
}

/** Menu of actions: [{ icon, label, hint, danger, run }] or 'sep'. */
export function openMenu(anchor, items, opts = {}) {
  const menu = h('div.menu', { role: 'menu' }, items.map((it) => (it === 'sep'
    ? h('div.menu-sep', { role: 'separator' })
    : h(`button.menu-item${it.danger ? '.is-danger' : ''}`, {
      type: 'button',
      role: 'menuitem',
      onclick: () => { closePopover(); it.run(); },
    }, icon(it.icon), h('span', it.label, it.hint ? h('small', it.hint) : null)))));
  menu.addEventListener('keydown', (e) => {
    const list = [...menu.querySelectorAll('.menu-item')];
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
  });
  return openPopover(anchor, menu, { ...opts, className: 'menu-pop' });
}
