// Tiny DOM builder. User data is only ever assigned through textContent / properties,
// never parsed as HTML, so test case content can't inject markup (XSS-safe by construction).

import { icon } from './icons.js';

/**
 * h('button.btn.primary', { onclick, type: 'button', 'aria-label': 'Next' }, 'Next', icon('chevron-right'))
 * Tag shorthand supports "tag#id.class1.class2".
 */
export function h(spec, props, ...children) {
  if (props instanceof Node || typeof props === 'string' || typeof props === 'number' || Array.isArray(props)) {
    children.unshift(props);
    props = null;
  }
  const m = /^([a-z0-9-]+)?(?:#([\w-]+))?((?:\.[\w-]+)*)$/i.exec(spec);
  const el = document.createElement(m?.[1] || 'div');
  if (m?.[2]) el.id = m[2];
  if (m?.[3]) el.className = m[3].slice(1).split('.').join(' ');
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = [el.className, value].filter(Boolean).join(' ');
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'style') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'text') el.textContent = value;
      else if (key in el && !key.includes('-') && key !== 'list' && key !== 'form') {
        try { el[key] = value; } catch { el.setAttribute(key, value); }
      } else el.setAttribute(key, value === true ? '' : value);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Button with an optional leading/trailing icon. */
export function button(label, { variant = 'secondary', iconLeft, iconRight, size, class: extra, ...props } = {}) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', extra].filter(Boolean).join(' ');
  return h('button', { type: 'button', class: cls, ...props },
    iconLeft ? icon(iconLeft) : null,
    label ? h('span.btn-label', label) : null,
    iconRight ? icon(iconRight) : null);
}

export function iconButton(name, label, { class: extra, ...props } = {}) {
  const cls = ['icon-btn', ...(extra || '').split(' ')].filter((c, i, a) => c && a.indexOf(c) === i).join(' ');
  return h('button', { type: 'button', class: cls, 'aria-label': label, 'data-tip': label, ...props }, icon(name));
}

/** Auto-resizes a textarea to fit its content. */
export function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight + 2, 640)}px`;
  };
  textarea.addEventListener('input', fit);
  return fit;
}

/** Downloads a Blob with the given file name. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: fileName, rel: 'noopener', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opens a native file picker and resolves with the chosen files. */
export function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, hidden: true });
    input.addEventListener('change', () => {
      resolve([...input.files]);
      input.remove();
    });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}
