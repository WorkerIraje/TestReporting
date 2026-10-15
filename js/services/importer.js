// Validates and imports a filled Iraje test case template (.xlsx / .xlsm / .xls / .csv).
// Defence in depth: extension allow-list, size cap, file-signature check, zip-bomb guard,
// row cap, parse in a terminable worker, then an exact header match against the template.

import { APP, TEMPLATE, TEMPLATE_HEADERS, FIELDS, STATUS, SEVERITY } from '../core/config.js';
import { getJSZip } from '../core/loader.js';
import { formatBytes, cleanText, isBlank } from '../core/util.js';

export class ImportError extends Error {
  constructor(title, message, details = []) {
    super(message);
    this.title = title;
    this.details = details;
  }
}

const EXT = { xlsx: 'zip', xlsm: 'zip', xls: 'cfb', csv: 'csv' };
export const ACCEPT = '.xlsx,.xlsm,.xls,.csv';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const EXPECTED = TEMPLATE_HEADERS.map(norm);
const OLD_TEMPLATE_HINTS = ['testdate', 'priority', 'statuspassfailblocked', 'commentsdefects'];

async function signature(file) {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'zip';
  if ([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((x, i) => b[i] === x)) return 'cfb';
  return 'other';
}

async function looksLikeText(file) {
  const b = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  return !b.includes(0);
}

async function guardZip(file) {
  const JSZip = await getJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(file); // reads the central directory only; nothing is inflated yet
  } catch {
    throw new ImportError('Damaged file', 'The workbook could not be opened. Re-save it in Excel and try again.');
  }
  const entries = Object.values(zip.files);
  if (!zip.file('xl/workbook.xml')) {
    throw new ImportError('Not an Excel workbook', 'This file is a ZIP archive, not an Excel workbook.');
  }
  let total = 0;
  for (const e of entries) {
    const size = e._data?.uncompressedSize ?? 0;
    total += size;
    if (size > 80 * 1024 * 1024 || total > 160 * 1024 * 1024 || entries.length > 3000) {
      throw new ImportError('File rejected', 'The workbook expands to an unusually large size, so it was blocked for safety.');
    }
  }
}

function parseInWorker(buffer, kind) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('js/workers/import-worker.js');
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new ImportError('Import timed out', 'The file took too long to read and was stopped. Make sure it is the Iraje template.'));
    }, APP.importTimeoutMs);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data.ok) resolve(e.data);
      else reject(new ImportError('Could not read the file', 'The spreadsheet could not be parsed. Re-save it from Excel and try again.', [e.data.error]));
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new ImportError('Could not read the file', 'The spreadsheet reader failed to start.', [e.message || '']));
    };
    worker.postMessage({ buffer, kind, maxRows: TEMPLATE.headerRow + APP.maxCases + 200 }, [buffer]);
  });
}

/** Finds the row holding the template headers. */
function findHeader(rows) {
  let best = { score: 0 };
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const cells = rows[r].map(norm);
    for (let c = 0; c <= Math.max(0, cells.length - 1); c++) {
      if (cells[c] !== EXPECTED[0] && cells[c] !== EXPECTED[1]) continue;
      const start = cells[c] === EXPECTED[0] ? c : c - 1;
      let score = 0;
      for (let k = 0; k < EXPECTED.length; k++) if (cells[start + k] === EXPECTED[k]) score++;
      if (score > best.score) best = { score, row: r, col: start, cells };
    }
    const loose = EXPECTED.filter((x) => cells.includes(x)).length;
    if (loose > best.score) best = { score: loose, row: r, col: -1, cells };
  }
  return best;
}

function describeMismatch(best) {
  const present = new Set(best.cells || []);
  const missing = TEMPLATE_HEADERS.filter((h, i) => !present.has(EXPECTED[i]));
  const isOld = OLD_TEMPLATE_HINTS.filter((x) => present.has(x)).length >= 2;
  if (isOld) {
    return new ImportError('Old template detected',
      'This sheet uses the previous test case template. Download the current template, copy your test cases into it and upload again.',
      missing.length ? [`Missing columns: ${missing.join(', ')}`] : []);
  }
  if (best.score >= 4) {
    const details = [];
    if (missing.length) details.push(`Missing columns: ${missing.join(', ')}`);
    if (best.col === -1 && !missing.length) details.push('The columns are not in the template order (A: Test ID … O: Comments / Defect ID).');
    return new ImportError('Columns don\'t match the template',
      'The sheet looks like a test case list, but its columns differ from the Iraje test case template. Only the template is accepted.', details);
  }
  return new ImportError('Not the Iraje test case template',
    'Only the Iraje test case template can be uploaded. Download the template, fill it in and try again.');
}

