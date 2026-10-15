// DOM builder: children of every primitive type render as text.

import { test, eq } from './harness.js';
import { h } from '../js/ui/dom.js';

test('a number right after the tag renders as text', () => {
  eq(h('td', 2).textContent, '2');
  eq(h('td', 0).textContent, '0');
  eq(h('td.num', 12, ' items').textContent, '12 items');
});

test('props objects still apply', () => {
  const el = h('td', { title: 'x' }, 3);
  eq([el.title, el.textContent], ['x', '3']);
});
