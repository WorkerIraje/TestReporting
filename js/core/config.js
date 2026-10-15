// Central configuration: limits, template mapping and the test case field schema.
// Everything here mirrors assets/IrajeTestcaseTemplate.xlsx (sheet "TestCases", header row 6).

export const APP = Object.freeze({
  name: 'Iraje QA Management',
  author: 'Aniket',
  maxCases: 1500,              // the template has 1,500 pre-formatted rows (7..1506)
  maxUploadCases: 600,         // per upload, to keep imports fast and bounded
  maxUploadBytes: 10 * 1024 * 1024,
  maxImageBytes: 15 * 1024 * 1024,
  maxImagesPerCase: 20,
  maxImagePixels: 40_000_000,  // refuse absurd dimensions (decompression bombs)
  maxProjectBytes: 512 * 1024 * 1024,
  maxFieldLength: 32_000,      // Excel's per-cell limit is 32,767
  importTimeoutMs: 30_000,
  templateUrl: 'assets/IrajeTestcaseTemplate.xlsx',
  templateDownloadName: 'Iraje_Testcase_Template.xlsx',
  logoUrl: 'assets/img/iraje-logo.png',
  projectExt: '.iqa',
});

export const TEMPLATE = Object.freeze({
  casesSheet: 'TestCases',
  summarySheet: 'Summary',
  headerRow: 6,
  firstDataRow: 7,
  lastDataRow: 1506,
  // Summary sheet: editable product-detail cells
  summaryCells: { product: 'C6', build: 'H6', environment: 'C7', cycle: 'H7', preparedBy: 'C8', reviewedBy: 'H8' },
  // Summary sheet: dropdown list columns (rows 21..50)
  listColumns: { account: 'L', type: 'M', tester: 'N' },
  listFirstRow: 21,
  listLastRow: 50,
});

export const STATUS = Object.freeze(['Pass', 'Fail', 'Blocked']);
export const SEVERITY = Object.freeze(['Critical', 'High', 'Medium', 'Low']);

// Fallback lists (the live lists are read from the template's Summary sheet at runtime).
export const DEFAULT_LISTS = Object.freeze({
  account: ['SuperAdmin', 'OrgAdmin', 'Both'],
  type: ['Functional', 'Negative', 'Boundary', 'Validation', 'Data Validation', 'UI', 'UX', 'Usability',
    'Usability/Policy', 'Accessibility', 'Performance', 'Integration', 'Resilience', 'Observability',
    'Privacy', 'Security', 'Session Security', 'MFA Security', 'Cookie Security', 'Header Security',
    'Transport Security', 'Storage Security', 'Anti-Automation', 'Risk-based Auth'],
  tester: ['Aniket K'],
});

/**
 * Test case fields, in template column order (column A "Test ID" is generated from the position).
 * kind: text | textarea | select | combo | segment
 */
export const FIELDS = Object.freeze([
  { key: 'title', label: 'Title / Description', header: 'Title / Description', col: 'B', required: true, kind: 'textarea', rows: 2, group: 'scope', wide: true, placeholder: 'What does this test case verify?' },
  { key: 'module', label: 'Module / Feature', header: 'Module / Feature', col: 'C', required: true, kind: 'combo', list: 'module', group: 'scope', placeholder: 'e.g. Login, WebACD, Policies' },
  { key: 'field', label: 'Field / Control', header: 'Field / Control', col: 'D', required: true, kind: 'text', group: 'scope', placeholder: 'e.g. Username field, Save button' },
  { key: 'account', label: 'Account Type', header: 'Account Type ▾', col: 'E', kind: 'select', list: 'account', group: 'scope' },
  { key: 'type', label: 'Test Type', header: 'Test Type ▾', col: 'F', kind: 'combo', list: 'type', group: 'scope', placeholder: 'Functional, Negative, Security…' },
  { key: 'pre', label: 'Preconditions', header: 'Preconditions', col: 'G', kind: 'textarea', rows: 2, group: 'design', placeholder: 'What must be true before you start?' },
  { key: 'data', label: 'Test Data', header: 'Test Data', col: 'I', kind: 'textarea', rows: 2, group: 'design', placeholder: 'Inputs, accounts, files used' },
  { key: 'steps', label: 'Test Steps', header: 'Test Steps', col: 'H', required: true, kind: 'textarea', rows: 4, group: 'design', wide: true, placeholder: '1. Open…\n2. Click…\n3. Observe…' },
  { key: 'expected', label: 'Expected Result', header: 'Expected Result', col: 'J', required: true, kind: 'textarea', rows: 3, group: 'design', wide: true, placeholder: 'What should happen' },
  { key: 'actual', label: 'Actual Result', header: 'Actual Result', col: 'K', required: true, kind: 'textarea', rows: 3, group: 'result', wide: true, placeholder: 'What actually happened' },
  { key: 'status', label: 'Status', header: 'Status ▾', col: 'L', required: true, kind: 'segment', options: STATUS, group: 'result' },
  { key: 'severity', label: 'Severity', header: 'Severity ▾', col: 'M', kind: 'segment', options: SEVERITY, group: 'result', hint: 'Not used when the status is Pass' },
  { key: 'tester', label: 'Tester', header: 'Tester ▾', col: 'N', kind: 'combo', list: 'tester', group: 'result', placeholder: 'Who executed it' },
  { key: 'comments', label: 'Comments / Defect ID', header: 'Comments / Defect ID', col: 'O', kind: 'textarea', rows: 1, group: 'result', placeholder: 'Bug ID, notes, links' },
]);

export const FIELD_KEYS = Object.freeze(FIELDS.map((f) => f.key));
export const REQUIRED_KEYS = Object.freeze(FIELDS.filter((f) => f.required).map((f) => f.key));
export const FIELD_BY_KEY = Object.freeze(Object.fromEntries(FIELDS.map((f) => [f.key, f])));

// Header row of the TestCases sheet, column A..O, exactly as the template spells it.
export const TEMPLATE_HEADERS = Object.freeze(['Test ID', ...FIELDS.slice().sort((a, b) => a.col.localeCompare(b.col)).map((f) => f.header)]);

export const GROUPS = Object.freeze([
  { key: 'scope', title: 'Scope', hint: 'What is being tested' },
  { key: 'design', title: 'Design', hint: 'How to test it' },
  { key: 'result', title: 'Execution & Result', hint: 'What happened' },
]);

export const REPORT_FIELDS = Object.freeze([
  { key: 'title', label: 'Report title', placeholder: 'e.g. WebACD Release Test Report' },
  { key: 'product', label: 'Product', placeholder: 'e.g. Iraje PAM' },
  { key: 'build', label: 'Build / Version', placeholder: 'e.g. 4.5.2 p3' },
  { key: 'environment', label: 'Environment', placeholder: 'e.g. UAT, Staging' },
  { key: 'cycle', label: 'Test Cycle', placeholder: 'e.g. Cycle 2 / Regression' },
  { key: 'preparedBy', label: 'Prepared By', placeholder: 'Tester name(s)' },
  { key: 'reviewedBy', label: 'Reviewed By', placeholder: 'Reviewer name' },
  { key: 'date', label: 'Report date', type: 'date' },
]);
