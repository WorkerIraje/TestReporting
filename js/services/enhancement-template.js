// Word enhancement template: builds the branded .docx people fill in (Title, Description and
// Reference screenshot blocks) and reads a filled one back into enhancement cards.
// Defence in depth: .docx only, size cap, ZIP signature, entry / uncompressed-size caps checked
// before inflating, XML parsed with DOMParser (no external entities), relationships resolved
// inside the package only (linked images are never fetched), images through processImageFiles.

import { APP } from '../core/config.js';
import { ENHANCEMENTS } from '../core/workspaces.js';
import { getDocx, getJSZip } from '../core/loader.js';
import { formatBytes } from '../core/util.js';
import { brandParts, FONT, CONTENT } from '../reports/docx-brand.js';
import { processImageFiles } from './images.js';
import { ImportError } from './importer.js';

export const TEMPLATE_FILE_NAME = 'Iraje_Enhancement_Template.docx';
export const ACCEPT_DOCX = '.docx';

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  v: 'urn:schemas-microsoft-com:vml',
};
const MAX_ENTRIES = 5000;
const MAX_DOCUMENT_XML = 40 * 1024 * 1024;
const MAX_TOTAL = 300 * 1024 * 1024;

const BLOCK_ROWS = [
  { label: 'Title', hint: 'One-line summary', height: 600 },
  { label: 'Description', hint: 'What happens today and what should change', height: 2400 },
  { label: 'Reference screenshot', hint: 'Paste one or more screenshots', height: 4000 },
];

const LABELS = {
  title: 'title', enhancementtitle: 'title',
  description: 'description',
  referencescreenshot: 'screenshot', referencescreenshots: 'screenshot', screenshot: 'screenshot', screenshots: 'screenshot',
};

/** 'Title:' -> 'title', 'Reference screenshots' -> 'screenshot', anything else -> null. */
export const labelKind = (text) => LABELS[String(text ?? '').toLowerCase().replace(/[^a-z]/g, '')] || null;

// ---------------------------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------------------------

