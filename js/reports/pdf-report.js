// PDF report (A4) drawn with jsPDF: embedded Poppins for crisp text, a small Iraje logo
// header and a faint "Iraje Software" watermark on every page, a clickable test case index,
// PDF bookmarks, and full-width screenshots kept at their aspect ratio.

import { getJsPDF, fetchBinary } from '../core/loader.js';
import { nextFrame } from '../core/util.js';
import { loadLogo, loadShot, pct } from './model.js';

const W = 210;
const H = 297;
const ML = 16;
const MR = 16;
const CW = W - ML - MR;
const TOP = 27;
const BOTTOM = 278;
const PT = 0.3528; // mm per point

const C = {
  blue: [4, 81, 204], navy: [29, 37, 72], ink: [67, 76, 107], muted: [104, 114, 144], faint: [152, 161, 183],
  line: [225, 231, 242], line2: [237, 241, 248], soft: [242, 246, 255], surface: [249, 251, 255], white: [255, 255, 255],
  pass: [21, 128, 61], passBg: [231, 246, 236], fail: [217, 45, 32], failBg: [254, 236, 235], failSoft: [255, 248, 247],
  blocked: [196, 86, 12], blockedBg: [255, 242, 229], blockedSoft: [255, 250, 244], none: [91, 102, 128], noneBg: [238, 241, 246],
  critical: [159, 18, 57], high: [217, 45, 32], medium: [199, 119, 0], low: [14, 116, 144],
};
const STATUS = {
  Pass: { fg: C.pass, bg: C.passBg, soft: C.white },
  Fail: { fg: C.fail, bg: C.failBg, soft: C.failSoft },
  Blocked: { fg: C.blocked, bg: C.blockedBg, soft: C.blockedSoft },
  '': { fg: C.none, bg: C.noneBg, soft: C.white },
};
const SEV = { Critical: C.critical, High: C.high, Medium: C.medium, Low: C.low };

// ---- text sanitising: Poppins glyph coverage (Regular, SemiBold and Bold) ----

const RANGES = ['0', 'd', '20-7e', 'a0-107', '10a-11b', '11e-123', '128-131', '136-137', '139-148', '14c-15b', '15e-165', '168-17e', '18f', '192',
  '1fc-1fd', '218-21b', '259', '2bc', '2c6-2c7', '2c9', '2d8-2dd', '3c0', '901-903', '905-90d', '90f-911', '913-928', '92a-933', '935-939', '93c-945',
  '947-949', '94b-94d', '950', '958-95e', '960-970', '972', '1e80-1e85', '1ebc-1ebd', '1ef2-1ef3', '1ef8-1ef9', '200c-200d', '2013-2014', '2018-201a',
  '201c-201e', '2020-2022', '2026', '2030', '2039-203a', '2044', '20a8', '20ac', '20b9-20ba', '20bd', '2113', '2122', '2126', '212e', '2202', '2206',
  '220f', '2211-2212', '2215', '2219-221a', '221e', '222b', '2248', '2260', '2264-2265', '25ca', '25cc', 'fb01-fb02']
  .map((r) => r.split('-').map((x) => parseInt(x, 16))).map(([a, b]) => [a, b ?? a]);

const supported = (cp) => {
  let lo = 0;
  let hi = RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < RANGES[mid][0]) hi = mid - 1;
    else if (cp > RANGES[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
};

const SUBS = {
  '→': '->', '⟶': '->', '➔': '->', '➜': '->', '⇒': '=>', '←': '<-', '⟵': '<-', '⇐': '<=', '↔': '<->', '⇔': '<=>', '↑': '^', '↓': 'v',
  '✓': '(OK)', '✔': '(OK)', '☑': '[x]', '✗': '(X)', '✘': '(X)', '❌': '(X)', '✅': '(OK)', '☐': '[ ]',
  '●': '•', '○': 'o', '■': '•', '□': '[ ]', '▪': '•', '▫': '-', '◆': '•', '◇': '-', '►': '>', '▶': '>', '◄': '<', '◀': '<', '★': '*', '☆': '*',
  '­': '', '​': '', '﻿': '', ' ': '\n', ' ': '\n', '‐': '-', '‑': '-', '‒': '-', '―': '—', '′': "'", '″': '"',
};

function clean(value) {
  const s = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 10 || supported(cp)) out += ch;
    else if (SUBS[ch] !== undefined) out += SUBS[ch];
    else if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x0300 && cp <= 0x036f)) continue;
    else {
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      out += base && [...base].every((b) => supported(b.codePointAt(0))) ? base : '?';
    }
  }
  return out;
}

