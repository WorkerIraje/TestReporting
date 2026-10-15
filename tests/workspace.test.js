// Workspace shell: leaving a workspace closes its drawers.

import { test, ok } from './harness.js';
import { testDef, dropDb } from './fixtures.js';
import { createStore } from '../js/core/store.js';
import { ENHANCEMENTS } from '../js/core/workspaces.js';
import { createWorkspace } from '../js/pages/workspace.js';
import { openNavigator } from '../js/pages/navigator.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('unmounting a workspace closes its navigator drawer', async () => {
  const def = testDef(ENHANCEMENTS);
  const store = createStore(def);
  await store.init();
  const page = createWorkspace({ def, store, views: { create: { mount: () => null } }, tabs: [{ key: 'create', icon: 'edit', label: 'Create' }] });
  const root = document.createElement('div');
  document.body.append(root);
  const cleanup = page.mount(root, { tab: 'create' });
  openNavigator(page.ws);
  ok(document.querySelector('.drawer'), 'drawer did not open');
  cleanup();
  await wait(400);
  ok(!document.querySelector('.drawer'), 'drawer still open after leaving the workspace');
  root.remove();
  await store.flush();
  await dropDb(def.dbName);
});
