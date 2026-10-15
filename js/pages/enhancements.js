// Enhancement Report workspace: Create (card editor), Upload (Word template) and Summary.

import { enhancementStore } from '../core/store.js';
import { ENHANCEMENTS } from '../core/workspaces.js';
import { button } from '../ui/dom.js';
import { createWorkspace } from './workspace.js';
import * as editor from './editor.js';
import * as upload from './enhancement-upload.js';
import * as summary from './enhancement-summary.js';

export const enhancements = createWorkspace({
  def: ENHANCEMENTS,
  store: enhancementStore,
  views: { create: editor, upload, summary },
  tabs: [
    { key: 'create', icon: 'edit', label: 'Create', badge: (s) => String(s.count) },
    { key: 'upload', icon: 'upload', label: 'Upload' },
    { key: 'summary', icon: 'chart', label: 'Summary' },
  ],
  tools: () => [button('Download template', { variant: 'soft', size: 'sm', iconLeft: 'download', onclick: upload.downloadEnhancementTemplate })],
});