// ---- assets ----

let fontCache = null;

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function fonts() {
  if (fontCache) return fontCache;
  const files = { normal: 'Poppins-Regular.ttf', bold: 'Poppins-SemiBold.ttf', heavy: 'Poppins-Bold.ttf' };
  const out = {};
  for (const [style, file] of Object.entries(files)) out[style] = { file, data: toBase64(await fetchBinary(`assets/fonts/${file}`)) };
  fontCache = out;
  return out;
}

async function prepareShot(shot) {
  const MAX = 2000;
  if (shot.w <= MAX) return shot;
  const bmp = await createImageBitmap(shot.blob);
  const w = MAX;
  const h = Math.round((shot.h * MAX) / shot.w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (shot.format === 'JPEG') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const type = shot.format === 'JPEG' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.92));
  return { ...shot, bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

// ---- builder ----

export async function build(model, { store, onProgress = () => {} }) {
  onProgress(0.02, 'Loading the PDF engine…');
  const { jsPDF, GState } = await getJsPDF();
  const [logo, fontData] = await Promise.all([loadLogo(), fonts()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  for (const [style, f] of Object.entries(fontData)) {
    doc.addFileToVFS(f.file, f.data);
    doc.addFont(f.file, 'Poppins', style);
  }
  doc.setProperties({
    title: clean(model.title),
    subject: clean(model.subtitle),
    author: clean(model.report.preparedBy || 'Iraje Software'),
    creator: model.appName,
    keywords: 'Iraje, QA, test report',
  });
  doc.setLineHeightFactor(1.45);
  const autoTable = window.autoTable || ((d, o) => d.autoTable(o));
  const s = model.stats;
  const logoH = 7.5;
  const logoW = (logo.w / logo.h) * logoH;
  const headerLine = clean([model.report.product, model.report.build && `Build ${model.report.build}`, model.report.environment].filter(Boolean).join('  ·  '));
  const decorated = new Set();
  let y = TOP;

  const page = () => doc.getCurrentPageInfo().pageNumber;
  const font = (style, size, color) => {
    doc.setFont('Poppins', style);
    doc.setFontSize(size);
    if (color) doc.setTextColor(...color);
  };
  const fill = (c) => doc.setFillColor(...c);
  const stroke = (c, w = 0.25) => { doc.setDrawColor(...c); doc.setLineWidth(w); };
  const lh = (size) => size * PT * 1.45;
  const fit = (text, maxW) => {
    let t = clean(text);
    if (doc.getTextWidth(t) <= maxW) return t;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };
  const split = (text, width) => doc.splitTextToSize(clean(text), width);

  function watermark() {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.06 }));
    font('heavy', 62, C.blue);
    const txt = 'Iraje Software';
    const tw = doc.getTextWidth(txt);
    const a = (35 * Math.PI) / 180;
    const th = 62 * PT * 0.7;
    doc.text(txt, W / 2 - (tw / 2) * Math.cos(a) + (th / 2) * Math.sin(a), H / 2 + (tw / 2) * Math.sin(a) + (th / 2) * Math.cos(a), { angle: 35 });
    doc.restoreGraphicsState();
  }

  function header() {
    doc.addImage(logo.bytes, 'PNG', ML, 9.2, logoW, logoH, 'iraje-logo', 'FAST');
    font('bold', 8, C.navy);
    doc.text(fit(model.title, CW - logoW - 10), W - MR, 11.6, { align: 'right', baseline: 'top' });
    if (headerLine) {
      font('normal', 7, C.muted);
      doc.text(fit(headerLine, CW - logoW - 10), W - MR, 15.4, { align: 'right', baseline: 'top' });
    }
    stroke(C.blue, 0.5);
    doc.line(ML, 20.2, W - MR, 20.2);
  }

  function decorate() {
    const p = page();
    if (decorated.has(p)) return;
    decorated.add(p);
    header();
  }

  function newPage() {
    doc.addPage();
    decorate();
    y = TOP;
  }

  const ensure = (need) => {
    if (y + need > BOTTOM) {
      newPage();
      return true;
    }
    return false;
  };

  function paragraph(text, x, width, size = 9.5, color = C.ink) {
    font('normal', size, color);
    const step = lh(size);
    for (const line of split(text, width)) {
      if (y + step > BOTTOM) {
        newPage();
        font('normal', size, color);
      }
      doc.text(line, x, y, { baseline: 'top' });
      y += step;
    }
  }

  function label(text, color = C.blue, x = ML) {
    font('bold', 7.2, color);
    doc.text(clean(text).toUpperCase(), x, y, { baseline: 'top', charSpace: 0.35 });
  }

  function section(title, text) {
    ensure(5 + lh(9.5) * 2);
    label(title);
    y += 4.6;
    paragraph(text || '—', ML, CW);
    y += 3.2;
  }

  function sectionTitle(text) {
    ensure(16);
    fill(C.blue);
    doc.roundedRect(ML, y + 0.4, 1.6, 7, 0.8, 0.8, 'F');
    font('heavy', 15, C.navy);
    doc.text(clean(text), ML + 5, y, { baseline: 'top' });
    y += 12;
  }

  function badge(text, x, yTop, colors, align = 'right') {
    font('bold', 7.8);
    const w = doc.getTextWidth(text) + 8;
    const left = align === 'right' ? x - w : x;
    fill(colors.bg);
    doc.roundedRect(left, yTop, w, 6, 3, 3, 'F');
    fill(colors.fg);
    doc.circle(left + 3.2, yTop + 3, 0.9, 'F');
    doc.setTextColor(...colors.fg);
    doc.text(text, left + 5, yTop + 3.35, { baseline: 'middle' });
    return w;
  }

  const tableBase = {
    margin: { left: ML, right: MR, top: TOP, bottom: H - BOTTOM },
    theme: 'plain',
    styles: {
      font: 'Poppins', fontStyle: 'normal', fontSize: 8.3, textColor: C.ink, overflow: 'linebreak',
      cellPadding: { top: 2.1, bottom: 2.1, left: 2.8, right: 2.8 }, lineColor: C.line2, lineWidth: { bottom: 0.25 }, valign: 'middle',
    },
    headStyles: { fillColor: C.soft, textColor: C.navy, fontStyle: 'bold', fontSize: 7.3, lineColor: C.line, lineWidth: { bottom: 0.35 } },
    alternateRowStyles: { fillColor: [252, 253, 255] },
    willDrawPage: () => decorate(),
  };

  // ---------- cover ----------
  onProgress(0.06, 'Designing the cover…');
  decorate();
  y = 46;
  font('bold', 9, C.blue);
  doc.text(clean(model.subtitle).toUpperCase(), ML, y, { baseline: 'top', charSpace: 0.7 });
  y += 8;
  font('heavy', 25, C.navy);
  for (const line of split(model.title, CW).slice(0, 4)) {
    doc.text(line, ML, y, { baseline: 'top' });
    y += 25 * PT * 1.2;
  }
  y += 2;
  font('normal', 11.5, C.muted);
  doc.text(fit(headerLine || 'Iraje Software · Quality Assurance', CW), ML, y, { baseline: 'top' });
  y += 14;

  const boxW = (CW - 5) / 2;
  for (let i = 0; i < model.meta.length; i += 2) {
    const pair = model.meta.slice(i, i + 2);
    font('bold', 10.5);
    const lines = pair.map(([, v]) => split(v, boxW - 10).slice(0, 2));
    const bh = 9.5 + Math.max(...lines.map((l) => l.length)) * lh(10.5) + 1;
    pair.forEach(([k], j) => {
      const x = ML + j * (boxW + 5);
      fill(C.surface);
      stroke(C.line);
      doc.roundedRect(x, y, boxW, bh, 2.5, 2.5, 'FD');
      font('bold', 6.8, C.muted);
      doc.text(clean(k).toUpperCase(), x + 5, y + 3.2, { baseline: 'top', charSpace: 0.3 });
      font('bold', 10.5, C.navy);
      doc.text(lines[j], x + 5, y + 7.6, { baseline: 'top' });
    });
    y += bh + 4;
  }

  y += 6;
  label('Results at a glance');
  y += 6;
  const rateW = 52;
  fill(C.blue);
  doc.roundedRect(ML, y, rateW, 36, 3, 3, 'F');
  font('bold', 7.2, C.white);
  doc.text('PASS RATE', ML + 6, y + 6, { baseline: 'top', charSpace: 0.4 });
  font('heavy', 26, C.white);
  doc.text(pct(s.passRate), ML + 6, y + 12, { baseline: 'top' });
  font('normal', 7.5, C.white);
  doc.text(`${s.executed} of ${s.total} executed`, ML + 6, y + 27.5, { baseline: 'top' });
  const tiles = [['Pass', s.pass, C.pass], ['Fail', s.fail, C.fail], ['Blocked', s.blocked, C.blocked], ['Not run', s.notRun, C.none]];
  const tw = (CW - rateW - 4 * 4) / 4;
  tiles.forEach(([name, n, color], i) => {
    const x = ML + rateW + 4 + i * (tw + 4);
    fill(C.white);
    stroke(C.line);
    doc.roundedRect(x, y, tw, 36, 3, 3, 'FD');
    fill(color);
    doc.rect(x + 3, y + 33.4, tw - 6, 1.2, 'F');
    font('bold', 7, C.muted);
    doc.text(name.toUpperCase(), x + 4.5, y + 6, { baseline: 'top', charSpace: 0.3 });
    font('heavy', 20, color);
    doc.text(String(n), x + 4.5, y + 12.5, { baseline: 'top' });
    font('normal', 7, C.faint);
    doc.text(s.total ? `${pct(n / s.total)} of total` : '—', x + 4.5, y + 25, { baseline: 'top' });
  });
  y += 44;
  drawSplitBar(y);
  y += 12;
  font('normal', 8, C.muted);
  doc.text(clean(`Generated by ${model.appName} on ${model.generatedLabel}.`), ML, BOTTOM - 6, { baseline: 'top' });

  function drawSplitBar(at) {
    const parts = [[s.pass, C.pass], [s.fail, C.fail], [s.blocked, C.blocked], [s.notRun, [201, 209, 224]]];
    fill(C.line2);
    doc.roundedRect(ML, at, CW, 4, 2, 2, 'F');
    let x = ML;
    for (const [n, color] of parts) {
      if (!n || !s.total) continue;
      const w = (n / s.total) * CW;
      fill(color);
      doc.rect(x, at, w, 4, 'F');
      x += w;
    }
    // legend
    let lx = ML;
    const ly = at + 6.5;
    for (const [name, n, color] of [['Pass', s.pass, C.pass], ['Fail', s.fail, C.fail], ['Blocked', s.blocked, C.blocked], ['Not run', s.notRun, [201, 209, 224]]]) {
      fill(color);
      doc.roundedRect(lx, ly + 0.6, 2.6, 2.6, 0.6, 0.6, 'F');
      font('normal', 7.8, C.ink);
      const t = `${name} ${n}`;
      doc.text(t, lx + 4, ly, { baseline: 'top' });
      lx += doc.getTextWidth(t) + 11;
    }
  }

  // ---------- executive summary ----------
  onProgress(0.1, 'Writing the executive summary…');
  newPage();
  sectionTitle('Executive summary');
  const kw = (CW - 5 * 3.2) / 6;
  [['Total', s.total, C.navy], ['Executed', s.executed, C.navy], ['Pass', s.pass, C.pass], ['Fail', s.fail, C.fail], ['Blocked', s.blocked, C.blocked], ['Pass rate', pct(s.passRate), C.blue]]
    .forEach(([name, v, color], i) => {
      const x = ML + i * (kw + 3.2);
      fill(C.white);
      stroke(C.line);
      doc.roundedRect(x, y, kw, 22, 2.5, 2.5, 'FD');
      fill(color);
      doc.rect(x + 2.5, y + 20.2, kw - 5, 1, 'F');
      font('bold', 6.6, C.muted);
      doc.text(name.toUpperCase(), x + 3.5, y + 4, { baseline: 'top', charSpace: 0.25 });
      font('heavy', 15, color);
      doc.text(String(v), x + 3.5, y + 9.2, { baseline: 'top' });
    });
  y += 28;
  label('Status split');
  y += 5.5;
  drawSplitBar(y);
  y += 16;

  label('Module-wise progress');
  y += 5;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Module / Feature', 'Total', 'Pass', 'Fail', 'Blocked', 'Not run', 'Pass rate']],
    body: model.modules.map((m) => [clean(m.name), m.total, m.pass, m.fail, m.blocked, m.notRun, m.executed ? pct(m.passRate) : '—']),
    columnStyles: { 1: { halign: 'right', cellWidth: 16 }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 16 }, 4: { halign: 'right', cellWidth: 18 }, 5: { halign: 'right', cellWidth: 18 }, 6: { halign: 'right', cellWidth: 22 } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.column.index === 2 && d.cell.raw) d.cell.styles.textColor = C.pass;
      if (d.column.index === 3 && d.cell.raw) d.cell.styles.textColor = C.fail;
      if (d.column.index === 4 && d.cell.raw) d.cell.styles.textColor = C.blocked;
      if (d.column.index === 6) d.cell.styles.fontStyle = 'bold';
    },
  });
  y = doc.lastAutoTable.finalY + 9;
  ensure(40);
  label('Open issues by severity (Fail + Blocked)');
  y += 5;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Severity', 'Fail', 'Blocked', 'Total']],
    body: model.severity.map((r) => [r.name, r.fail, r.blocked, r.total]),
    columnStyles: { 1: { halign: 'right', cellWidth: 24 }, 2: { halign: 'right', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 24, fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 0 && SEV[d.cell.raw]) {
        d.cell.styles.textColor = SEV[d.cell.raw];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = doc.lastAutoTable.finalY + 6;
  const summaryPage = 2;

  // ---------- index ----------
  onProgress(0.14, 'Building the test case index…');
  newPage();
  const indexPage = page();
  sectionTitle('Test case index');
  const links = [];
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['ID', 'Title / Description', 'Module', 'Status', 'Severity', 'Shots']],
    body: model.cases.map((c) => [c.tid, clean(c.title || 'Untitled test case'), clean(c.module || '—'), c.status || 'Not run', c.severity || '—', c.images.length]),
    columnStyles: { 0: { cellWidth: 17, fontStyle: 'bold', textColor: C.blue }, 2: { cellWidth: 34 }, 3: { cellWidth: 19 }, 4: { cellWidth: 19 }, 5: { cellWidth: 13, halign: 'right' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.column.index === 3) {
        d.cell.styles.textColor = (STATUS[d.cell.raw] || STATUS['']).fg;
        d.cell.styles.fontStyle = 'bold';
      }
      if (d.column.index === 4 && SEV[d.cell.raw]) d.cell.styles.textColor = SEV[d.cell.raw];
    },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 0) {
        links.push({ page: page(), x: d.cell.x, y: d.cell.y, w: d.cell.width, h: d.cell.height, i: d.row.index });
      }
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ---------- test cases ----------
  const casePage = [];
  const total = model.cases.length;
  for (let k = 0; k < total; k++) {
    const c = model.cases[k];
    onProgress(0.16 + (k / total) * 0.8, `Laying out ${c.tid} (${k + 1} of ${total})…`);
    if (model.layout === 'page' || k === 0) newPage();
    else {
      y += 6;
      ensure(60);
    }
    casePage[k] = page();
    await drawCase(c);
    await nextFrame();
  }

  async function drawCase(c) {
    const st = STATUS[c.status] || STATUS[''];
    // title band
    font('bold', 12);
    const statusText = c.status || 'Not run';
    font('bold', 7.8);
    const badgeW = doc.getTextWidth(statusText) + 8;
    const idW = 20;
    font('bold', 12);
    const titleLines = split(c.title || 'Untitled test case', CW - idW - badgeW - 16).slice(0, 6);
    const bandH = Math.max(15, 8 + titleLines.length * lh(12));
    ensure(bandH + 30);
    fill(C.soft);
    doc.roundedRect(ML, y, CW, bandH, 3, 3, 'F');
    fill(st.fg);
    doc.roundedRect(ML, y, 2.4, bandH, 1.2, 1.2, 'F');
    font('heavy', 10.5, C.blue);
    doc.text(c.tid, ML + 6, y + 4.2, { baseline: 'top' });
    font('bold', 12, C.navy);
    doc.text(titleLines, ML + 6 + idW, y + 4, { baseline: 'top' });
    badge(statusText, W - MR - 4, y + 4.2, st);
    y += bandH + 4;

    // facts
    const facts = [['Module / Feature', c.module], ['Field / Control', c.field], ['Test Type', c.type], ['Account Type', c.account], ['Severity', c.severity], ['Tester', c.tester]];
    const fw = (CW - 2 * 3) / 3;
    for (let r = 0; r < facts.length; r += 3) {
      const row = facts.slice(r, r + 3);
      font('bold', 8.8);
      const lines = row.map(([, v]) => split(v || '—', fw - 7).slice(0, 4));
      const fh = 8.6 + Math.max(...lines.map((l) => l.length)) * lh(8.8);
      ensure(fh + 2);
      row.forEach(([k], j) => {
        const x = ML + j * (fw + 3);
        fill(C.surface);
        stroke(C.line2);
        doc.roundedRect(x, y, fw, fh, 2, 2, 'FD');
        font('bold', 6.3, C.muted);
        doc.text(k.toUpperCase(), x + 3.5, y + 2.6, { baseline: 'top', charSpace: 0.25 });
        const sevColor = k === 'Severity' && SEV[row[j][1]];
        font('bold', 8.8, sevColor || (row[j][1] ? C.navy : C.faint));
        doc.text(lines[j], x + 3.5, y + 6.4, { baseline: 'top' });
      });
      y += fh + 3;
    }
    y += 2;

    if (c.pre) section('Preconditions', c.pre);
    section('Test steps', c.steps);
    if (c.data) section('Test data', c.data);
    compare(c, st);
    if (c.comments) section('Comments / Defect ID', c.comments);

    if (c.images.length) {
      const shots = [];
      for (const id of c.images) {
        const shot = await loadShot(store, id);
        if (shot) shots.push({ id, shot: await prepareShot(shot) });
      }
      const sizeOf = (shot) => {
        let w = Math.min(CW, shot.w * 0.2646 * 1.3);
        let h = (w * shot.h) / shot.w;
        if (h > 168) {
          h = 168;
          w = (h * shot.w) / shot.h;
        }
        return { w, h };
      };
      // keep the heading together with (at least a readable part of) the first screenshot
      if (shots.length) ensure(6 + Math.min(sizeOf(shots[0].shot).h, 70) + 9);
      label(`Evidence · ${c.images.length} screenshot${c.images.length > 1 ? 's' : ''}`);
      y += 6;
      for (let n = 0; n < shots.length; n++) {
        const { shot } = shots[n];
        let { w, h } = sizeOf(shot);
        const avail = BOTTOM - y - 9;
        if (h > avail) {
          if (avail >= 70 && avail >= h * 0.6) {
            w *= avail / h;
            h = avail;
          } else {
            newPage();
          }
        }
        const x = ML + (CW - w) / 2;
        stroke(C.line, 0.3);
        doc.roundedRect(x - 0.8, y - 0.8, w + 1.6, h + 1.6, 1.5, 1.5, 'S');
        doc.addImage(shot.bytes, shot.format, x, y, w, h, shots[n].id, 'FAST');
        y += h + 2.2;
        font('normal', 7.3, C.muted);
        doc.text(`${c.tid} · Screenshot ${n + 1} of ${shots.length}`, W / 2, y, { align: 'center', baseline: 'top' });
        y += 7;
      }
    }
  }

  function compare(c, st) {
    const colW = (CW - 4) / 2;
    font('normal', 9.3);
    const a = split(c.expected || '—', colW - 8);
    const b = split(c.actual || '—', colW - 8);
    const step = lh(9.3);
    const boxH = 11 + Math.max(a.length, b.length) * step;
    if (boxH > BOTTOM - TOP - 4) {
      section('Expected result', c.expected);
      section('Actual result', c.actual);
      return;
    }
    ensure(boxH + 2);
    [[a, 'Expected result', C.blue, C.surface, C.line2], [b, 'Actual result', C.ink, st.soft, c.status === 'Fail' ? [249, 182, 176] : c.status === 'Blocked' ? [249, 201, 154] : C.line2]]
      .forEach(([lines, title, color, bg, border], j) => {
        const x = ML + j * (colW + 4);
        fill(bg);
        stroke(border, 0.3);
        doc.roundedRect(x, y, colW, boxH, 2.5, 2.5, 'FD');
        font('bold', 7.2, color);
        doc.text(title.toUpperCase(), x + 4, y + 3.4, { baseline: 'top', charSpace: 0.35 });
        font('normal', 9.3, C.ink);
        doc.text(lines, x + 4, y + 8.4, { baseline: 'top' });
      });
    y += boxH + 4;
  }

  // ---------- links, outline, footers ----------
  onProgress(0.97, 'Numbering pages…');
  for (const l of links) {
    doc.setPage(l.page);
    doc.link(l.x, l.y, l.w, l.h, { pageNumber: casePage[l.i] });
  }
  try {
    const ascii = (t) => clean(t).replace(/[^\x20-\x7E -ÿ]/g, '');
    doc.outline.add(null, 'Cover', { pageNumber: 1 });
    doc.outline.add(null, 'Executive summary', { pageNumber: summaryPage });
    const idx = doc.outline.add(null, 'Test case index', { pageNumber: indexPage });
    model.cases.forEach((c, k) => doc.outline.add(idx, ascii(`${c.tid}  ${c.title || 'Untitled'}`).slice(0, 90), { pageNumber: casePage[k] }));
  } catch (err) {
    console.warn('PDF outline skipped', err);
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    watermark(); // on top of content so it stays visible over tables and screenshots
    stroke(C.line, 0.3);
    doc.line(ML, BOTTOM + 6, W - MR, BOTTOM + 6);
    font('normal', 7, C.muted);
    doc.text('Iraje Software  ·  Iraje QA Management', ML, BOTTOM + 8.5, { baseline: 'top' });
    doc.text(clean(model.generatedLabel), W / 2, BOTTOM + 8.5, { align: 'center', baseline: 'top' });
    font('bold', 7, C.navy);
    doc.text(`Page ${p} of ${pages}`, W - MR, BOTTOM + 8.5, { align: 'right', baseline: 'top' });
  }
  onProgress(1, 'Saving…');
  await nextFrame();
  return doc.output('blob');
}
