// Word (DOCX) report built from a report document with the docx library. Uses Segoe UI (the
// template's font), the branded page frame (logo header, watermark behind the text, footer),
// a linked index and full-width screenshots.

import { getDocx } from '../core/loader.js';
import { nextFrame } from '../core/util.js';
import { loadShot } from './model.js';
import { brandParts, FONT, CONTENT } from './docx-brand.js';
import { tone, docxHex, cellValue, cellStyle } from './tones.js';

const CONTENT_PX = Math.floor((CONTENT / 1440) * 96); // ~660 px
const COL = {
  blue: '0451CC', navy: '1D2548', ink: '434C6B', muted: '687290', faint: '98A1B7', line: 'E1E7F2', line2: 'EDF1F8',
  soft: 'F2F6FF', surface: 'F9FBFF', white: 'FFFFFF',
};

/** Tone name -> { fg, bg, soft, border } as RRGGBB. */
function D(key) {
  const t = tone(key);
  return { fg: docxHex(t.fg), bg: docxHex(t.bg), soft: docxHex(t.soft), border: docxHex(t.border) };
}

const anchor = (id) => id.replace('-', '_');

export async function build(model, { store, onProgress = () => {} }) {
  onProgress(0.02, 'Loading the Word engine…');
  const d = await getDocx();
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle, ShadingType, HeadingLevel, VerticalAlignTable, InternalHyperlink, Bookmark, TableLayoutType,
  } = d;
  const { glance, summary, index } = model;
  const productLine = model.productParts.join('  ·  ');
  const { header, footer, page } = await brandParts(d, { title: model.title, productLine, generatedLabel: model.generatedLabel });

  // ---------- helpers ----------
  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color ?? COL.ink, characterSpacing: o.spacing, italics: o.italics });
  const lines = (text, o = {}) => String(text ?? '').split('\n').map((line, i) => new TextRun({
    text: line, font: FONT, size: o.size ?? 19, color: o.color ?? COL.ink, bold: o.bold, break: i ? 1 : undefined,
  }));
  const para = (children, o = {}) => new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: o.before ?? 0, after: o.after ?? 80, line: o.line ?? 300 },
    alignment: o.align,
    heading: o.heading,
    pageBreakBefore: o.pageBreak,
    keepNext: o.keepNext,
    keepLines: o.keepLines,
    border: o.border,
    tabStops: o.tabStops,
  });
  const caps = (text, color = COL.blue, size = 15) => run(String(text).toUpperCase(), { bold: true, size, color, spacing: 12 });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const thin = (color = COL.line) => ({ style: BorderStyle.SINGLE, size: 4, color });
  const borders = (color) => (color ? { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) } : { top: none, bottom: none, left: none, right: none });
  const cell = (children, o = {}) => new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: o.width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    borders: o.borders ?? borders(o.border ?? COL.line),
    margins: { top: o.pad ?? 90, bottom: o.pad ?? 90, left: o.padX ?? 140, right: o.padX ?? 140 },
    verticalAlign: o.valign ?? VerticalAlignTable.CENTER,
    columnSpan: o.span,
  });
  const table = (rows, widths, o = {}) => new Table({
    rows,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: o.borders ?? { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  });
  const gridBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: { style: BorderStyle.SINGLE, size: 24, color: COL.white }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } };
  const spacer = (after = 160) => para(run(''), { after, line: 240 });
  const heading = (text, o = {}) => para([run(text, { bold: true, size: 32, color: COL.navy })], {
    heading: HeadingLevel.HEADING_1, after: 200, pageBreak: o.pageBreak, keepNext: true,
    border: { left: { style: BorderStyle.SINGLE, size: 36, color: COL.blue, space: 8 } },
  });
  /** Column widths in twips: fixed `dxa` columns, the remaining width to the column without one. */
  const widthsOf = (cols) => {
    const fixed = cols.reduce((n, c) => n + (c.dxa || 0), 0);
    return cols.map((c) => c.dxa || CONTENT - fixed);
  };
  const dataTable = (t, widths, linkFirst = false) => table([
    new TableRow({
      tableHeader: true,
      children: t.cols.map((c, i) => cell(para(caps(c.head, COL.navy, 14), { after: 0, align: i && typeof cellValue(t.rows[0]?.[i]) === 'number' ? AlignmentType.RIGHT : undefined }), { width: widths[i], fill: COL.soft, borders: { top: none, left: none, right: none, bottom: thin(COL.line) }, pad: 70 })),
    }),
    ...t.rows.map((r, ri) => new TableRow({
      cantSplit: true,
      children: r.map((c, i) => {
        const v = cellValue(c);
        const st = cellStyle(c);
        const num = typeof v === 'number';
        const bold = st.bold || t.cols[i].bold;
        const child = linkFirst && i === 0
          ? new InternalHyperlink({ anchor: anchor(String(v)), children: [new TextRun({ text: String(v), font: FONT, size: 17, bold: true, color: COL.blue, underline: {} })] })
          : run(v, { size: 17, bold, color: st.tone ? D(st.tone).fg : COL.ink });
        return cell(para(child, { after: 0, align: num ? AlignmentType.RIGHT : undefined }),
          { width: widths[i], fill: ri % 2 ? 'FCFDFF' : undefined, borders: { top: none, left: none, right: none, bottom: thin(COL.line2) }, pad: 60 });
      }),
    })),
  ], widths);
  const scaled = (w, h, maxW, maxH) => {
    let width = Math.min(maxW, w);
    let height = (width * h) / w;
    if (height > maxH) { height = maxH; width = (height * w) / h; }
    return { width: Math.round(width), height: Math.round(height) };
  };

  const children = [];
  const push = (...x) => children.push(...x);

  // ---------- cover ----------
  onProgress(0.06, 'Designing the cover…');
  push(spacer(900));
  push(para(caps(model.subtitle, COL.blue, 18), { after: 120 }));
  push(para(run(model.title, { size: 52, bold: true, color: COL.navy }), { after: 120, line: 280 }));
  push(para(run(productLine || model.coverFallback, { size: 24, color: COL.muted }), { after: 480 }));
  const half = Math.floor(CONTENT / 2);
  const metaRows = [];
  for (let i = 0; i < model.meta.length; i += 2) {
    metaRows.push(new TableRow({
      cantSplit: true,
      children: model.meta.slice(i, i + 2).map(([k, v]) => cell([para(caps(k, COL.muted, 13), { after: 20 }), para(run(v, { size: 21, bold: true, color: COL.navy }), { after: 0 })],
        { width: half, fill: COL.surface, border: COL.white, pad: 120, padX: 180 })),
    }));
  }
  push(table(metaRows, [half, CONTENT - half], { borders: gridBorders }));
  push(spacer(360));
  push(para(caps(glance.label), { after: 120 }));
  const tileW = Math.floor(CONTENT / (glance.tiles.length + 1));
  const tile = (label, value, sub, fg, fill) => cell([
    para(caps(label, fill === COL.blue ? COL.white : COL.muted, 13), { after: 40 }),
    para(run(value, { size: 40, bold: true, color: fg }), { after: 20, line: 240 }),
    para(run(sub, { size: 14, color: fill === COL.blue ? COL.white : COL.faint }), { after: 0 }),
  ], { width: tileW, fill, border: COL.white, pad: 140, padX: 160 });
  push(table([new TableRow({
    children: [
      tile(glance.hero.label, String(glance.hero.value), glance.hero.sub, COL.white, COL.blue),
      ...glance.tiles.map((t) => tile(t.label, String(t.value), t.sub, D(t.tone).fg, D(t.tone).bg)),
    ],
  })], Array(glance.tiles.length + 1).fill(tileW), { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
  push(spacer(120));
  push(splitBar(glance.bar));
  push(spacer(600));
  push(para(run(`Generated by ${model.appName} on ${model.generatedLabel}.`, { size: 16, color: COL.muted })));

  function splitBar(bar) {
    const total = bar.reduce((n, b) => n + b.value, 0);
    const parts = bar.filter((b) => b.value > 0);
    if (!parts.length) return para(run(''));
    const widths = parts.map((b) => Math.max(60, Math.round((b.value / total) * CONTENT)));
    const diff = CONTENT - widths.reduce((a, b) => a + b, 0);
    widths[widths.length - 1] += diff;
    return table([new TableRow({
      height: { value: 160, rule: 'exact' },
      children: parts.map((b, i) => cell(para(run('', { size: 2 }), { after: 0, line: 120 }), { width: widths[i], fill: D(b.tone).fg, borders: borders(null), pad: 0, padX: 0 })),
    })], widths);
  }

  // ---------- executive summary ----------
  onProgress(0.1, 'Writing the executive summary…');
  push(heading(summary.title, { pageBreak: true }));
  const kw = Math.floor(CONTENT / summary.kpis.length);
  push(table([new TableRow({
    children: summary.kpis.map((k) => cell([para(caps(k.label, COL.muted, 13), { after: 30 }), para(run(String(k.value), { size: 32, bold: true, color: D(k.tone).fg }), { after: 0 })],
      { width: kw, fill: COL.surface, border: COL.white, pad: 120 })),
  })], Array(summary.kpis.length).fill(kw), { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
  push(spacer(200));
  push(para(caps(summary.barLabel), { after: 80 }));
  push(splitBar(summary.bar));
  push(para(summary.bar.flatMap((b, i) => [
    run('■ ', { color: D(b.tone).fg }),
    run(`${b.label} ${b.value}${i < summary.bar.length - 1 ? '     ' : ''}`, { size: 17 }),
  ]), { before: 80, after: 280 }));
  summary.tables.forEach((t, i) => {
    if (i) push(spacer(280));
    push(para(caps(t.title), { after: 100, keepNext: true }));
    push(dataTable(t, widthsOf(t.cols)));
  });

  // ---------- index ----------
  onProgress(0.14, `Building the ${index.title.toLowerCase()}…`);
  push(heading(index.title, { pageBreak: true }));
  push(dataTable(index, widthsOf(index.cols), true));

  // ---------- items ----------
  const total = model.items.length;
  for (let k = 0; k < total; k++) {
    const item = model.items[k];
    onProgress(0.16 + (k / total) * 0.78, `Writing ${item.id} (${k + 1} of ${total})…`);
    push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: model.layout === 'page' || k === 0,
      keepNext: true,
      spacing: { before: model.layout === 'page' || k === 0 ? 0 : 480, after: 160, line: 300 },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: COL.soft },
      border: { left: { style: BorderStyle.SINGLE, size: 36, color: D(item.accent).fg, space: 8 } },
      children: [
        new Bookmark({ id: anchor(item.id), children: [run(`${item.id}   `, { size: 22, bold: true, color: COL.blue })] }),
        run(item.title || item.untitled, { size: 24, bold: true, color: COL.navy }),
        run(`     ● ${item.badge.text}`, { size: 18, bold: true, color: D(item.badge.tone).fg }),
      ],
    }));
    const per = item.factsPerRow;
    const fw = Math.floor(CONTENT / per);
    const factRows = [];
    for (let r = 0; r < item.facts.length; r += per) {
      factRows.push(new TableRow({
        cantSplit: true,
        children: item.facts.slice(r, r + per).map((f) => cell([
          para(caps(f.label, COL.muted, 12), { after: 20 }),
          para(run(f.value || '—', { size: 18, bold: true, color: f.tone && f.value ? D(f.tone).fg : f.value ? COL.navy : COL.faint }), { after: 0 }),
        ], { width: fw, fill: COL.surface, border: COL.white, pad: 80 })),
      }));
    }
    push(table(factRows, [...Array(per - 1).fill(fw), CONTENT - (per - 1) * fw], { borders: gridBorders }));
    push(spacer(120));
    for (const s of item.sections) {
      if (s.type === 'compare') {
        const ew = Math.floor(CONTENT / 2);
        const t = D(s.tone);
        push(table([new TableRow({
          children: [
            cell([para(caps(s.left.title), { after: 40 }), para(lines(s.left.text || '—'), { after: 0 })], { width: ew, fill: COL.surface, border: COL.line2, pad: 120, valign: VerticalAlignTable.TOP }),
            cell([para(caps(s.right.title, COL.ink), { after: 40 }), para(lines(s.right.text || '—'), { after: 0 })], { width: CONTENT - ew, fill: t.soft, border: t.border, pad: 120, valign: VerticalAlignTable.TOP }),
          ],
        })], [ew, CONTENT - ew]));
        push(spacer(120));
      } else {
        push(para(caps(s.title), { after: 40, keepNext: true }));
        push(para(lines(s.text || '—'), { after: 160 }));
      }
    }
    if (item.images.length) {
      push(para(caps(`${item.evidenceLabel} · ${item.images.length} screenshot${item.images.length > 1 ? 's' : ''}`), { after: 80, keepNext: true }));
      for (let n = 0; n < item.images.length; n++) {
        const shot = await loadShot(store, item.images[n]);
        if (!shot) continue;
        const size = scaled(shot.w, shot.h, CONTENT_PX, 760);
        push(new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          spacing: { before: 80, after: 40 },
          border: { top: thin(COL.line), bottom: thin(COL.line), left: thin(COL.line), right: thin(COL.line) },
          children: [new ImageRun({ type: shot.format === 'JPEG' ? 'jpg' : 'png', data: shot.bytes, transformation: size, altText: { title: `${item.id} screenshot ${n + 1}`, description: `${item.id} screenshot ${n + 1} of ${item.images.length}`, name: `${item.id}-${n + 1}` } })],
        }));
        push(para(run(`${item.id} · Screenshot ${n + 1} of ${item.images.length}`, { size: 15, color: COL.muted }), { align: AlignmentType.CENTER, after: 200 }));
      }
    }
    if (k % 5 === 0) await nextFrame();
  }

  onProgress(0.96, 'Packaging the document…');
  const doc = new Document({
    creator: model.author,
    title: model.title,
    description: `${model.subtitle} generated by ${model.appName}`,
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: COL.ink } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: COL.navy }, paragraph: { spacing: { after: 200 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: COL.navy }, paragraph: { spacing: { after: 160 } } },
      ],
    },
    sections: [{
      properties: { page },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  onProgress(1, 'Done');
  return blob;
}
