// Pointer-based drag-to-reorder for lists and grids. Works with mouse, pen and touch
// (touch starts from a .drag-handle so normal scrolling keeps working).

/**
 * sortable(container, {
 *   itemSelector: '.item',            // direct or nested items inside container
 *   handleSelector: '.drag-handle',   // where touch drags start (mouse may use the whole item)
 *   mouseAnywhere: true,
 *   layout: 'list' | 'grid',
 *   scrollEl,                          // element to auto-scroll while dragging
 *   enabled: () => true,
 *   onMove: (from, to) => {},
 * })
 */
export function sortable(container, opts) {
  const { itemSelector, handleSelector, mouseAnywhere = true, layout = 'list', scrollEl, onMove, enabled = () => true } = opts;
  let drag = null;
  let raf = 0;

  const items = () => [...container.querySelectorAll(itemSelector)];

  function onDown(e) {
    if (e.button !== 0 || !enabled()) return;
    const onHandle = handleSelector && e.target.closest(handleSelector);
    const item = e.target.closest(itemSelector);
    if (!item || !container.contains(item)) return;
    const viaMouse = e.pointerType === 'mouse' && mouseAnywhere;
    if (!onHandle && !viaMouse) return;
    if (!onHandle && e.target.closest('button, a, input, textarea, select, [contenteditable]')) return;
    drag = { item, x: e.clientX, y: e.clientY, started: false, id: e.pointerId, from: items().indexOf(item) };
    if (onHandle) e.preventDefault();
    addEventListener('pointermove', onMoveEvt, { passive: false });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onCancel);
  }

  function begin() {
    const rect = drag.item.getBoundingClientRect();
    const ghost = drag.item.cloneNode(true);
    ghost.classList.add('sortable-ghost');
    Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px` });
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.dx = drag.x - rect.left;
    drag.dy = drag.y - rect.top;
    drag.item.classList.add('sortable-source');
    container.classList.add('is-sorting');
    document.body.classList.add('is-dragging');
    drag.started = true;
  }

  function onMoveEvt(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      begin();
    }
    e.preventDefault();
    drag.cx = e.clientX;
    drag.cy = e.clientY;
    drag.ghost.style.transform = `translate(${e.clientX - drag.x}px, ${e.clientY - drag.y}px) rotate(1.5deg)`;
    reposition(e.clientX, e.clientY);
    if (scrollEl && !raf) raf = requestAnimationFrame(autoScroll);
  }

  function reposition(x, y) {
    const list = items().filter((el) => el !== drag.item);
    if (!list.length) return;
    let target = null;
    let before = true;
    if (layout === 'grid') {
      let best = Infinity;
      for (const el of list) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < best) { best = d; target = el; before = x < r.left + r.width / 2; }
      }
    } else {
      for (const el of list) {
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) { target = el; before = true; break; }
      }
      if (!target) { target = list[list.length - 1]; before = false; }
    }
    if (!target) return;
    const ref = before ? target : target.nextSibling;
    if (ref !== drag.item && drag.item.nextSibling !== ref) target.parentNode.insertBefore(drag.item, ref);
  }

  function autoScroll() {
    raf = 0;
    if (!drag?.started || !scrollEl) return;
    const r = scrollEl.getBoundingClientRect();
    const edge = 48;
    let dy = 0;
    if (drag.cy < r.top + edge) dy = -Math.ceil((r.top + edge - drag.cy) / 4);
    else if (drag.cy > r.bottom - edge) dy = Math.ceil((drag.cy - (r.bottom - edge)) / 4);
    if (dy) {
      scrollEl.scrollTop += dy;
      reposition(drag.cx, drag.cy);
      raf = requestAnimationFrame(autoScroll);
    }
  }

  function cleanup() {
    removeEventListener('pointermove', onMoveEvt);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onCancel);
    cancelAnimationFrame(raf);
    raf = 0;
    if (drag?.started) {
      drag.ghost.remove();
      drag.item.classList.remove('sortable-source');
      container.classList.remove('is-sorting');
      document.body.classList.remove('is-dragging');
    }
  }

  function onUp() {
    if (!drag) return;
    const d = drag;
    cleanup();
    drag = null;
    if (!d.started) return;
    // swallow the click that follows a drag
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', swallow, { capture: true }), 50);
    const to = items().indexOf(d.item);
    if (to !== d.from && to >= 0) onMove(d.from, to);
  }

  function onCancel() {
    if (!drag) return;
    const d = drag;
    cleanup();
    drag = null;
    if (d.started) onMove(d.from, d.from); // let the owner re-render the original order
  }

  container.addEventListener('pointerdown', onDown);
  return () => {
    container.removeEventListener('pointerdown', onDown);
    cleanup();
  };
}
