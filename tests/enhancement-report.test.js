// Enhancement report document: priority × status matrix, scopes, sign-off, safe rendering.

import { test, eq, ok } from './harness.js';
import { dropDb } from './fixtures.js';
import { seededEnhancements, ENH_ITEMS, NOW } from './fixtures-reports.js';
import { priorityStatusMatrix, buildEnhancementDocument } from '../js/reports/enhancement-model.js';
import { getJSZip } from '../js/core/loader.js';

test('matrix counts a blank status as Proposed', () => {
  eq(priorityStatusMatrix([{ priority: 'High', status: '' }])[1].counts.Proposed, 1);
});

test('scopes filter the requests but not the summary', async () => {
  const { s, def } = await seededEnhancements();
  eq(buildEnhancementDocument(s, { scope: 'high', now: NOW }).items.length, 2);
  const approved = buildEnhancementDocument(s, { scope: 'approved', now: NOW });
  eq(approved.items.map((i) => i.title), ['A', 'C']);
  eq(approved.summary.kpis[0].value, 5);
  eq(approved.meta.find(([k]) => k === 'Requests in Report')[1], '2 of 5');
  await dropDb(def.dbName);
});

test('sign-off names come from the details', async () => {
  const { s, def } = await seededEnhancements();
  const doc = buildEnhancementDocument(s, { now: NOW });
  eq(doc.signoff.rows.map((r) => r.role), ['Prepared by', 'Reviewed by', 'Approved by']);
  eq(doc.signoff.rows.map((r) => r.name), ['Asha', '', 'Ravi']);
  await dropDb(def.dbName);
});

test('HTML report escapes request text', async () => {
  const { s, def } = await seededEnhancements([{ ...ENH_ITEMS[0], title: '<img src=x onerror=alert(1)>', proposed: '<script>x()</script>' }]);
  const { build } = await import('../js/reports/html-report.js');
  const html = await (await build(buildEnhancementDocument(s, { now: NOW }), { store: s })).text();
  ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'escaped title missing');
  ok(!html.includes('<img src=x'), 'raw markup in title');
  ok(!html.includes('<script>x()'), 'raw script in proposed improvement');
  await dropDb(def.dbName);
});

test('PDF report survives emoji and long text', async () => {
  const { s, def } = await seededEnhancements([{ ...ENH_ITEMS[1], current: `🚀 faster ✅ ${'x'.repeat(5000)}` }]);
  const { build } = await import('../js/reports/pdf-report.js');
  const blob = await build(buildEnhancementDocument(s, { now: NOW }), { store: s });
  eq(blob.type, 'application/pdf');
  ok(blob.size > 10_000, `PDF too small: ${blob.size}`);
  await dropDb(def.dbName);
});

test('DOCX report contains the sign-off table', async () => {
  const { s, def } = await seededEnhancements();
  const { build } = await import('../js/reports/docx-report.js');
  const blob = await build(buildEnhancementDocument(s, { now: NOW }), { store: s });
  const JSZip = await getJSZip();
  const xml = await (await JSZip.loadAsync(blob)).file('word/document.xml').async('string');
  ok(xml.includes('Review &amp; sign-off'), 'sign-off heading missing');
  ok(xml.includes('Approved by'), 'role missing');
  ok(xml.includes('Ravi'), 'approver name missing');
  await dropDb(def.dbName);
});