function pickSheet(parsed, kind) {
  const names = parsed.sheetNames;
  const ordered = kind === 'csv' ? names : [
    ...names.filter((n) => n === TEMPLATE.casesSheet),
    ...names.filter((n) => n.toLowerCase() === TEMPLATE.casesSheet.toLowerCase() && n !== TEMPLATE.casesSheet),
    ...names.filter((n) => n.toLowerCase() !== TEMPLATE.casesSheet.toLowerCase()),
  ];
  let fallback = null;
  for (const name of ordered) {
    const rows = parsed.sheets[name]?.rows || [];
    const best = findHeader(rows);
    if (best.score === EXPECTED.length && best.col >= 0) return { name, rows, header: best };
    if (!fallback || best.score > fallback.header.score) fallback = { name, rows, header: best };
  }
  throw describeMismatch(fallback?.header || { score: 0 });
}

function readSummary(parsed) {
  const sheet = parsed.sheets[TEMPLATE.summarySheet];
  if (!sheet) return null;
  const out = {};
  for (const [key, ref] of Object.entries(TEMPLATE.summaryCells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    const col = m[1].charCodeAt(0) - 65 - sheet.origin.c;
    const row = Number(m[2]) - 1 - sheet.origin.r;
    const v = sheet.rows[row]?.[col];
    if (!isBlank(v)) out[key] = cleanText(v, 300).trim();
  }
  return out;
}

/**
 * Reads and validates a test sheet.
 * Returns { cases, report, found, imported, warnings, sheetName }.
 */
export async function readTestSheet(file, { onStep = () => {} } = {}) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const kind = EXT[ext];
  onStep('type');
  if (!kind) {
    throw new ImportError('Unsupported file type',
      `"${file.name}" is not a spreadsheet. Upload the Iraje test case template as .xlsx, .xlsm, .xls or .csv.`);
  }
  if (!file.size) throw new ImportError('Empty file', 'The selected file is empty.');
  if (file.size > APP.maxUploadBytes) {
    throw new ImportError('File too large', `The file is ${formatBytes(file.size)}. The limit is ${formatBytes(APP.maxUploadBytes)}.`);
  }
  const sig = await signature(file);
  if ((kind === 'zip' && sig !== 'zip') || (kind === 'cfb' && sig !== 'cfb') || (kind === 'csv' && (sig !== 'other' || !(await looksLikeText(file))))) {
    throw new ImportError('File content doesn\'t match its extension',
      `"${file.name}" is not a genuine .${ext} file, so it was rejected.`);
  }
  if (kind === 'zip') await guardZip(file);

  onStep('parse');
  const parsed = await parseInWorker(await file.arrayBuffer(), kind);

  onStep('structure');
  const { name, rows, header } = pickSheet(parsed, kind);
  const cols = FIELDS.map((f) => [f.key, header.col + (f.col.charCodeAt(0) - 65)]);

  onStep('rows');
  const all = [];
  const warnings = [];
  let badStatus = 0;
  let badSeverity = 0;
  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const tc = {};
    let any = false;
    for (const [key, c] of cols) {
      const v = cleanText(row[c], APP.maxFieldLength).replace(/\s+$/, '');
      tc[key] = v;
      if (!isBlank(v)) any = true;
    }
    if (!any) continue;
    const st = tc.status.trim().toLowerCase();
    if (st && !STATUS.some((s) => s.toLowerCase() === st || s.toLowerCase() === st.replace(/ed$/, ''))) badStatus++;
    if (tc.severity && !SEVERITY.some((s) => s.toLowerCase() === tc.severity.trim().toLowerCase())) badSeverity++;
    all.push(tc);
  }
  if (!all.length) {
    throw new ImportError('No test cases found', 'The template is valid but contains no test cases. Fill in at least one row and upload again.');
  }
  if (badStatus) warnings.push(`${badStatus} row(s) had a Status other than Pass, Fail or Blocked; it was left empty.`);
  if (badSeverity) warnings.push(`${badSeverity} row(s) had an unknown Severity; it was left empty.`);
  const cases = all.slice(0, APP.maxUploadCases);
  onStep('done');
  return {
    cases,
    report: readSummary(parsed),
    found: all.length,
    imported: cases.length,
    truncated: all.length > cases.length,
    reachedRowCap: rows.length >= TEMPLATE.headerRow + APP.maxCases + 200,
    warnings,
    sheetName: name,
  };
}
