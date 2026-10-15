// On demand (?only=report-parity&mode=<prefix>): writes the test case reports for a fixed fixture
// to the dev server, so renderer changes can be compared page by page with an earlier run.

import { test } from './harness.js';
import { dropDb } from './fixtures.js';
import { seededTestCases, saveOut, NOW } from './fixtures-reports.js';
import { buildTestCaseDocument } from '../js/reports/model.js';

const mode = new URLSearchParams(location.search).get('mode') || 'new';

for (const [scope, layout] of [['all', 'page'], ['defects', 'flow']]) {
  test(`test case reports (${scope}, ${layout}) saved as ${mode}`, async () => {
    const { s, def } = await seededTestCases();
    const doc = buildTestCaseDocument(s, { scope, layout, now: NOW });
    for (const ext of ['pdf', 'docx', 'html']) {
      const r = await import(`../js/reports/${ext}-report.js`);
      await saveOut(`${mode}-${scope}-${layout}.${ext}`, await r.build(doc, { store: s }));
    }
    await dropDb(def.dbName);
  });
}