export async function buildTemplate({ blocks = 5 } = {}) {
  const d = await getDocx();
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlignTable, TableLayoutType } = d;
  const { header, footer, page } = await brandParts(d, { title: 'Enhancement Request Template', generatedLabel: 'Enhancement request template' });
  const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color ?? '434C6B', characterSpacing: o.spacing });
  const para = (children, o = {}) => new Paragraph({ children: [].concat(children), spacing: { before: o.before ?? 0, after: o.after ?? 80, line: 300 }, keepNext: o.keepNext });
  const line = { style: BorderStyle.SINGLE, size: 4, color: 'C9DAFB' };
  const borders = { top: line, bottom: line, left: line, right: line };
  const labelW = 2600;

  const block = (n) => [
    para(run(`ENHANCEMENT ${n}`, { size: 16, bold: true, color: '0451CC', spacing: 12 }), { before: 240, after: 80, keepNext: true }),
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [labelW, CONTENT - labelW],
      layout: TableLayoutType.FIXED,
      // keep each block together: the Title and Description rows stay with the row that follows
      rows: BLOCK_ROWS.map((r, i) => new TableRow({
        cantSplit: i < BLOCK_ROWS.length - 1,
        height: { value: r.height, rule: 'atLeast' },
        children: [
          new TableCell({
            width: { size: labelW, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F6FF' },
            borders,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            verticalAlign: VerticalAlignTable.TOP,
            children: [para(run(r.label, { bold: true, color: '1D2548' }), { after: 20, keepNext: i < BLOCK_ROWS.length - 1 }), para(run(r.hint, { size: 15, italics: true, color: '98A1B7' }), { after: 0, keepNext: i < BLOCK_ROWS.length - 1 })],
          }),
          new TableCell({
            width: { size: CONTENT - labelW, type: WidthType.DXA },
            borders,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            verticalAlign: VerticalAlignTable.TOP,
            children: [new Paragraph({ children: [], keepNext: i < BLOCK_ROWS.length - 1 })],
          }),
        ],
      })),
    }),
  ];

  const steps = [
    'Fill in one block per enhancement: a one-line Title, a Description of what happens today and what should change, and reference screenshots.',
    'Need more blocks? Select a whole block table, copy it and paste it below the last one.',
    'Paste screenshots as pictures into the Reference screenshot cell (PNG or JPEG work best).',
    'Upload the file in Iraje QA Management → Enhancement Report → Upload. Module, Proposed improvement, Business value and Priority are completed on each card.',
  ];
  const doc = new Document({
    creator: 'Iraje QA Management',
    title: 'Iraje Enhancement Template',
    subject: 'Enhancement requests',
    keywords: 'iraje-enhancement-template',
    styles: { default: { document: { run: { font: FONT, size: 20, color: '434C6B' } } } },
    sections: [{
      properties: { page },
      headers: { default: header },
      footers: { default: footer },
      children: [
        para(run('Enhancement requests', { size: 44, bold: true, color: '1D2548' }), { after: 120 }),
        para(run('Describe each enhancement in its own block below. Iraje QA Management turns every block into an enhancement card.', { color: '687290' }), { after: 200 }),
        ...steps.map((s, i) => para([run(`${i + 1}.  `, { bold: true, color: '0451CC' }), run(s)], { after: 60 })),
        ...Array.from({ length: blocks }, (_, i) => block(i + 1)).flat(),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

// ---------------------------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------------------------

const kids = (el, name) => [...el.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === NS.w && n.localName === name);

function insideTable(el) {
  for (let p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) {
    if (p.namespaceURI === NS.w && p.localName === 'tbl') return true;
  }
  return false;
}

function paragraphText(p) {
  let out = '';
  for (const n of p.getElementsByTagNameNS(NS.w, '*')) {
    if (n.localName === 't') out += n.textContent;
    else if (n.localName === 'tab') out += ' ';
    else if (n.localName === 'br' || n.localName === 'cr') out += '\n';
    else if (n.localName === 'noBreakHyphen') out += '-';
  }
  const list = p.getElementsByTagNameNS(NS.w, 'numPr').length > 0;
  return list && out.trim() ? `• ${out}` : out;
}

/** Text of a table cell: one line per paragraph (nested tables included), outer blank lines removed. */
function cellText(tc) {
  const lines = [...tc.getElementsByTagNameNS(NS.w, 'p')].map(paragraphText);
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

const firstLine = (tc) => [...tc.getElementsByTagNameNS(NS.w, 'p')].map(paragraphText).find((t) => t.trim()) || '';

function imageRefs(tc) {
  const ids = [];
  for (const b of tc.getElementsByTagNameNS(NS.a, 'blip')) {
    const id = b.getAttributeNS(NS.r, 'embed');
    if (id) ids.push(id);
  }
  for (const v of tc.getElementsByTagNameNS(NS.v, 'imagedata')) {
    const id = v.getAttributeNS(NS.r, 'id');
    if (id) ids.push(id);
  }
  return ids;
}

/** Resolves a relationship target against word/ inside the package (never leaves it). */
function packagePath(target) {
  const parts = target.startsWith('/') ? target.slice(1).split('/') : `word/${target}`.split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ImportError('Damaged file', 'The Word document could not be read.');
  return doc;
}

export async function parseTemplate(file, { onStep = () => {} } = {}) {
  const max = ENHANCEMENTS.maxUploadItems;

  onStep('type');
  const ext = (/\.([^.]+)$/.exec(file.name || '')?.[1] || '').toLowerCase();
  if (ext !== 'docx') {
    throw new ImportError('Unsupported file', ['doc', 'docm', 'dotx', 'rtf', 'odt'].includes(ext)
      ? 'Only .docx files are accepted. Open the file in Word, save it as a Word Document (.docx) and upload it again.'
      : 'Upload the filled enhancement template as a Word document (.docx).');
  }
  if (file.size > ENHANCEMENTS.maxUploadBytes) {
    throw new ImportError('File too large', `The file is ${formatBytes(file.size)}; the limit is ${formatBytes(ENHANCEMENTS.maxUploadBytes)}.`);
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) {
    throw new ImportError('Damaged file', 'This file is not a valid Word document.');
  }

  onStep('parse');
  const JSZip = await getJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(file); // reads the central directory only; nothing is inflated yet
  } catch {
    throw new ImportError('Damaged file', 'The Word document could not be opened.');
  }
  const entries = Object.values(zip.files);
  const sizeOf = (e) => e?._data?.uncompressedSize ?? 0;
  const total = entries.reduce((n, e) => n + sizeOf(e), 0);
  const docEntry = zip.file('word/document.xml');
  if (entries.length > MAX_ENTRIES || total > MAX_TOTAL || sizeOf(docEntry) > MAX_DOCUMENT_XML) {
    throw new ImportError('File rejected', 'The document expands to an unusually large size, so it was blocked for safety.');
  }
  if (!docEntry) throw new ImportError('Damaged file', 'This file is not a Word document.');
  const doc = parseXml(await docEntry.async('string'));
  const rels = new Map();
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  if (relsEntry) {
    for (const r of parseXml(await relsEntry.async('string')).getElementsByTagName('Relationship')) {
      rels.set(r.getAttribute('Id'), { target: r.getAttribute('Target') || '', external: (r.getAttribute('TargetMode') || '').toLowerCase() === 'external' });
    }
  }

  onStep('blocks');
  const blocks = [];
  let labelRows = 0;
  let cur = null;
  for (const tbl of [...doc.getElementsByTagNameNS(NS.w, 'tbl')].filter((t) => !insideTable(t))) {
    for (const tr of kids(tbl, 'tr')) {
      const cells = kids(tr, 'tc');
      if (cells.length < 2) continue;
      const kind = labelKind(firstLine(cells[0]));
      if (!kind) continue;
      labelRows++;
      if (kind === 'title' || !cur) {
        cur = { title: '', description: '', refs: [] };
        blocks.push(cur);
      }
      const values = cells.slice(1);
      const text = values.map(cellText).filter((t) => t.trim()).join('\n');
      if (kind === 'title') cur.title = text.replace(/\s*\n\s*/g, ' ').trim();
      else if (kind === 'description') cur.description = [cur.description, text].filter(Boolean).join('\n');
      for (const c of values) cur.refs.push(...imageRefs(c));
    }
  }
  if (!labelRows) {
    throw new ImportError('Not an enhancement template', 'No Title / Description / Reference screenshot blocks were found. Download the enhancement template from this page, fill it in and upload it again.');
  }
  const filled = blocks.filter((b) => b.title || b.description.trim() || b.refs.length);
  if (!filled.length) {
    throw new ImportError('Template is empty', 'Fill in at least one block (a Title, a Description or a screenshot) and upload the file again.');
  }
  const kept = filled.slice(0, max);

  onStep('images');
  const images = [];
  const rejected = [];
  const items = [];
  for (let n = 0; n < kept.length; n++) {
    const b = kept[n];
    const name = b.title || `Block ${n + 1}`;
    const ids = [];
    for (const ref of b.refs) {
      const rel = rels.get(ref);
      if (!rel || rel.external) continue; // linked pictures are never fetched
      const path = packagePath(rel.target);
      const entry = zip.file(path);
      if (!entry) continue;
      const label = `${name} · screenshot ${ids.length + 1}`;
      if (/\.(emf|wmf)$/i.test(path)) {
        rejected.push({ name: label, reason: 'Word drawing (EMF/WMF) is not supported; paste the screenshot as a picture' });
        continue;
      }
      if (sizeOf(entry) > APP.maxImageBytes) {
        rejected.push({ name: label, reason: `larger than ${formatBytes(APP.maxImageBytes)}` });
        continue;
      }
      if (ids.length >= APP.maxImagesPerCase) {
        rejected.push({ name: label, reason: `more than ${APP.maxImagesPerCase} screenshots in one block` });
        continue;
      }
      const blob = await entry.async('blob');
      const result = await processImageFiles([new File([blob], `Reference screenshot ${ids.length + 1}`)]);
      for (const r of result.rejected) rejected.push({ name: label, reason: r.reason });
      for (const r of result.records) {
        images.push(r);
        ids.push(r.id);
      }
    }
    items.push({ title: b.title, current: b.description, images: ids });
  }
  return { items, images, found: filled.length, truncated: filled.length - kept.length, skipped: blocks.length - filled.length, rejected };
}
