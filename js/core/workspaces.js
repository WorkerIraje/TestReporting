// Workspace definitions: everything that differs between Test Cases and the Enhancement Report
// (fields, wording, limits, statistics, navigator filters). The store, card editor, navigator and
// workspace shell are shared and read their behaviour from one of these objects.

import { APP, FIELDS, GROUPS, REPORT_FIELDS, DEFAULT_LISTS } from './config.js';
import { testId } from './util.js';

export const PRIORITY = Object.freeze(['Critical', 'High', 'Medium', 'Low']);
export const ENH_STATUS = Object.freeze(['Under review', 'Approved', 'Planned', 'Done', 'Rejected']);
export const PROPOSED = 'Proposed'; // what a blank enhancement status means
export const CATEGORIES = Object.freeze(['Functionality', 'UI / UX', 'Usability', 'Performance', 'Security', 'Accessibility',
  'Reporting', 'Integration', 'Compliance']);

/** Adds the derived lookups every consumer needs and freezes the definition. */
export function defineWorkspace(def) {
  return Object.freeze({
    ...def,
    fieldKeys: Object.freeze(def.fields.map((f) => f.key)),
    requiredKeys: Object.freeze(def.fields.filter((f) => f.required).map((f) => f.key)),
    fieldByKey: Object.freeze(Object.fromEntries(def.fields.map((f) => [f.key, f]))),
  });
}

const firstLine = (s) => String(s || '').split('\n')[0];

export const TESTCASES = defineWorkspace({
  key: 'testcases',
  route: 'testcases',
  title: 'Test Cases',
  tagline: 'Write, import and report your test cases',
  finishHint: 'Finish to review the summary, download the TestSheet and generate reports.',
  fileSuffix: '',
  idPrefix: 'TC',
  uidPrefix: 'tc',
  noun: { one: 'test case', many: 'test cases', One: 'Test case', Many: 'Test cases' },
  dbName: 'iraje-qa-management',
  fields: FIELDS,
  groups: GROUPS,
  evidence: { title: 'Evidence', hint: 'Screenshots that prove the result' },
  reportFields: REPORT_FIELDS,
  reportTab: 'report',
  maxItems: APP.maxCases,
  maxItemsMessage: `The template holds up to ${APP.maxCases.toLocaleString()} test cases.`,
  lists: DEFAULT_LISTS,
  itemId: testId,
  stats(cases, { isComplete }) {
    const s = { total: cases.length, pass: 0, fail: 0, blocked: 0, notRun: 0, complete: 0, images: 0 };
    for (const c of cases) {
      if (c.status === 'Pass') s.pass++;
      else if (c.status === 'Fail') s.fail++;
      else if (c.status === 'Blocked') s.blocked++;
      else s.notRun++;
      if (isComplete(c)) s.complete++;
      s.images += c.images.length;
    }
    s.executed = s.pass + s.fail + s.blocked;
    s.passRate = s.executed ? s.pass / s.executed : 0;
    s.coverage = s.total ? s.executed / s.total : 0;
    return s;
  },
  searchText: (c) => `${c.title}\n${c.module}\n${c.field}\n${c.steps}\n${c.expected}\n${c.actual}\n${c.comments}\n${c.tester}`,
  subtitle: (c) => [c.module, c.field].filter(Boolean).join(' · ') || 'No module yet',
  headline: (c) => firstLine(c.title),
  marker: (c) => ({ cls: c.status ? `is-${c.status.toLowerCase()}` : '', title: c.status || 'Not run' }),
  navFilters: [
    ['all', 'All', () => true],
    ['Pass', 'Pass', (c) => c.status === 'Pass'],
    ['Fail', 'Fail', (c) => c.status === 'Fail'],
    ['Blocked', 'Blocked', (c) => c.status === 'Blocked'],
    ['none', 'Not run', (c) => !c.status],
    ['incomplete', 'Incomplete', (c, s) => !s.isComplete(c)],
    ['bookmarked', 'Bookmarked', (c) => c.bookmarked],
  ],
});

