// Seeded workspaces for report tests: a fixed set of test cases with screenshots.

import { createStore } from '../js/core/store.js';
import { TESTCASES, ENHANCEMENTS } from '../js/core/workspaces.js';
import { processImageFiles } from '../js/services/images.js';
import { testDef, pngFile } from './fixtures.js';

export const NOW = new Date('2026-10-15T10:00:00');

const CASES = [
  { title: 'Login with valid credentials', module: 'Login', field: 'Username / Password', type: 'Functional', account: 'Both', steps: '1. Open the login page\n2. Enter valid credentials\n3. Click Sign in', expected: 'The dashboard opens.', actual: 'The dashboard opened.', status: 'Pass', tester: 'Aniket K' },
  { title: 'Account locks after five failed attempts', module: 'Login', field: 'Sign in button', type: 'Security', account: 'OrgAdmin', pre: 'User "qa.lock" exists and is active.', data: 'Wrong password, entered 5 times', steps: '1. Enter a wrong password five times\n2. Enter the right password', expected: 'The account is locked for 15 minutes and the user is told so.', actual: 'The account stays unlocked; the sixth attempt signs in.', status: 'Fail', severity: 'High', tester: 'Aniket K', comments: 'BUG-101' },
  { title: 'Session expires after idle timeout', module: 'Session', field: 'Idle timer', type: 'Session Security', steps: '1. Sign in\n2. Stay idle for 15 minutes', expected: 'The session ends and the login page shows.', actual: 'The session ended.', status: 'Pass', tester: 'Aniket K' },
  { title: 'Export audit log to CSV', module: 'Reports', field: 'Export button', type: 'Functional', steps: '1. Open Audit log\n2. Click Export CSV', expected: 'A CSV with all rows downloads.', actual: 'The download is empty.', status: 'Fail', severity: 'Critical', tester: 'Aniket K' },
  { title: 'Bulk import of 500 users', module: 'Reports', field: 'Import wizard', type: 'Performance', steps: '1. Upload users.csv\n2. Confirm', expected: 'All 500 users are imported within a minute.', actual: 'The wizard does not load in UAT.', status: 'Blocked', severity: 'Medium', tester: 'Aniket K' },
  { title: 'Audit trail records role changes', module: 'Reports', field: 'Audit trail', type: 'Observability', steps: '1. Change a role\n2. Open the audit trail', expected: 'The change is listed with who and when.', actual: '', status: '', comments: 'Waiting for build 4.5.3' },
];

export const REPORT = { product: 'Iraje PAM', build: '4.5.2', environment: 'UAT', cycle: 'Cycle 2', preparedBy: 'Aniket K', reviewedBy: 'QA Lead', date: '2026-10-15' };

/** Returns an initialised test case store holding CASES (two screenshots on the second case). */
export async function seededTestCases() {
  const def = testDef(TESTCASES);
  const s = createStore(def);
  await s.init();
  const { records } = await processImageFiles([await pngFile(1280, 720, '#0451CC', 'lockout.png'), await pngFile(900, 1400, '#D92D20', 'mobile.png')]);
  await s.loadCases(CASES.map((c, i) => ({ ...c, images: i === 1 ? records.map((r) => r.id) : [] })), records, { mode: 'replace', report: REPORT });
  return { s, def };
}

export const ENH_ITEMS = [
  { title: 'A', module: 'Login', category: 'Usability', priority: 'Critical', status: 'Approved', current: 'Users pick the tenant on every login.', proposed: 'Pre-select the last used tenant.', value: 'Saves a click for 300 daily users.', acceptance: 'The last tenant is selected after sign-out and sign-in.' },
  { title: 'B', module: 'Login', category: 'Security', priority: 'High', status: '', current: 'Lockout length is fixed.', proposed: 'Make lockout length configurable.', value: 'Matches customer policies.' },
  { title: 'C', module: 'Reports', category: 'Reporting', priority: 'Medium', status: 'Planned', current: 'Exports are CSV only.', proposed: 'Add XLSX export.', value: 'Fewer conversions for auditors.' },
  { title: 'D', module: 'Reports', category: '', priority: 'Low', status: 'Rejected', current: 'Charts are static.', proposed: 'Animate charts.', value: 'Looks nicer.' },
  { title: 'E', module: 'Session', category: 'Usability', priority: 'Low', status: 'Done', current: 'No idle warning.', proposed: 'Warn one minute before timeout.', value: 'Fewer lost forms.' },
];

/** Returns an initialised enhancement store holding items (default ENH_ITEMS) and report details. */
export async function seededEnhancements(items = ENH_ITEMS, report = { product: 'Iraje PAM', build: '4.6', preparedBy: 'Asha', approvedBy: 'Ravi', date: '2026-10-15' }) {
  const def = testDef(ENHANCEMENTS);
  const s = createStore(def);
  await s.init();
  await s.loadCases(items, [], { mode: 'replace', report });
  return { s, def };
}

/** Posts a generated file to the dev server's /__save endpoint (lands in its out/ folder). */
export async function saveOut(name, blob) {
  const res = await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}
