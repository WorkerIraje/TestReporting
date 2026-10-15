// Project files (.iqa) carry their workspace kind and are refused by the other workspace.

import { test, eq, ok, rejects } from './harness.js';
import { testDef, dropDb, pngFile } from './fixtures.js';
import { createStore } from '../js/core/store.js';
import { TESTCASES, ENHANCEMENTS } from '../js/core/workspaces.js';
import { saveProject, openProject } from '../js/services/project-file.js';
import { processImageFiles } from '../js/services/images.js';
import { getJSZip } from '../js/core/loader.js';

async function seeded(def, fields, withShot = false) {
  const d = testDef(def);
  const s = createStore(d);
  await s.init();
  for (const [k, v] of Object.entries(fields)) s.setField(s.current.id, k, v);
  if (withShot) {
    const { records } = await processImageFiles([await pngFile()]);
    await s.addImages(s.current.id, records);
  }
  await s.flush();
  return { s, d };
}

test('enhancement project round-trips with its kind', async () => {
  const { s, d } = await seeded(ENHANCEMENTS, { title: 'Faster login', priority: 'High' }, true);
  const file = new File([await saveProject(s)], 'er.iqa');
  const data = await openProject(file, ENHANCEMENTS);
  eq(data.cases.length, 1);
  eq(data.cases[0].title, 'Faster login');
  eq(data.cases[0].priority, 'High');
  eq(data.images.length, 1);
  eq(data.cases[0].images.length, 1);
  await dropDb(d.dbName);
});

test('openProject refuses a project of the other workspace', async () => {
  const { s, d } = await seeded(TESTCASES, { title: 'Login works' });
  const file = new File([await saveProject(s)], 'tc.iqa');
  await rejects(() => openProject(file, ENHANCEMENTS), (e) => e.title === 'Wrong workspace' && /Test Cases/.test(e.message));
  await dropDb(d.dbName);
});

test('old project without kind opens in Test Cases', async () => {
  const JSZip = await getJSZip();
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ app: 'iraje-qa-management', format: 1, cases: [{ title: 'x' }], images: [] }));
  const file = new File([await zip.generateAsync({ type: 'blob' })], 'old.iqa');
  const data = await openProject(file, TESTCASES);
  eq(data.cases.length, 1);
  ok(await rejects(() => openProject(file, ENHANCEMENTS), (e) => e.title === 'Wrong workspace'));
});
