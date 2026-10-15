// Word enhancement template: labels, filled blocks, tolerated edits and refused files.

import { test, eq, ok, rejects } from './harness.js';
import { pngFile } from './fixtures.js';
import { labelKind, buildTemplate, parseTemplate } from '../js/services/enhancement-template.js';
import { getDocx, getJSZip } from '../js/core/loader.js';

const asFile = (blob, name = 'filled.docx') => new File([blob], name);

/** Builds a .docx from rows: [[label, value], …] per table; value = string | string[] | { image } | { bullets } | { nested } | node. */
async function makeDocx(tables, { paragraphsOnly = false } = {}) {
  const d = await getDocx();
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, ImageRun, WidthType } = d;
  const png = new Uint8Array(await (await pngFile(240, 140, '#0451CC')).arrayBuffer());
  const paras = (v) => {
    if (v && v.image) {
      return [...(v.paras || []).map((t) => new Paragraph(t)),
        new Paragraph({ children: [new ImageRun({ type: 'png', data: png, transformation: { width: 120, height: 70 } })] })];
    }
    if (v && v.bullets) return v.bullets.map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));
    if (v && v.nested) return [new Paragraph(v.nested.text), new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph(v.nested.inner)] })] })] }), new Paragraph('')];
    if (Array.isArray(v)) return v.map((t) => new Paragraph(t));
    return [new Paragraph(String(v ?? ''))];
  };
  const cell = (v, span) => new TableCell({ children: paras(v), columnSpan: span, width: { size: 3000, type: WidthType.DXA } });
  const children = paragraphsOnly
    ? [new Paragraph('Just a letter, no enhancement blocks.')]
    : tables.flatMap((rows) => [
      new Table({ rows: rows.map((r) => new TableRow({ children: r.map((v) => (v && v.span ? cell(v.value, v.span) : cell(v))) })) }),
      new Paragraph(''),
    ]);
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

test('labelKind recognises the template labels', () => {
  eq(['Title', 'Title:', 'Enhancement title', 'DESCRIPTION', 'Reference screenshots', 'Screenshot', 'Notes'].map(labelKind),
    ['title', 'title', 'title', 'description', 'screenshot', 'screenshot', null]);
});

test('a blank template is reported as empty', async () => {
  await rejects(async () => parseTemplate(asFile(await buildTemplate())), (e) => e.title === 'Template is empty');
});

test('filled blocks become requests with screenshots', async () => {
  const r = await parseTemplate(asFile(await makeDocx([
    [['Title', 'Faster login'], ['Description', ['Line 1', 'Line 2']], ['Reference screenshot', { image: true }]],
    [['Title', 'Export to CSV'], ['Description', ''], ['Reference screenshot', '']],
  ])));
  eq(r.items.map((i) => i.title), ['Faster login', 'Export to CSV']);
  eq(r.items[0].current, 'Line 1\nLine 2');
  eq(r.items[0].images.length, 1);
  eq(r.items[1].images.length, 0);
  eq(r.images.length, 1);
  eq(r.items[0].images[0], r.images[0].id);
});

test('many requests in one table and bullet lists', async () => {
  const r = await parseTemplate(asFile(await makeDocx([[
    ['Title', 'One'], ['Description', 'First'],
    ['Title', 'Two'], ['Description', { bullets: ['Faster', 'Cheaper'] }],
    ['Title', 'Three'], ['Description', 'Third'],
  ]])));
  eq(r.items.map((i) => i.title), ['One', 'Two', 'Three']);
  eq(r.items[1].current, '• Faster\n• Cheaper');
});

test('tolerates edited labels, hints, merged cells and nested tables', async () => {
  const r = await parseTemplate(asFile(await makeDocx([
    [
      [['Title:', 'One-line summary'], { span: 2, value: 'Faster login' }],
      ['', '', ''],
      ['Description', { nested: { text: 'Main text', inner: 'Inner note' } }, ''],
      ['Reference screenshots', { image: true }, ''],
    ],
    [['Enhancement title', 'Export to CSV'], ['description', 'Add CSV']],
  ])));
  eq(r.items.length, 2);
  eq(r.items[0].title, 'Faster login');
  ok(r.items[0].current.startsWith('Main text'), `current was ${JSON.stringify(r.items[0].current)}`);
  eq(r.items[0].images.length, 1);
  eq(r.items[1].current, 'Add CSV');
});

test('external images are ignored', async () => {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(await makeDocx([[['Title', 'Linked'], ['Reference screenshot', { image: true }]]]));
  const relsPath = 'word/_rels/document.xml.rels';
  const rels = await zip.file(relsPath).async('string');
  zip.file(relsPath, rels.replace(/(<Relationship [^>]*Type="[^"]*\/image"[^>]*?)Target="[^"]*"/, '$1Target="https://example.com/x.png" TargetMode="External"'));
  const r = await parseTemplate(asFile(await zip.generateAsync({ type: 'blob' })));
  eq(r.items.map((i) => i.title), ['Linked']);
  eq(r.images.length, 0);
  ok(!performance.getEntriesByType('resource').some((e) => e.name.includes('example.com')), 'an external image was fetched');
});

test('unsafe or wrong files are refused', async () => {
  await rejects(() => parseTemplate(new File(['x'], 'a.doc')), (e) => e.title === 'Unsupported file');
  await rejects(() => parseTemplate(new File(['not a zip'], 'a.docx')), (e) => e.title === 'Damaged file');
  await rejects(() => parseTemplate(new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'a.docx')), (e) => e.title === 'File too large');
  await rejects(async () => parseTemplate(asFile(await makeDocx([], { paragraphsOnly: true }))), (e) => e.title === 'Not an enhancement template');
});

test('more than 200 blocks are truncated', async () => {
  const tables = Array.from({ length: 201 }, (_, i) => [['Title', `Request ${i + 1}`]]);
  const r = await parseTemplate(asFile(await makeDocx(tables)));
  eq(r.items.length, 200);
  eq(r.truncated, 1);
  eq(r.found, 201);
});

test('pictures in merged or unlabeled rows are kept', async () => {
  const r = await parseTemplate(asFile(await makeDocx([[
    ['Title', 'Wide shot'],
    ['Description', 'Line A'],
    ['', 'Line B'],
    [{ paras: ['Reference screenshot', 'Paste one or more screenshots'], image: true }],
    ['', { image: true }],
    ['Caption under the pictures', ''],
  ]])));
  eq(r.items.length, 1);
  eq(r.items[0].title, 'Wide shot');
  eq(r.items[0].current, 'Line A\nLine B');
  eq(r.items[0].images.length, 2);
  eq(r.ignoredRows, 1);
});

test('a table without a Title row starts its own request', async () => {
  const r = await parseTemplate(asFile(await makeDocx([
    [['Title', 'One'], ['Description', 'First']],
    [['Description', 'Orphan text']],
  ])));
  eq(r.items.map((i) => [i.title, i.current]), [['One', 'First'], ['', 'Orphan text']]);
});

test('the template gives plain steps and never names the app', async () => {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(await buildTemplate());
  const parts = Object.keys(zip.files).filter((n) => /^(word\/.*\.xml|docProps\/.*\.xml)$/.test(n));
  for (const name of parts) {
    const xml = await zip.file(name).async('string');
    ok(!xml.includes('QA Management'), `${name} still names the app`);
  }
  const body = await zip.file('word/document.xml').async('string');
  ok(body.includes('Keep the labels Title, Description and Reference screenshot unchanged'), 'label step missing');
});
