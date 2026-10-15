// Shareable project file (.iqa): one ZIP with every card of a workspace (test cases or enhancement
// requests), the report details and all screenshots, so another tester can continue where you
// stopped. The manifest records the workspace kind; files without one come from Test Cases.

import { APP } from '../core/config.js';
import { TESTCASES, ENHANCEMENTS } from '../core/workspaces.js';
import { getJSZip } from '../core/loader.js';
import { formatBytes } from '../core/util.js';
import { processImageFiles } from './images.js';
import { ImportError } from './importer.js';

const APP_ID = 'iraje-qa-management';
const FORMAT = 1;
const KINDS = { [TESTCASES.key]: TESTCASES, [ENHANCEMENTS.key]: ENHANCEMENTS };

export async function saveProject(store, onProgress = () => {}) {
  const JSZip = await getJSZip();
  const zip = new JSZip();
  const cases = store.state.cases;
  const images = [];
  let done = 0;
  const totalImages = cases.reduce((n, c) => n + c.images.length, 0) || 1;
  for (const c of cases) {
    for (const id of c.images) {
      const rec = await store.imageRecord(id);
      if (!rec) continue;
      const file = `images/${id}.${rec.type === 'image/jpeg' ? 'jpg' : 'png'}`;
      zip.file(file, rec.blob, { compression: 'STORE' });
      images.push({ id, file, name: rec.name, w: rec.w, h: rec.h });
      onProgress(++done / totalImages * 0.8);
    }
  }
  const manifest = {
    app: APP_ID,
    format: FORMAT,
    savedAt: new Date().toISOString(),
    kind: store.def.key,
    report: store.state.report,
    cases: cases.map((c) => ({ id: c.id, bookmarked: c.bookmarked, images: c.images, ...Object.fromEntries(store.def.fieldKeys.map((k) => [k, c[k]])) })),
    images,
  };
  zip.file('manifest.json', JSON.stringify(manifest));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => onProgress(0.8 + (m.percent / 100) * 0.2));
  return blob;
}

export async function openProject(file, def, onProgress = () => {}) {
  if (!/\.iqa$/i.test(file.name)) {
    throw new ImportError('Not a project file', `Project files end with ${APP.projectExt}. To import ${def.noun.many} from a template, use the Upload tab.`);
  }
  if (file.size > APP.maxProjectBytes) {
    throw new ImportError('File too large', `The project is ${formatBytes(file.size)}; the limit is ${formatBytes(APP.maxProjectBytes)}.`);
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
    throw new ImportError('Damaged project file', 'This file is not a valid Iraje QA project.');
  }
  const JSZip = await getJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ImportError('Damaged project file', 'The project could not be opened.');
  }
  const entries = Object.values(zip.files);
  if (entries.length > def.maxItems * APP.maxImagesPerCase + 10) throw new ImportError('File rejected', 'The project contains too many files.');
  let total = 0;
  for (const e of entries) {
    const size = e._data?.uncompressedSize ?? 0;
    total += size;
    if ((e.name !== 'manifest.json' && size > APP.maxImageBytes) || (e.name === 'manifest.json' && size > 60 * 1024 * 1024) || total > APP.maxProjectBytes) {
      throw new ImportError('File rejected', 'The project expands to an unusually large size, so it was blocked for safety.');
    }
  }
  const mf = zip.file('manifest.json');
  if (!mf) throw new ImportError('Damaged project file', 'The project has no manifest.');
  let manifest;
  try {
    manifest = JSON.parse(await mf.async('string'));
  } catch {
    throw new ImportError('Damaged project file', 'The project manifest is not valid.');
  }
  if (manifest?.app !== APP_ID || manifest.format !== FORMAT || !Array.isArray(manifest.cases)) {
    throw new ImportError('Unsupported project', 'This project was not created by Iraje QA Management, or by a newer version.');
  }
  const kind = KINDS[manifest.kind || TESTCASES.key];
  if (kind?.key !== def.key) {
    throw new ImportError('Wrong workspace', kind
      ? `This project file holds ${kind.noun.many}. Open it from the ${kind.title} workspace.`
      : 'This project was created by a newer version of Iraje QA Management.');
  }
  if (manifest.cases.length > def.maxItems) {
    throw new ImportError(`Too many ${def.noun.many}`, `A project can hold up to ${def.maxItems.toLocaleString()} ${def.noun.many}.`);
  }

  const files = new Map((Array.isArray(manifest.images) ? manifest.images : [])
    .filter((m) => m && typeof m.id === 'string' && typeof m.file === 'string' && /^images\/img_[\w-]{4,40}\.(png|jpg)$/.test(m.file))
    .map((m) => [m.id, m]));
  const remap = new Map();
  const records = [];
  const wanted = manifest.cases.flatMap((c) => (Array.isArray(c?.images) ? c.images : [])).filter((id) => files.has(id));
  let done = 0;
  for (const id of wanted) {
    if (remap.has(id)) continue;
    const meta = files.get(id);
    const entry = zip.file(meta.file);
    if (!entry) continue;
    const blob = await entry.async('blob');
    const { records: [rec] } = await processImageFiles([new File([blob], String(meta.name || 'Screenshot').slice(0, 120))]);
    if (rec) {
      remap.set(id, rec.id);
      records.push(rec);
    }
    onProgress(++done / Math.max(1, wanted.length));
  }
  const cases = manifest.cases.map((c) => ({
    ...c,
    images: (Array.isArray(c?.images) ? c.images : []).map((id) => remap.get(id)).filter(Boolean),
  }));
  const report = manifest.report && typeof manifest.report === 'object' ? manifest.report : null;
  return { cases, images: records, report };
}
