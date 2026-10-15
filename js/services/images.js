// Screenshot intake: validates by file signature (not by name or MIME), decodes safely,
// normalises to PNG/JPEG for reports and creates a small thumbnail for fast previews.

import { APP } from '../core/config.js';
import { uid, formatBytes } from '../core/util.js';

const THUMB_MAX = 420;

export async function sniffImage(blob) {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const at = (i, ...bytes) => bytes.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  if (at(0, 0x42, 0x4d)) return 'bmp';
  return null;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasToBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

async function drawTo(bitmap, w, h, type, quality, background) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvasToBlob(canvas, type, quality);
}

/**
 * Turns user-supplied files into image records ready for storage.
 * Returns { records, rejected: [{ name, reason }] }.
 */
export async function processImageFiles(files, { source = 'file' } = {}) {
  const records = [];
  const rejected = [];
  for (const file of files) {
    const name = source === 'paste' ? `Pasted screenshot ${new Date().toLocaleTimeString()}` : (file.name || 'Screenshot');
    try {
      if (file.size > APP.maxImageBytes) {
        rejected.push({ name, reason: `larger than ${formatBytes(APP.maxImageBytes)}` });
        continue;
      }
      const kind = await sniffImage(file);
      if (!kind) {
        rejected.push({ name, reason: 'not a PNG, JPEG, GIF, WebP or BMP image' });
        continue;
      }
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        rejected.push({ name, reason: 'the image could not be decoded (damaged file?)' });
        continue;
      }
      const { width: w, height: h } = bitmap;
      if (!w || !h || w * h > APP.maxImagePixels) {
        bitmap.close?.();
        rejected.push({ name, reason: 'image dimensions are too large' });
        continue;
      }
      // Reports (PDF/DOCX) embed PNG or JPEG; convert anything else once, at intake.
      let blob = file;
      let type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
      if (kind !== 'png' && kind !== 'jpeg') blob = await drawTo(bitmap, w, h, 'image/png');
      else if (!(file instanceof Blob) || file.type !== type) blob = new Blob([await file.arrayBuffer()], { type });

      const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
      const thumb = await drawTo(bitmap, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), 'image/jpeg', 0.84, '#ffffff');
      bitmap.close?.();
      records.push({ id: uid('img'), blob, thumb, type, w, h, name: String(name).slice(0, 120), size: blob.size, addedAt: Date.now() });
    } catch (err) {
      console.error(err);
      rejected.push({ name, reason: 'unexpected error while reading the image' });
    }
  }
  return { records, rejected };
}

/** Extracts image files from a paste or drop event; ignores everything else. */
export function imageFilesFrom(dataTransfer) {
  if (!dataTransfer) return [];
  const out = [];
  for (const item of dataTransfer.items || []) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  if (!out.length) for (const f of dataTransfer.files || []) out.push(f);
  return out;
}

export const hasFiles = (dataTransfer) => [...(dataTransfer?.types || [])].includes('Files');
