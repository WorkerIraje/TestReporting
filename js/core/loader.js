// Lazy-loads the vendored libraries (served from /vendor, never from a third-party CDN).

const cache = new Map();

export function loadScript(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      cache.delete(src);
      reject(new Error(`Could not load ${src}. Check your connection and try again.`));
    };
    document.head.append(s);
  });
  cache.set(src, p);
  return p;
}

export async function getJSZip() {
  await loadScript('vendor/jszip.min.js');
  return window.JSZip;
}

export async function getJsPDF() {
  await loadScript('vendor/jspdf.umd.min.js');
  await loadScript('vendor/jspdf.plugin.autotable.min.js');
  return window.jspdf;
}

export async function getDocx() {
  await loadScript('vendor/docx.iife.min.js');
  return window.docx;
}

export async function fetchBinary(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.arrayBuffer();
}
