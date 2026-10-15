// Enhancement Report workspace: Create (card editor), Upload (Word template) and Summary.

import { enhancementStore } from '../core/store.js';
import { ENHANCEMENTS } from '../core/workspaces.js';
import { createWorkspace } from './workspace.js';
import * as editor from './editor.js';
import * as summary from './enhancement-summary.js';

export const enhancements = createWorkspace({
  def: ENHANCEMENTS,
  store: enhancementStore,
  views: { create: editor, summary },
  tabs: [
    { key: 'create', icon: 'edit', label: 'Create', badge: (s) => String(s.count) },
    { key: 'summary', icon: 'chart', label: 'Summary' },
  ],
});
