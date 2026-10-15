// Keyboard shortcut reference.

import { h } from './dom.js';
import { openModal } from './modal.js';
import { modKey } from '../core/util.js';

const keys = (...k) => k.flatMap((x, i) => (i ? [' + ', h('kbd', x)] : [h('kbd', x)]));

export const SHORTCUTS = [
  ['Next card (adds a new one on the last card)', keys(modKey, 'Enter')],
  ['Previous card', keys(modKey, 'Shift', 'Enter')],
  ['Bookmark / un-bookmark the current card', keys(modKey, 'B')],
  ['New line inside a field', keys('Enter')],
  ['Next field / previous field', [h('kbd', 'Tab'), ' / ', ...keys('Shift', 'Tab')]],
  ['Paste a screenshot from the clipboard', keys(modKey, 'V')],
  ['Close a dialog, drawer or viewer', keys('Esc')],
];

export function showShortcuts() {
  openModal({
    title: 'Keyboard shortcuts',
    subtitle: 'Work through hundreds of test cases or enhancement requests without leaving the keyboard.',
    iconName: 'keyboard',
    body: h('table.shortcut-table', h('tbody', SHORTCUTS.map(([label, k]) => h('tr', h('td', label), h('td', k))))),
    actions: [{ label: 'Got it', variant: 'primary', value: true, autofocus: true }],
  });
}
