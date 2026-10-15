// Small, dependency-free helpers shared across the app.

export const uid = (prefix = 'id') => {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14)}`;
};

export const testId = (index) => `TC-${String(index + 1).padStart(3, '0')}`;

export function debounce(fn, wait) {
  let t = 0;
  const run = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  run.cancel = () => clearTimeout(t);
  return run;
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value, withTime = false) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en-GB', opts);
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(ts, true);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Removes control characters that break XML/Excel, normalises newlines and caps the length.
export function cleanText(value, max = 32_000) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  if (s.length > max) s = s.slice(0, max);
  return s;
}

export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function safeFileName(name, fallback = 'report') {
  const s = String(name || '').normalize('NFKD').replace(/[^\w\s.-]+/g, '').trim().replace(/\s+/g, '_');
  return (s || fallback).slice(0, 80);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yields to the browser so long loops keep the UI responsive. Falls back to a timer because
// requestAnimationFrame is paused in background tabs (a report must keep building there).
export const nextFrame = () => new Promise((resolve) => {
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      resolve();
    }
  };
  if (document.visibilityState !== 'hidden') requestAnimationFrame(finish);
  setTimeout(finish, document.visibilityState === 'hidden' ? 0 : 60);
});

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
