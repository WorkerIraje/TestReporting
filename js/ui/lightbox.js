// Full-size screenshot viewer with keyboard navigation.

import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * openLightbox(items, startIndex)
 * items: [{ load: () => Promise<url>, caption }]
 */
export function openLightbox(items, start = 0) {
  if (!items.length) return;
  let i = start;
  const img = h('img.lightbox-img', { alt: '' });
  const caption = h('p.lightbox-caption');
  const counter = h('span.lightbox-count');
  const prev = h('button.lightbox-nav.is-prev', { type: 'button', 'aria-label': 'Previous screenshot', onclick: () => show(i - 1) }, icon('chevron-left'));
  const next = h('button.lightbox-nav.is-next', { type: 'button', 'aria-label': 'Next screenshot', onclick: () => show(i + 1) }, icon('chevron-right'));
  const close = () => {
    el.classList.add('is-leaving');
    removeEventListener('keydown', onKey, true);
    setTimeout(() => el.remove(), 180);
  };
  const el = h('div.lightbox', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Screenshot viewer' },
    h('div.lightbox-bar', counter, h('button.lightbox-close', { type: 'button', 'aria-label': 'Close viewer', onclick: close }, icon('x'))),
    h('div.lightbox-stage', prev, img, next),
    caption);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('lightbox-stage')) close(); });

  async function show(n) {
    i = (n + items.length) % items.length;
    counter.textContent = `${i + 1} / ${items.length}`;
    caption.textContent = items[i].caption || '';
    prev.hidden = next.hidden = items.length < 2;
    img.classList.add('is-loading');
    img.src = await items[i].load();
    img.alt = items[i].caption || `Screenshot ${i + 1}`;
    img.classList.remove('is-loading');
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); show(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); show(i + 1); }
  }

  addEventListener('keydown', onKey, true);
  document.body.append(el);
  el.querySelector('.lightbox-close').focus();
  show(i);
}
