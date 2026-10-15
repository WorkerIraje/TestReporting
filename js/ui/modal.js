// Accessible modal dialogs built on <dialog>: focus trap, Esc to close, restore focus.

import { h, button } from './dom.js';
import { icon } from './icons.js';

/**
 * openModal({ title, body, actions: [{ label, variant, value, iconLeft }], size, dismissible })
 * Resolves with the clicked action's value, or null when dismissed.
 */
export function openModal({ title, subtitle, body, actions = [], size = 'md', dismissible = true, iconName, tone = 'primary', onOpen } = {}) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const dialog = h(`dialog.modal.modal-${size}.modal-tone-${tone}`, { 'aria-labelledby': 'modal-title' });
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.classList.add('is-leaving');
      setTimeout(() => {
        dialog.close();
        dialog.remove();
        if (previous && previous.focus) previous.focus({ preventScroll: true });
      }, 160);
      resolve(value);
    };

    const head = h('header.modal-head',
      iconName ? h('span.modal-icon', icon(iconName)) : null,
      h('div.modal-titles', h('h2#modal-title.modal-title', title), subtitle ? h('p.modal-subtitle', subtitle) : null),
      dismissible ? h('button.icon-btn.modal-x', { type: 'button', 'aria-label': 'Close', onclick: () => finish(null) }, icon('x')) : null);

    const foot = actions.length ? h('footer.modal-foot', actions.map((a) => {
      const b = button(a.label, { variant: a.variant || 'secondary', iconLeft: a.iconLeft, iconRight: a.iconRight, onclick: () => finish(a.value) });
      if (a.autofocus) b.dataset.autofocus = '1';
      if (a.disabled) b.disabled = true;
      return b;
    })) : null;

    dialog.append(head, h('div.modal-body', body), foot);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (dismissible) finish(null);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && dismissible) finish(null);
    });
    document.body.append(dialog);
    dialog.showModal();
    const auto = dialog.querySelector('[data-autofocus]') || dialog.querySelector('input, select, textarea') || foot?.lastElementChild;
    auto?.focus({ preventScroll: true });
    onOpen?.(dialog, finish);
  });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, iconName }) {
  return openModal({
    title,
    iconName: iconName || (danger ? 'alert-triangle' : 'help'),
    tone: danger ? 'danger' : 'primary',
    size: 'sm',
    body: typeof message === 'string' ? h('p', message) : message,
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary', autofocus: true },
    ],
  }).then((v) => v === true);
}

/** Full-screen progress overlay for long jobs (report generation, imports). */
export function progressOverlay(title) {
  const bar = h('div.progress-fill');
  const label = h('p.progress-label', 'Preparing…');
  const pct = h('span.progress-pct', '0%');
  const el = h('div.progress-overlay', { role: 'alertdialog', 'aria-live': 'polite', 'aria-label': title },
    h('div.progress-card',
      h('div.progress-spinner', icon('loader')),
      h('h3', title),
      label,
      h('div.progress-track', bar),
      pct));
  document.body.append(el);
  return {
    update(fraction, text) {
      const p = Math.max(0, Math.min(1, fraction));
      bar.style.width = `${(p * 100).toFixed(1)}%`;
      pct.textContent = `${Math.round(p * 100)}%`;
      if (text) label.textContent = text;
    },
    close() {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 200);
    },
  };
}
