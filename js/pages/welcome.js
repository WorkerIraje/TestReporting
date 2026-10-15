// Welcome page: what the tool is for, and the way in.

import { h, button } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

const FEATURES = [
  ['layers', 'Card-by-card authoring', 'One focused card per test case, with every template field and live validation.'],
  ['image', 'Evidence in a paste', 'Drop, browse or Ctrl+V screenshots straight into the test case they prove.'],
  ['file-text', 'Reports in one click', 'TestSheet, PDF, Word and HTML, branded, watermarked and ready to share.'],
  ['lock', 'Private by design', 'Everything stays in your browser. Nothing is uploaded to any server.'],
];

export function mount(root) {
  const page = h('section.welcome',
    h('div.welcome-grid', { 'aria-hidden': 'true' }),
    h('div.welcome-inner',
      h('div.welcome-copy',
        h('span.eyebrow', icon('shield', { size: 16 }), 'Iraje QA Management'),
        h('h1', 'Test it. Prove it. ', h('span.accent', 'Report it.')),
        h('p.lead', 'Write test cases card by card or import your existing sheet, attach the screenshots that prove each result, '
          + 'and turn a full test cycle into a polished, audit-ready report in minutes, not hours.'),
        h('div.welcome-cta',
          button('Get started', { variant: 'primary', size: 'lg', iconRight: 'arrow-right', onclick: () => { location.hash = '#/home'; } }),
          button('Download template', { variant: 'secondary', size: 'lg', iconLeft: 'download', onclick: downloadTemplate })),
        h('div.welcome-trust',
          h('span', icon('check-circle'), 'Built on the Iraje test case template'),
          h('span', icon('check-circle'), 'Autosaves as you type'),
          h('span', icon('check-circle'), 'Works on any screen'))),
      visual()),
    h('div.welcome-features', FEATURES.map(([ic, title, text]) => h('article.feature',
      h('div.chip-icon', icon(ic)), h('h3', title), h('p', text)))),
    h('p.signature', 'made by ', h('strong', 'Aniket'), ' ~ Product Security Specialist at Iraje Software'));
  root.append(page);
}

function visual() {
  return h('div.welcome-visual', { 'aria-hidden': 'true' },
    h('div.wv-card.wv-main',
      h('div.wv-head', h('span.tc-id', 'TC-042'), h('span.status-badge.is-pass', 'Pass')),
      h('div.wv-line.w80'), h('div.wv-line.w60'),
      h('div.wv-field.is-focus', h('div.wv-line.w40')),
      h('div.wv-field', h('div.wv-line.w60')),
      h('div.wv-shots', h('span'), h('span'), h('span'))),
    h('div.wv-pill.p1', h('span.dot', icon('check')), h('div', '128 passed', h('small', 'Pass rate 94%'))),
    h('div.wv-pill.p2', h('span.dot', icon('file-text')), h('div', 'Report ready', h('small', 'PDF · DOCX · HTML'))),
    h('div.wv-pill.p3', h('span.dot', icon('bookmark')), h('div', '3 bookmarked', h('small', 'Ctrl + B'))));
}

export function downloadTemplate() {
  const a = h('a', { href: 'assets/IrajeTestcaseTemplate.xlsx', download: 'Iraje_Testcase_Template.xlsx', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
}
