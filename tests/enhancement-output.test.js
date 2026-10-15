// On demand (?only=enhancement-output): writes enhancement reports in every format and layout to the
// dev server's out/ folder for visual review.

import { test } from './harness.js';
import { dropDb, pngFile } from './fixtures.js';
import { seededEnhancements, saveOut, ENH_ITEMS, NOW } from './fixtures-reports.js';
import { buildEnhancementDocument } from '../js/reports/enhancement-model.js';
import { processImageFiles } from '../js/services/images.js';

for (const layout of ['page', 'flow']) {
  test(`enhancement reports (${layout}) saved`, async () => {
    const items = ENH_ITEMS.map((c) => ({ ...c, title: `${c.title}: ${c.proposed}` }));
    items[1].current = `${items[1].current}\n${'Lockout length cannot be changed per tenant, so customers with stricter policies ask for custom builds. '.repeat(6)}`;
    const { s, def } = await seededEnhancements(items, { product: 'Iraje PAM', build: '4.6', preparedBy: 'Asha', reviewedBy: 'QA Lead', approvedBy: 'Ravi', date: '2026-10-15' });
    const { records } = await processImageFiles([await pngFile(1280, 720, '#0451CC', 'tenant.png'), await pngFile(800, 1300, '#6D28D9', 'mobile.png')]);
    await s.addImages(s.state.cases[0].id, records);
    const doc = buildEnhancementDocument(s, { layout, now: NOW });
    for (const ext of ['pdf', 'docx', 'html']) {
      const r = await import(`../js/reports/${ext}-report.js`);
      await saveOut(`er-${layout}.${ext}`, await r.build(doc, { store: s }));
    }
    await dropDb(def.dbName);
  });
}