export const ENH_FIELDS = Object.freeze([
  { key: 'title', label: 'Title', required: true, kind: 'textarea', rows: 2, group: 'request', wide: true, placeholder: 'What should be improved?' },
  { key: 'module', label: 'Module / Feature', required: true, kind: 'combo', list: 'module', group: 'request', placeholder: 'e.g. Login, WebACD, Policies' },
  { key: 'category', label: 'Category', kind: 'combo', list: 'category', group: 'request', placeholder: 'Usability, Performance, Security…' },
  { key: 'priority', label: 'Priority', required: true, kind: 'segment', options: PRIORITY, group: 'request' },
  { key: 'status', label: 'Status', kind: 'segment', options: ENH_STATUS, group: 'request', wide: true, hint: `Leave empty while the request is ${PROPOSED}` },
  { key: 'current', label: 'Current behaviour', required: true, kind: 'textarea', rows: 3, group: 'details', wide: true, enterHint: true, placeholder: 'What happens today, and what is missing or painful?' },
  { key: 'proposed', label: 'Proposed improvement', required: true, kind: 'textarea', rows: 3, group: 'details', wide: true, placeholder: 'What should happen instead?' },
  { key: 'value', label: 'Business value', required: true, kind: 'textarea', rows: 2, group: 'details', wide: true, placeholder: 'Who benefits and how' },
  { key: 'acceptance', label: 'Acceptance criteria', kind: 'textarea', rows: 2, group: 'details', wide: true, placeholder: 'How will we know it is done?' },
]);

export const ENH_REPORT_FIELDS = Object.freeze([
  { key: 'title', label: 'Report title', placeholder: 'e.g. WebACD Enhancement Requests' },
  { key: 'product', label: 'Product', placeholder: 'e.g. Iraje PAM' },
  { key: 'build', label: 'Version / Release', placeholder: 'e.g. 4.6' },
  { key: 'preparedBy', label: 'Prepared By', placeholder: 'Your name' },
  { key: 'reviewedBy', label: 'Reviewed By', placeholder: 'Reviewer name' },
  { key: 'approvedBy', label: 'Approved By', placeholder: 'Approver name' },
  { key: 'date', label: 'Report date', type: 'date' },
]);

export const ENHANCEMENTS = defineWorkspace({
  key: 'enhancements',
  route: 'enhancements',
  title: 'Enhancement Report',
  tagline: 'Capture, prioritise and report enhancement requests',
  finishHint: 'Finish to review the summary and generate the PDF, Word or HTML report.',
  fileSuffix: '_Enhancements',
  idPrefix: 'ER',
  uidPrefix: 'er',
  noun: { one: 'request', many: 'requests', One: 'Request', Many: 'Requests' },
  dbName: 'iraje-qa-enhancements',
  fields: ENH_FIELDS,
  groups: Object.freeze([
    { key: 'request', title: 'Request', hint: 'What is being asked' },
    { key: 'details', title: 'Details', hint: 'Why and what changes' },
  ]),
  evidence: { title: 'Reference screenshots', hint: 'Screenshots that show the gap or the idea' },
  reportFields: ENH_REPORT_FIELDS,
  reportTab: 'summary',
  maxItems: 500,
  maxItemsMessage: 'A session holds up to 500 enhancement requests.',
  maxUploadItems: 200,
  maxUploadBytes: 50 * 1024 * 1024,
  lists: { category: CATEGORIES },
  itemId: (i) => `ER-${String(i + 1).padStart(3, '0')}`,
  stats(items, { isComplete }) {
    const s = {
      total: items.length, complete: 0, images: 0, critical: 0, high: 0, medium: 0, low: 0, noPriority: 0,
      proposed: 0, review: 0, approved: 0, planned: 0, done: 0, rejected: 0,
    };
    const byPriority = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };
    const byStatus = { 'Under review': 'review', Approved: 'approved', Planned: 'planned', Done: 'done', Rejected: 'rejected' };
    for (const c of items) {
      s[byPriority[c.priority] || 'noPriority']++;
      s[byStatus[c.status] || 'proposed']++;
      if (isComplete(c)) s.complete++;
      s.images += c.images.length;
    }
    s.approvedPlanned = s.approved + s.planned;
    return s;
  },
  searchText: (c) => `${c.title}\n${c.module}\n${c.category}\n${c.current}\n${c.proposed}\n${c.value}\n${c.acceptance}`,
  subtitle: (c) => [c.module, c.category].filter(Boolean).join(' · ') || 'No module yet',
  headline: (c) => firstLine(c.title),
  marker: (c) => ({ cls: c.priority ? `is-${c.priority.toLowerCase()}` : '', title: c.priority || 'No priority' }),
  navFilters: [
    ['all', 'All', () => true],
    ...PRIORITY.map((p) => [p, p, (c) => c.priority === p]),
    ['incomplete', 'Incomplete', (c, s) => !s.isComplete(c)],
    ['bookmarked', 'Bookmarked', (c) => c.bookmarked],
  ],
});
