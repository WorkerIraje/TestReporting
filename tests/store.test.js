// Shared store: generic normalisation, workspace rules, separate databases, old sessions.

import { test, eq, ok } from './harness.js';
import { testDef, dropDb } from './fixtures.js';
import { createStore } from '../js/core/store.js';
import { createDb } from '../js/core/db.js';
import { TESTCASES, ENHANCEMENTS } from '../js/core/workspaces.js';

test('normalize matches fixed options case-insensitively', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  eq(s.normalize({ priority: 'high', status: 'approved' }).priority, 'High');
  eq(s.normalize({ priority: 'high', status: 'approved' }).status, 'Approved');
  eq(s.normalize({ priority: 'urgent' }).priority, '');
});

test('test case Pass clears Severity on set and on normalize', async () => {
  const def = testDef(TESTCASES);
  const s = createStore(def);
  await s.init();
  const { id } = s.current;
  s.setField(id, 'severity', 'High');
  s.setField(id, 'status', 'Pass');
  eq(s.current.severity, '');
  eq(s.normalize({ status: 'passed', severity: 'High' }).severity, '');
  await s.flush();
  await dropDb(def.dbName);
});

test('required fields come from the workspace', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  eq(s.missingFields(s.blank()), ['title', 'module', 'priority', 'current', 'proposed', 'value']);
  ok(s.isComplete({ ...s.blank(), title: 'a', module: 'b', priority: 'Low', current: 'c', proposed: 'd', value: 'e' }));
});

test('ids use the workspace prefix', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  ok(/^er_/.test(s.blank().id));
  ok(/^er_/.test(s.normalize({ id: 'tc_abcdef12' }).id));
});

test('stores persist to separate databases', async () => {
  const tcDef = testDef(TESTCASES);
  const erDef = testDef(ENHANCEMENTS);
  const tc = createStore(tcDef);
  const er = createStore(erDef);
  await Promise.all([tc.init(), er.init()]);
  tc.setField(tc.current.id, 'title', 'A');
  er.setField(er.current.id, 'title', 'B');
  await Promise.all([tc.flush(), er.flush()]);
  const tc2 = createStore(tcDef);
  const er2 = createStore(erDef);
  await Promise.all([tc2.init(), er2.init()]);
  eq(tc2.state.cases.map((c) => c.title), ['A']);
  eq(er2.state.cases.map((c) => c.title), ['B']);
  await Promise.all([dropDb(tcDef.dbName), dropDb(erDef.dbName)]);
});

test('restores a session saved by the previous version', async () => {
  const def = testDef(TESTCASES);
  await createDb(def.dbName).write([
    { store: 'kv', type: 'put', key: 'session', value: { version: 1, order: ['tc_old00001'], index: 0, report: { title: 'Old', date: '2026-10-01' }, createdAt: 1, updatedAt: 2 } },
    { store: 'cases', type: 'put', value: { id: 'tc_old00001', title: 'Login works', status: 'Pass', severity: 'High', images: [], bookmarked: true, createdAt: 1, updatedAt: 2 } },
  ]);
  const s = createStore(def);
  await s.init();
  eq(s.count, 1);
  eq(s.current.id, 'tc_old00001');
  eq(s.current.title, 'Login works');
  eq(s.current.severity, '');
  ok(s.current.bookmarked);
  eq(s.state.report.title, 'Old');
  eq(s.state.restored.count, 1);
  await dropDb(def.dbName);
});

test('enhancement stats count priorities and blank status as proposed', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  const items = [
    { ...s.blank(), priority: 'Critical', status: 'Approved' },
    { ...s.blank(), priority: 'High', status: '' },
    { ...s.blank(), priority: 'Low', status: 'Planned' },
  ];
  const st = s.stats(items);
  eq([st.total, st.critical, st.high, st.medium, st.low, st.proposed, st.approved, st.planned, st.approvedPlanned], [3, 1, 1, 0, 1, 1, 1, 1, 2]);
});

test('suggestions use the workspace lists plus values already used', async () => {
  const def = testDef(ENHANCEMENTS);
  const s = createStore(def);
  await s.init();
  s.setField(s.current.id, 'category', 'Billing');
  const list = s.suggestions('category');
  ok(list.includes('Security'), 'template category missing');
  ok(list.includes('Billing'), 'used value missing');
  await s.flush();
  await dropDb(def.dbName);
});
