// Test Cases workspace: Create (card editor), Upload (Excel template) and Reporting.

import { store } from '../core/store.js';
import { TESTCASES } from '../core/workspaces.js';
import { button } from '../ui/dom.js';
import { createWorkspace } from './workspace.js';
import { downloadTemplate } from './welcome.js';
import * as editor from './editor.js';
import * as upload from './upload.js';
import * as report from './report.js';

export const testcases = createWorkspace({
  def: TESTCASES,
  store,
  views: { create: editor, upload, report },
  tabs: [
    { key: 'create', icon: 'edit', label: 'Create', badge: (s) => String(s.count) },
    { key: 'upload', icon: 'upload', label: 'Upload' },
    { key: 'report', icon: 'chart', label: 'Reporting', badge: (s) => { const st = s.stats(); return st.executed ? `${Math.round(st.passRate * 100)}%` : null; } },
  ],
  tools: () => [button('Download template', { variant: 'soft', size: 'sm', iconLeft: 'download', onclick: downloadTemplate })],
});
