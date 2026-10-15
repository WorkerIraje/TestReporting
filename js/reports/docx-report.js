// Word (DOCX) report built with the docx library. Uses Segoe UI (the template's font),
// a small Iraje logo in the page header, an "Iraje Software" watermark behind the text on
// every page, a linked test case index and full-width screenshots.

import { getDocx } from '../core/loader.js';
import { nextFrame } from '../core/util.js';
import { loadLogo, loadShot, watermarkPng, pct } from './model.js';

const FONT = 'Segoe UI';
const PAGE_W = 11906; // A4 in twips
const PAGE_H = 16838;
const MARGIN_X = 1000;
const CONTENT = PAGE_W - MARGIN_X * 2; // twips
const CONTENT_PX = Math.floor((CONTENT / 1440) * 96); // ~660 px
const COL = {
  blue: '0451CC', navy: '1D2548', ink: '434C6B', muted: '687290', faint: '98A1B7', line: 'E1E7F2', line2: 'EDF1F8',
  soft: 'F2F6FF', surface: 'F9FBFF', white: 'FFFFFF',
  pass: '15803D', passBg: 'E7F6EC', fail: 'D92D20', failBg: 'FEECEB', blocked: 'C4560C', blockedBg: 'FFF2E5', none: '5B6680', noneBg: 'EEF1F6',
};
const STATUS = {
  Pass: { fg: COL.pass, bg: COL.passBg, soft: COL.white },
  Fail: { fg: COL.fail, bg: COL.failBg, soft: 'FFF8F7' },
  Blocked: { fg: COL.blocked, bg: COL.blockedBg, soft: 'FFFAF4' },
  '': { fg: COL.none, bg: COL.noneBg, soft: COL.white },
};
const SEV = { Critical: '9F1239', High: 'D92D20', Medium: 'C77700', Low: '0E7490' };

const anchor = (tid) => tid.replace('-', '_');

