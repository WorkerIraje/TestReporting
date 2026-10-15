// Test fixtures: generated screenshots and throwaway IndexedDB databases.

import { uid } from '../js/core/util.js';

export async function pngFile(w = 320, h = 200, color = '#0451CC', name = 'shot.png') {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

/** Copy of a workspace definition that stores into its own throwaway database. */
export const testDef = (def) => ({ ...def, dbName: `iraje-test-${uid('db')}` });

export function dropDb(name) {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
