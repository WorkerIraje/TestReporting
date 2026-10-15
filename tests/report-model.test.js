// Test case report document: the neutral model every renderer draws.

import { test, eq } from './harness.js';
import { dropDb } from './fixtures.js';
import { seededTestCases, NOW } from './fixtures-reports.js';
import { buildTestCaseDocument } from '../js/reports/model.js';

test('test case document summarises the run', async () => {
  const { s, def } = await seededTestCases();
  const doc = buildTestCaseDocument(s, { now: NOW });
  eq(doc.glance.hero.value, '40.0%'); // 2 pass of 5 executed (pct keeps one decimal)
  eq(doc.glance.tiles.map((t) => t.tone), ['pass', 'fail', 'blocked', 'none']);
  eq(doc.summary.tables.map((t) => t.title), ['Module-wise progress', 'Open issues by severity (Fail + Blocked)']);
  eq(doc.index.rows.length, 6);
  eq(doc.items[0].sections.map((x) => x.type), ['block', 'compare']); // fixture case 1 has no preconditions, data or comments
  eq(doc.items[1].sections.map((x) => x.title || x.type), ['Preconditions', 'Test steps', 'Test data', 'compare', 'Comments / Defect ID']);
  eq(doc.items[0].factsPerRow, 3);
  eq(doc.items[1].badge, { text: 'Fail', tone: 'fail' });
  eq(doc.signoff, null);
  await dropDb(def.dbName);
});

test('defects scope keeps Fail and Blocked only', async () => {
  const { s, def } = await seededTestCases();
  const doc = buildTestCaseDocument(s, { scope: 'defects', now: NOW });
  eq(doc.items.length, 3);
  eq(doc.meta.find(([k]) => k === 'Test Cases in Report')[1], '3 of 6');
  eq(doc.items.map((i) => i.id), ['TC-002', 'TC-004', 'TC-005']);
  await dropDb(def.dbName);
});