export async function build(model, { store, onProgress = () => {} }) {
  onProgress(0.02, 'Loading the Word engine…');
  const d = await getDocx();
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle, ShadingType, PageNumber, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HorizontalPositionAlign,
    VerticalPositionAlign, TextWrappingType, HeadingLevel, TabStopType, VerticalAlignTable, InternalHyperlink, Bookmark, TableLayoutType, Tab,
  } = d;
  const [logo, mark] = await Promise.all([loadLogo(), watermarkPng()]);
  const s = model.stats;

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
  const spacer = (after = 160) => para(run(''), { after, line: 240 });
  const heading = (text, o = {}) => para([run(text, { bold: true, size: 32, color: COL.navy })], {
    heading: HeadingLevel.HEADING_1, after: 200, pageBreak: o.pageBreak, keepNext: true,
    border: { left: { style: BorderStyle.SINGLE, size: 36, color: COL.blue, space: 8 } },
  });
  const dataTable = (head, rows, widths, style = () => ({})) => table([
    new TableRow({
      tableHeader: true,
      children: head.map((t, i) => cell(para(caps(t, COL.navy, 14), { after: 0, align: i && typeof rows[0]?.[i] === 'number' ? AlignmentType.RIGHT : undefined }), { width: widths[i], fill: COL.soft, borders: { top: none, left: none, right: none, bottom: thin(COL.line) }, pad: 70 })),
    }),
    ...rows.map((r, ri) => new TableRow({
      cantSplit: true,
      children: r.map((v, i) => {
        const st = style(v, i, ri) || {};
        const num = typeof v === 'number';
        return cell(para(st.children || run(v, { size: 17, bold: st.bold, color: st.color ?? COL.ink }), { after: 0, align: num ? AlignmentType.RIGHT : undefined }),
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

  // ---------- header / footer (every page) ----------
  const logoH = 26;
  const productLine = [model.report.product, model.report.build && `Build ${model.report.build}`].filter(Boolean).join('  ·  ');
  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COL.blue, space: 4 } },
        spacing: { after: 0 },
        children: [
          new ImageRun({ type: 'png', data: logo.bytes, transformation: { width: Math.round((logo.w / logo.h) * logoH), height: logoH } }),
          new ImageRun({
            type: 'png',
            data: mark,
            transformation: { width: 620, height: 797 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
              behindDocument: true,
              allowOverlap: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
          new TextRun({ children: [new Tab()] }),
          run(model.title, { size: 15, bold: true, color: COL.navy }),
          ...(productLine ? [run(`   ${productLine}`, { size: 14, color: COL.muted })] : []),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.CENTER, position: CONTENT / 2 }, { type: TabStopType.RIGHT, position: CONTENT }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: COL.line, space: 4 } },
      children: [
        run('Iraje Software  ·  Iraje QA Management', { size: 14, color: COL.muted }),
        new TextRun({ children: [new Tab(), model.generatedLabel], font: FONT, size: 14, color: COL.muted }),
        new TextRun({ children: [new Tab(), 'Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 14, bold: true, color: COL.navy }),
      ],
    })],
  });

  const children = [];
  const push = (...x) => children.push(...x);

  // ---------- cover ----------
  onProgress(0.06, 'Designing the cover…');
  push(spacer(900));
  push(para(caps(model.subtitle, COL.blue, 18), { after: 120 }));
  push(para(run(model.title, { size: 52, bold: true, color: COL.navy }), { after: 120, line: 280 }));
  push(para(run(productLine || 'Iraje Software · Quality Assurance', { size: 24, color: COL.muted }), { after: 480 }));
  const half = Math.floor(CONTENT / 2);
  const metaRows = [];
  for (let i = 0; i < model.meta.length; i += 2) {
    metaRows.push(new TableRow({
      cantSplit: true,
      children: model.meta.slice(i, i + 2).map(([k, v]) => cell([para(caps(k, COL.muted, 13), { after: 20 }), para(run(v, { size: 21, bold: true, color: COL.navy }), { after: 0 })],
        { width: half, fill: COL.surface, border: COL.white, pad: 120, padX: 180 })),
    }));
  }
  push(table(metaRows, [half, CONTENT - half], { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: { style: BorderStyle.SINGLE, size: 24, color: COL.white }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
  push(spacer(360));
  push(para(caps('Results at a glance'), { after: 120 }));
  const tileW = Math.floor(CONTENT / 5);
  const tile = (label, value, sub, fg, fill) => cell([
    para(caps(label, fill === COL.blue ? COL.white : COL.muted, 13), { after: 40 }),
    para(run(value, { size: 40, bold: true, color: fg }), { after: 20, line: 240 }),
    para(run(sub, { size: 14, color: fill === COL.blue ? COL.white : COL.faint }), { after: 0 }),
  ], { width: tileW, fill, border: COL.white, pad: 140, padX: 160 });
  push(table([new TableRow({
    children: [
      tile('Pass rate', pct(s.passRate), `${s.executed} of ${s.total} executed`, COL.white, COL.blue),
      tile('Pass', String(s.pass), s.total ? `${pct(s.pass / s.total)} of total` : '—', COL.pass, COL.passBg),
      tile('Fail', String(s.fail), s.total ? `${pct(s.fail / s.total)} of total` : '—', COL.fail, COL.failBg),
      tile('Blocked', String(s.blocked), s.total ? `${pct(s.blocked / s.total)} of total` : '—', COL.blocked, COL.blockedBg),
      tile('Not run', String(s.notRun), s.total ? `${pct(s.notRun / s.total)} of total` : '—', COL.none, COL.noneBg),
    ],
  })], Array(5).fill(tileW), { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
  push(spacer(120));
  push(splitBar());
  push(spacer(600));
  push(para(run(`Generated by ${model.appName} on ${model.generatedLabel}.`, { size: 16, color: COL.muted })));

  function splitBar() {
    const parts = [[s.pass, COL.pass], [s.fail, COL.fail], [s.blocked, COL.blocked], [s.notRun, 'C9D1E0']].filter(([n]) => n > 0);
    if (!parts.length) return para(run(''));
    const widths = parts.map(([n]) => Math.max(60, Math.round((n / s.total) * CONTENT)));
    const diff = CONTENT - widths.reduce((a, b) => a + b, 0);
    widths[widths.length - 1] += diff;
    return table([new TableRow({
      height: { value: 160, rule: 'exact' },
      children: parts.map(([, color], i) => cell(para(run('', { size: 2 }), { after: 0, line: 120 }), { width: widths[i], fill: color, borders: borders(null), pad: 0, padX: 0 })),
    })], widths);
  }

  // ---------- executive summary ----------
  onProgress(0.1, 'Writing the executive summary…');
  push(heading('Executive summary', { pageBreak: true }));
  const kw = Math.floor(CONTENT / 6);
  push(table([new TableRow({
    children: [['Total', s.total, COL.navy], ['Executed', s.executed, COL.navy], ['Pass', s.pass, COL.pass], ['Fail', s.fail, COL.fail], ['Blocked', s.blocked, COL.blocked], ['Pass rate', pct(s.passRate), COL.blue]]
      .map(([k, v, c]) => cell([para(caps(k, COL.muted, 13), { after: 30 }), para(run(String(v), { size: 32, bold: true, color: c }), { after: 0 })],
        { width: kw, fill: COL.surface, border: COL.white, pad: 120 })),
  })], Array(6).fill(kw), { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
  push(spacer(200));
  push(para(caps('Status split'), { after: 80 }));
  push(splitBar());
  push(para([
    run('■ ', { color: COL.pass }), run(`Pass ${s.pass}     `, { size: 17 }),
    run('■ ', { color: COL.fail }), run(`Fail ${s.fail}     `, { size: 17 }),
    run('■ ', { color: COL.blocked }), run(`Blocked ${s.blocked}     `, { size: 17 }),
    run('■ ', { color: 'C9D1E0' }), run(`Not run ${s.notRun}`, { size: 17 }),
  ], { before: 80, after: 280 }));
  push(para(caps('Module-wise progress'), { after: 100, keepNext: true }));
  const mw = [CONTENT - 6 * 1100, 1100, 1100, 1100, 1100, 1100, 1100];
  push(dataTable(['Module / Feature', 'Total', 'Pass', 'Fail', 'Blocked', 'Not run', 'Pass rate'],
    model.modules.map((m) => [m.name, m.total, m.pass, m.fail, m.blocked, m.notRun, m.executed ? pct(m.passRate) : '—']), mw,
    (v, i) => (i === 2 && v ? { color: COL.pass } : i === 3 && v ? { color: COL.fail } : i === 4 && v ? { color: COL.blocked } : i === 6 ? { bold: true } : null)));
  push(spacer(280));
  push(para(caps('Open issues by severity (Fail + Blocked)'), { after: 100, keepNext: true }));
  const sw = [CONTENT - 3 * 1500, 1500, 1500, 1500];
  push(dataTable(['Severity', 'Fail', 'Blocked', 'Total'], model.severity.map((r) => [r.name, r.fail, r.blocked, r.total]), sw,
    (v, i) => (i === 0 && SEV[v] ? { color: SEV[v], bold: true } : i === 3 ? { bold: true } : null)));

  // ---------- index ----------
  onProgress(0.14, 'Building the test case index…');
  push(heading('Test case index', { pageBreak: true }));
  const iw = [1100, CONTENT - 1100 - 2000 - 1200 - 1200 - 800, 2000, 1200, 1200, 800];
  push(dataTable(['ID', 'Title / Description', 'Module', 'Status', 'Severity', 'Shots'],
    model.cases.map((c) => [c.tid, c.title || 'Untitled test case', c.module || '—', c.status || 'Not run', c.severity || '—', c.images.length]), iw,
    (v, i, ri) => {
      if (i === 0) {
        return { children: new InternalHyperlink({ anchor: anchor(model.cases[ri].tid), children: [new TextRun({ text: v, font: FONT, size: 17, bold: true, color: COL.blue, underline: {} })] }) };
      }
      if (i === 3) return { color: (STATUS[model.cases[ri].status] || STATUS['']).fg, bold: true };
      if (i === 4 && SEV[v]) return { color: SEV[v] };
      return null;
    }));

  // ---------- test cases ----------
  const total = model.cases.length;
  for (let k = 0; k < total; k++) {
    const c = model.cases[k];
    onProgress(0.16 + (k / total) * 0.78, `Writing ${c.tid} (${k + 1} of ${total})…`);
    const st = STATUS[c.status] || STATUS[''];
    push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: model.layout === 'page' || k === 0,
      keepNext: true,
      spacing: { before: model.layout === 'page' || k === 0 ? 0 : 480, after: 160, line: 300 },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: COL.soft },
      border: { left: { style: BorderStyle.SINGLE, size: 36, color: st.fg, space: 8 } },
      children: [
        new Bookmark({ id: anchor(c.tid), children: [run(`${c.tid}   `, { size: 22, bold: true, color: COL.blue })] }),
        run(c.title || 'Untitled test case', { size: 24, bold: true, color: COL.navy }),
        run(`     ● ${c.status || 'Not run'}`, { size: 18, bold: true, color: st.fg }),
      ],
    }));
    const fw = Math.floor(CONTENT / 3);
    const facts = [['Module / Feature', c.module], ['Field / Control', c.field], ['Test Type', c.type], ['Account Type', c.account], ['Severity', c.severity], ['Tester', c.tester]];
    const factRows = [0, 3].map((r) => new TableRow({
      cantSplit: true,
      children: facts.slice(r, r + 3).map(([k2, v]) => cell([
        para(caps(k2, COL.muted, 12), { after: 20 }),
        para(run(v || '—', { size: 18, bold: true, color: k2 === 'Severity' && SEV[v] ? SEV[v] : v ? COL.navy : COL.faint }), { after: 0 }),
      ], { width: fw, fill: COL.surface, border: COL.white, pad: 80 })),
    }));
    push(table(factRows, [fw, fw, CONTENT - 2 * fw], { borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: { style: BorderStyle.SINGLE, size: 24, color: COL.white }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: COL.white } } }));
    push(spacer(120));
    const block = (title, text) => {
      push(para(caps(title), { after: 40, keepNext: true }));
      push(para(lines(text || '—'), { after: 160 }));
    };
    if (c.pre) block('Preconditions', c.pre);
    block('Test steps', c.steps);
    if (c.data) block('Test data', c.data);
    const ew = Math.floor(CONTENT / 2);
    push(table([new TableRow({
      children: [
        cell([para(caps('Expected result'), { after: 40 }), para(lines(c.expected || '—'), { after: 0 })], { width: ew, fill: COL.surface, border: COL.line2, pad: 120, valign: VerticalAlignTable.TOP }),
        cell([para(caps('Actual result', COL.ink), { after: 40 }), para(lines(c.actual || '—'), { after: 0 })], { width: CONTENT - ew, fill: st.soft, border: c.status === 'Fail' ? 'F9B6B0' : c.status === 'Blocked' ? 'F9C99A' : COL.line2, pad: 120, valign: VerticalAlignTable.TOP }),
      ],
    })], [ew, CONTENT - ew]));
    push(spacer(120));
    if (c.comments) block('Comments / Defect ID', c.comments);
    if (c.images.length) {
      push(para(caps(`Evidence · ${c.images.length} screenshot${c.images.length > 1 ? 's' : ''}`), { after: 80, keepNext: true }));
      for (let n = 0; n < c.images.length; n++) {
        const shot = await loadShot(store, c.images[n]);
        if (!shot) continue;
        const size = scaled(shot.w, shot.h, CONTENT_PX, 760);
        push(new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          spacing: { before: 80, after: 40 },
          border: { top: thin(COL.line), bottom: thin(COL.line), left: thin(COL.line), right: thin(COL.line) },
          children: [new ImageRun({ type: shot.format === 'JPEG' ? 'jpg' : 'png', data: shot.bytes, transformation: size, altText: { title: `${c.tid} screenshot ${n + 1}`, description: `${c.tid} screenshot ${n + 1} of ${c.images.length}`, name: `${c.tid}-${n + 1}` } })],
        }));
        push(para(run(`${c.tid} · Screenshot ${n + 1} of ${c.images.length}`, { size: 15, color: COL.muted }), { align: AlignmentType.CENTER, after: 200 }));
      }
    }
    if (k % 5 === 0) await nextFrame();
  }

  onProgress(0.96, 'Packaging the document…');
  const doc = new Document({
    creator: model.report.preparedBy || 'Iraje Software',
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
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: 1300, bottom: 1150, left: MARGIN_X, right: MARGIN_X, header: 520, footer: 520 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  onProgress(1, 'Done');
  return blob;
}
