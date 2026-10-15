// Enhancement Report workspace: Create (card editor), Upload (Word template) and Summary.

import { enhancementStore } from '../core/store.js';
import { ENHANCEMENTS } from '../core/workspaces.js';
import { createWorkspace } from './workspace.js';
import * as editor from './editor.js';

export const enhancements = createWorkspace({
  def: ENHANCEMENTS,
  store: enhancementStore,
  views: { create: editor },
  tabs: [
    { key: 'create', icon: 'edit', label: 'Create', badge: (s) => String(s.count) },
  ],
});
