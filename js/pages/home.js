// Options page: pick what to work on.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export function mount(root) {
  root.append(h('section.page',
    h('header.home-head',
      h('span.eyebrow', 'Workspace'),
      h('h1', 'What are we working on today?'),
      h('p.lead', 'Pick a workspace. Your progress is saved in this browser as you go.')),
    h('div.option-grid',
      h('a.option-card', { href: '#/testcases/create' },
        h('div.chip-icon', icon('clipboard-check')),
        h('h2', 'Test Cases'),
        h('p.tagline', 'Capture every scenario, attach the proof, and walk away with a report that speaks for itself.'),
        h('ul',
          h('li', icon('check'), 'Write card by card, or upload your filled template'),
          h('li', icon('check'), 'Paste, drop or browse screenshots as evidence'),
          h('li', icon('check'), 'Export the TestSheet, PDF, Word or HTML report')),
        h('span.go', 'Open Test Cases', icon('arrow-right'))),
      h('div.option-card.is-disabled', { 'aria-disabled': 'true', title: 'Coming soon' },
        h('span.soon', 'Coming soon'),
        h('div.chip-icon', icon('lightbulb')),
        h('h2', 'Enhancement Report'),
        h('p.tagline', 'Turn every "it would be better if…" into a clear, prioritised request the team can act on.'),
        h('ul',
          h('li', icon('check'), 'Describe the gap and the expected improvement'),
          h('li', icon('check'), 'Back it with annotated screenshots'),
          h('li', icon('check'), 'Share a ready-to-review enhancement report')),
        h('span.go', 'Available in the next release')))));
}
