// Works directly on the template's XML (via JSZip) so the downloaded TestSheet keeps every
// style, dropdown, conditional format, formula, the protected Summary dashboard and its chart.
// Values are written as inline strings, so text that starts with "=", "+", "-" or "@" can never
// become a live formula (spreadsheet formula injection).

import { APP, TEMPLATE, FIELDS, DEFAULT_LISTS } from '../core/config.js';
import { getJSZip, fetchBinary } from '../core/loader.js';
import { cleanText, testId } from '../core/util.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

let templateBuffer = null;

export async function templateBytes() {
  if (!templateBuffer) templateBuffer = await fetchBinary(APP.templateUrl);
  return templateBuffer.slice(0);
}

const parseXml = (text) => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The template file is damaged');
  return doc;
};
const serialize = (doc) => XML_DECL + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');

const colToNum = (col) => [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const splitRef = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { col: m[1], row: Number(m[2]) };
};

async function sheetPaths(zip) {
  const wb = parseXml(await zip.file('xl/workbook.xml').async('string'));
  const rels = parseXml(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
  const targets = {};
  for (const rel of rels.getElementsByTagName('Relationship')) targets[rel.getAttribute('Id')] = rel.getAttribute('Target');
  const out = {};
  for (const s of wb.getElementsByTagNameNS(NS, 'sheet')) {
    const target = targets[s.getAttributeNS(NS_REL, 'id')];
    if (target) out[s.getAttribute('name')] = `xl/${target.replace(/^\/?xl\//, '')}`;
  }
  return { wb, out };
}

async function sharedStrings(zip) {
  const f = zip.file('xl/sharedStrings.xml');
  if (!f) return [];
  const doc = parseXml(await f.async('string'));
  return [...doc.getElementsByTagNameNS(NS, 'si')].map((si) => [...si.getElementsByTagNameNS(NS, 't')].map((t) => t.textContent).join(''));
}

function cellText(c, sst) {
  const t = c.getAttribute('t');
  if (t === 's') return sst[Number(c.getElementsByTagNameNS(NS, 'v')[0]?.textContent)] ?? '';
  if (t === 'inlineStr') return [...c.getElementsByTagNameNS(NS, 't')].map((x) => x.textContent).join('');
  return c.getElementsByTagNameNS(NS, 'v')[0]?.textContent ?? '';
}

/** Reads the dropdown lists (Account Type, Test Type, Tester) from the Summary sheet. */
export async function readTemplateLists() {
  try {
    const JSZip = await getJSZip();
    const zip = await JSZip.loadAsync(await templateBytes());
    const { out } = await sheetPaths(zip);
    const path = out[TEMPLATE.summarySheet];
    if (!path) return DEFAULT_LISTS;
    const sst = await sharedStrings(zip);
    const doc = parseXml(await zip.file(path).async('string'));
    const lists = { account: [], type: [], tester: [] };
    const byCol = Object.fromEntries(Object.entries(TEMPLATE.listColumns).map(([k, col]) => [col, k]));
    for (const c of doc.getElementsByTagNameNS(NS, 'c')) {
      const { col, row } = splitRef(c.getAttribute('r'));
      if (row < TEMPLATE.listFirstRow || row > TEMPLATE.listLastRow || !byCol[col]) continue;
      const v = cellText(c, sst).trim();
      if (v) lists[byCol[col]].push(v);
    }
    return {
      account: lists.account.length ? lists.account : DEFAULT_LISTS.account,
      type: lists.type.length ? lists.type : DEFAULT_LISTS.type,
      tester: lists.tester.length ? lists.tester : DEFAULT_LISTS.tester,
    };
  } catch (err) {
    console.warn('Using built-in dropdown lists', err);
    return DEFAULT_LISTS;
  }
}

// ---- writing ---------------------------------------------------------------------------------

function rowMap(doc) {
  const map = new Map();
  for (const r of doc.getElementsByTagNameNS(NS, 'row')) map.set(Number(r.getAttribute('r')), r);
  return map;
}

function ensureRow(doc, rows, n) {
  if (rows.has(n)) return rows.get(n);
  const sheetData = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
  const row = doc.createElementNS(NS, 'row');
  row.setAttribute('r', String(n));
  const after = [...rows.keys()].filter((k) => k > n).sort((a, b) => a - b)[0];
  sheetData.insertBefore(row, after ? rows.get(after) : null);
  rows.set(n, row);
  return row;
}

function ensureCell(doc, row, ref) {
  const want = colToNum(splitRef(ref).col);
  for (const c of row.getElementsByTagNameNS(NS, 'c')) {
    const r = c.getAttribute('r');
    if (r === ref) return c;
    if (colToNum(splitRef(r).col) > want) {
      const cell = doc.createElementNS(NS, 'c');
      cell.setAttribute('r', ref);
      if (c.getAttribute('s')) cell.setAttribute('s', c.getAttribute('s'));
      row.insertBefore(cell, c);
      return cell;
    }
  }
  const cell = doc.createElementNS(NS, 'c');
  cell.setAttribute('r', ref);
  row.append(cell);
  return cell;
}

function clearValue(c) {
  for (const tag of ['v', 'is', 'f']) for (const el of [...c.getElementsByTagNameNS(NS, tag)]) el.remove();
  c.removeAttribute('t');
}

function writeText(doc, c, text) {
  clearValue(c);
  const value = cleanText(text, 32_767);
  if (!value) return;
  c.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(NS, 'is');
  const t = doc.createElementNS(NS, 't');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = value;
  is.append(t);
  c.append(is);
}

/** Drops cached formula results so Excel / WPS / LibreOffice recalculate on open. */
function dropCachedFormulaValues(doc, keep = () => false) {
  for (const f of [...doc.getElementsByTagNameNS(NS, 'f')]) {
    const c = f.parentNode;
    if (keep(c)) continue;
    for (const v of [...c.getElementsByTagNameNS(NS, 'v')]) v.remove();
  }
}

function colWidths(doc) {
  const widths = {};
  for (const col of doc.getElementsByTagNameNS(NS, 'col')) {
    const min = Number(col.getAttribute('min'));
    const max = Number(col.getAttribute('max'));
    for (let i = min; i <= max; i++) widths[i] = Number(col.getAttribute('width')) || 9;
  }
  return widths;
}

function estimateRowHeight(values, widths) {
  let lines = 1;
  for (const [col, text] of values) {
    if (!text) continue;
    const perLine = Math.max(6, Math.floor((widths[colToNum(col)] || 12) * 1.08));
    const n = text.split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)), 0);
    lines = Math.max(lines, n);
  }
  return Math.min(409, Math.max(28.5, lines * 14 + 8));
}

