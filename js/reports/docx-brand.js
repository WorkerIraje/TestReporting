// Branded Word page frame shared by the Word report and the enhancement template: A4 page, Iraje
// logo in the header, an "Iraje Software" watermark behind the text on every page, and a footer
// with the app name, generation time and page numbers.

import { loadLogo, watermarkPng } from './model.js';

export const FONT = 'Segoe UI';
export const PAGE_W = 11906; // A4 in twips
export const PAGE_H = 16838;
export const MARGIN_X = 1000;
export const CONTENT = PAGE_W - MARGIN_X * 2; // twips
export const BRAND = { blue: '0451CC', navy: '1D2548', muted: '687290', line: 'E1E7F2' };

/** d = the docx library namespace. Returns { header, footer, page } for a document section. */
export async function brandParts(d, { title, productLine = '', generatedLabel }) {
  const {
    Paragraph, TextRun, ImageRun, Header, Footer, BorderStyle, PageNumber, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
    HorizontalPositionAlign, VerticalPositionAlign, TextWrappingType, TabStopType, Tab,
  } = d;
  const [logo, mark] = await Promise.all([loadLogo(), watermarkPng()]);
  const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: o.size ?? 20, bold: o.bold, color: o.color });
  const logoH = 26;
  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.blue, space: 4 } },
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
          run(title, { size: 15, bold: true, color: BRAND.navy }),
          ...(productLine ? [run(`   ${productLine}`, { size: 14, color: BRAND.muted })] : []),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.CENTER, position: CONTENT / 2 }, { type: TabStopType.RIGHT, position: CONTENT }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND.line, space: 4 } },
      children: [
        run('Iraje Software  ·  Iraje QA Management', { size: 14, color: BRAND.muted }),
        new TextRun({ children: [new Tab(), generatedLabel], font: FONT, size: 14, color: BRAND.muted }),
        new TextRun({ children: [new Tab(), 'Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 14, bold: true, color: BRAND.navy }),
      ],
    })],
  });
  const page = {
    size: { width: PAGE_W, height: PAGE_H },
    margin: { top: 1300, bottom: 1150, left: MARGIN_X, right: MARGIN_X, header: 520, footer: 520 },
  };
  return { header, footer, page };
}