/**
 * Builds the filled TestSheet (.xlsx) from the cases and report details.
 * Returns a Blob.
 */
export async function buildTestSheet(cases, report = {}, lists = DEFAULT_LISTS) {
  if (cases.length > APP.maxCases) throw new Error(`The template holds up to ${APP.maxCases} test cases`);
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(await templateBytes());
  const { wb, out } = await sheetPaths(zip);
  const casesPath = out[TEMPLATE.casesSheet];
  const summaryPath = out[TEMPLATE.summarySheet];
  if (!casesPath) throw new Error('The template has no TestCases sheet');

  // --- TestCases sheet ---
  const doc = parseXml(await zip.file(casesPath).async('string'));
  const rows = rowMap(doc);
  const widths = colWidths(doc);
  const byCol = FIELDS.map((f) => [f.col, f.key]);

  for (let r = TEMPLATE.firstDataRow; r <= TEMPLATE.lastDataRow; r++) {
    const i = r - TEMPLATE.firstDataRow;
    const tc = cases[i];
    const row = ensureRow(doc, rows, r);
    const idCell = ensureCell(doc, row, `A${r}`);
    for (const v of [...idCell.getElementsByTagNameNS(NS, 'v')]) v.remove();
    if (idCell.getElementsByTagNameNS(NS, 'f').length) {
      const v = doc.createElementNS(NS, 'v');
      v.textContent = tc ? testId(i) : '';
      idCell.append(v);
    }
    const values = [];
    for (const [col, key] of byCol) {
      const c = ensureCell(doc, row, `${col}${r}`);
      const text = tc ? tc[key] : '';
      writeText(doc, c, text);
      values.push([col, text]);
    }
    if (tc) row.setAttribute('ht', String(estimateRowHeight(values, widths)));
    else if (r === TEMPLATE.firstDataRow) row.removeAttribute('ht');
  }
  // keep the computed Test IDs, recalculate everything else
  dropCachedFormulaValues(doc, (c) => {
    const { col, row } = splitRef(c.getAttribute('r'));
    return col === 'A' && row >= TEMPLATE.firstDataRow;
  });
  zip.file(casesPath, serialize(doc));

  // --- Summary sheet: product details + any new list values ---
  if (summaryPath) {
    const sdoc = parseXml(await zip.file(summaryPath).async('string'));
    const srows = rowMap(sdoc);
    for (const [key, ref] of Object.entries(TEMPLATE.summaryCells)) {
      const value = report[key];
      if (value === undefined) continue;
      const row = ensureRow(sdoc, srows, splitRef(ref).row);
      writeText(sdoc, ensureCell(sdoc, row, ref), value);
    }
    const listKeys = Object.keys(TEMPLATE.listColumns);
    for (const key of listKeys) {
      const col = TEMPLATE.listColumns[key];
      const known = new Set((lists[key] || []).map((x) => x.toLowerCase()));
      const extra = [];
      for (const tc of cases) {
        const v = (tc[key] || '').trim();
        if (v && !known.has(v.toLowerCase())) { known.add(v.toLowerCase()); extra.push(v); }
      }
      let r = TEMPLATE.listFirstRow + (lists[key] || []).length;
      for (const v of extra) {
        if (r > TEMPLATE.listLastRow) break;
        const row = ensureRow(sdoc, srows, r);
        writeText(sdoc, ensureCell(sdoc, row, `${col}${r}`), v);
        r++;
      }
    }
    dropCachedFormulaValues(sdoc);
    zip.file(summaryPath, serialize(sdoc));
  }

  // --- workbook: force a full recalculation when the file is opened ---
  let calcPr = wb.getElementsByTagNameNS(NS, 'calcPr')[0];
  if (!calcPr) {
    calcPr = wb.createElementNS(NS, 'calcPr');
    wb.documentElement.insertBefore(calcPr, wb.getElementsByTagNameNS(NS, 'extLst')[0] || null);
  }
  calcPr.setAttribute('fullCalcOnLoad', '1');
  zip.file('xl/workbook.xml', serialize(wb));
  if (zip.file('xl/calcChain.xml')) zip.remove('xl/calcChain.xml');

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
