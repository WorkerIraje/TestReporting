# Enhancement Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an enabled Enhancement Report workspace (card authoring, autosave, screenshots, Word template
import, Summary tab, PDF / DOCX / HTML reports) built on engines shared with Test Cases.

**Architecture:** A workspace definition (fields, groups, wording, limits, hooks) drives one store factory, one
card editor, one navigator and one workspace shell, so Test Cases and Enhancements are two instances. Reports
become a neutral *report document* drawn by the existing three renderers. Enhancements add a Word template
service, an Upload tab and a Summary tab.

**Tech Stack:** Static ES modules (no build), vendored jsPDF + AutoTable, docx, JSZip; IndexedDB; in-browser
test harness run in Edge.

**Spec:** `docs/superpowers/specs/2026-10-15-enhancement-report-design.md`

## Global Constraints

- No build step, no new third-party code; only the vendored libraries in `vendor/`. CSP in `vercel.json` and `index.html` unchanged.
- User text reaches the DOM only through `h()` / `textContent`; generated HTML escapes every value with `escapeHtml`.
- Screenshots enter only through `processImageFiles` (signature, size and dimension checks).
- Every report page and the Word template carry the Iraje logo and the "Iraje Software" watermark.
- Enhancement IDs: `ER-001` (3-digit pad, renumbered by position). Test case IDs unchanged (`TC-001`).
- Limits: 500 requests per session; 200 per Word upload; Word upload 50 MB; 20 screenshots per request.
- Blank enhancement status is displayed and reported as **Proposed**.
- Wording: workspace title "Enhancement Report"; item noun "request" / "requests"; tabs Create · Upload · Summary.
- Test Cases behaviour and report output must not change (verified by pixel / text comparison in Task 3 and the regression in Task 8).
- Match existing style: 2 spaces, single quotes, semicolons, `h()` builder, one comment line describing each file at its top.
- Commit with `git -c user.name=justf -c user.email=indiawill@gmail.com commit`, message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dev server: `.claude/launch.json` config `iraje-qa` (node static server with the Vercel headers on port 5173; `POST /__save?name=<file>` writes into its `out/` folder, served back at `/__out/<file>`). Its folder is referred to below as `$DEV` (`C:/Users/justf/AppData/Local/Temp/claude/C--Users-justf-Desktop-WorkDirectory-AirPort-747/afc903ce-b62b-43f0-90b6-6107f89e0b8a/scratchpad`); `$DEV/render.mjs file.pdf outPrefix [pages|all] [scale]` renders PDF pages to PNG.

## Review Focus

- A tester who used the current version reloads after the upgrade: their autosaved test cases (database `iraje-qa-management`, meta version 1) must come back unchanged. Test: Task 1 `restores a session saved by the previous version`.
- A filled Word template rarely keeps its exact shape: labels typed as `Title:`, a hint line under the label, merged or extra cells, extra empty rows, a nested table. Test: Task 6 `tolerates edited labels, hints, merged cells and nested tables`.
- Switching workspaces with a card mounted must remove the document-level paste / drop / keyboard listeners and the edge arrows; a pasted screenshot lands only in the visible card. Test: Task 2 browser step "switch workspaces mid-edit".
- Request text with markup, emoji or very long lines must not break or inject into any report. Test: Task 4 `HTML report escapes request text` and `PDF report survives emoji and long text`.
- A `.iqa` project from the other workspace, or an old `.iqa` without `kind`, must be handled clearly. Test: Task 2 `openProject refuses a project of the other workspace` and `old project without kind opens in Test Cases`.

---

### Task 1: Test harness, workspace definitions and shared store

**Files:**
- Create: `tests/index.html`, `tests/harness.js`, `tests/run.js`, `tests/fixtures.js`, `tests/store.test.js`, `.vercelignore`
- Create: `js/core/workspaces.js`
- Modify: `js/core/db.js` (whole file: factory), `js/core/store.js` (whole file: factory), `js/core/config.js` (Status and Test Steps field definitions)

**Interfaces:**
- Produces (harness): `test(name, fn)`, `eq(actual, expected, msg)` (deep, via `JSON.stringify`), `ok(cond, msg)`, `rejects(fn, check)` from `tests/harness.js`. `tests/run.js` imports every `*.test.js` listed in its `FILES` array, honours `?only=<substring of file name>`, runs tests in order and writes `<output id="summary" data-status="pass|fail">PASS 12/12</output>` (or `FAIL 3/12`) plus one `<li>` per test with the error message.
- Produces (fixtures): `pngFile(w = 320, h = 200, color = '#0451CC', name = 'shot.png') → Promise<File>`, `testDef(def) → def` (copy with a unique `dbName` `iraje-test-<random>`), `dropDb(name) → Promise<void>`.
- Produces (`workspaces.js`): `PRIORITY`, `ENH_STATUS` (`['Under review','Approved','Planned','Done','Rejected']`), `CATEGORIES` (spec list), `PROPOSED = 'Proposed'`, `defineWorkspace(def) → frozen def` adding `fieldKeys`, `requiredKeys`, `fieldByKey`; `TESTCASES`, `ENHANCEMENTS`.
- Workspace definition fields: `key`, `route`, `title`, `idPrefix`, `uidPrefix`, `noun: { one, many, One, Many }`, `dbName`, `fields`, `groups`, `evidence: { title, hint }`, `reportFields`, `reportTab`, `maxItems`, `maxItemsMessage`, `lists`, `itemId(i) → string`, `stats(items, { isComplete }) → object`, `searchText(item) → string`, `subtitle(item) → string`, `marker(item) → { cls, title }`, `navFilters: [key, label, test(item)][]`. Enhancements also: `maxUploadItems: 200`, `maxUploadBytes: 50 * 1024 * 1024`.
- `TESTCASES`: `key 'testcases'`, `route 'testcases'`, `title 'Test Cases'`, `idPrefix 'TC'`, `uidPrefix 'tc'`, noun test case(s), `dbName 'iraje-qa-management'`, existing `FIELDS / GROUPS / REPORT_FIELDS / DEFAULT_LISTS`, evidence `Evidence` / `Screenshots that prove the result`, `reportTab 'report'`, `maxItems APP.maxCases`, `maxItemsMessage 'The template holds up to 1,500 test cases.'`; `stats` returns today's `store.stats()` object; `navFilters` = today's navigator filters; `marker` = status dot (`is-pass` …, title `Not run` when blank).
- `ENHANCEMENTS`: `key 'enhancements'`, `route 'enhancements'`, `title 'Enhancement Report'`, `idPrefix 'ER'`, `uidPrefix 'er'`, noun request(s), `dbName 'iraje-qa-enhancements'`, fields per the spec table with keys `title, module, category, priority, status, current, proposed, value, acceptance`, groups `request` ("Request" / "What is being asked") and `details` ("Details" / "Why and what changes"), evidence `Reference screenshots` / `Screenshots that show the gap or the idea`, reportFields keys `title, product, build (label 'Version / Release'), preparedBy, reviewedBy, approvedBy, date`, `reportTab 'summary'`, `maxItems 500`, `maxItemsMessage 'A session holds up to 500 enhancement requests.'`, `lists { category: CATEGORIES }`; `stats` returns `{ total, complete, images, critical, high, medium, low, noPriority, proposed, review, approved, planned, done, rejected, approvedPlanned }`; `marker` = priority dot (`is-critical` …, title `No priority`); `navFilters` All / Critical / High / Medium / Low / Incomplete / Bookmarked.
- `config.js`: test case Status field gains `clears: { when: 'Pass', fields: ['severity'] }`; Test Steps gains `enterHint: true`.
- Produces (`db.js`): `createDb(name) → { available, get, getAll, keys, write, estimate, persist }`; `db = createDb('iraje-qa-management')` kept.
- Produces (`store.js`): `createStore(def) → store` with today's API (`init, flush, count, index, current, caseAt, indexOf, goTo, setField, addCase, deleteCase, clearCase, toggleBookmark, clearBookmarks, moveCase, pruneEmpty, addImages, removeImage, moveImage, imageUrl, imageRecord, loadCases, reset, setReport, setLists, suggestions, bookmarks, stats, on, state`) plus `def`, `isComplete(c)`, `missingFields(c)`, `hasContent(c)`, `normalize(raw)`, `blank()`. Listeners are per store. Exports `store = createStore(TESTCASES)`, `enhancementStore = createStore(ENHANCEMENTS)` and, bound to `store`, `isComplete`, `missingFields`, `hasContent`, `normalizeCase`, `blankCase`, `on`.

- [ ] **Step 1: Write the harness and the failing store tests**

`tests/store.test.js` (each test uses `testDef(...)` stores and drops its databases at the end):

```js
test('normalize matches fixed options case-insensitively', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  eq(s.normalize({ priority: 'high', status: 'approved' }).priority, 'High');
  eq(s.normalize({ priority: 'high', status: 'approved' }).status, 'Approved');
  eq(s.normalize({ priority: 'urgent' }).priority, '');
});
test('test case Pass clears Severity on set and on normalize', async () => {
  const s = createStore(testDef(TESTCASES)); await s.init();
  const id = s.current.id;
  s.setField(id, 'severity', 'High'); s.setField(id, 'status', 'Pass');
  eq(s.current.severity, '');
  eq(s.normalize({ status: 'passed', severity: 'High' }).severity, '');
});
test('required fields come from the workspace', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  eq(s.missingFields(s.blank()), ['title', 'module', 'priority', 'current', 'proposed', 'value']);
  ok(s.isComplete({ ...s.blank(), title: 'a', module: 'b', priority: 'Low', current: 'c', proposed: 'd', value: 'e' }));
});
test('ids use the workspace prefix', () => {
  const s = createStore(testDef(ENHANCEMENTS));
  ok(/^er_/.test(s.blank().id));
  ok(/^er_/.test(s.normalize({ id: 'tc_abcdef12' }).id));
});
test('stores persist to separate databases', async () => { /* add one item with title 'A' to a TC store and 'B' to an ER store, flush, re-create both from the same defs, init: TC has only 'A', ER only 'B' */ });
test('restores a session saved by the previous version', async () => {
  // write { version: 1, order: ['tc_old00001'], index: 0, report: { title: 'Old', date: '2026-10-01' }, createdAt: 1, updatedAt: 2 }
  // under kv/'session' and a case { id: 'tc_old00001', title: 'Login works', status: 'Pass', severity: 'High', images: [] }
  // with createDb(def.dbName).write(...); then createStore(def).init()
  eq(s.count, 1); eq(s.current.title, 'Login works'); eq(s.current.severity, ''); eq(s.state.report.title, 'Old'); eq(s.state.restored.count, 1);
});
test('enhancement stats count priorities and blank status as proposed', () => { /* items: Critical/Approved, High/'' , Low/Planned → critical 1, high 1, low 1, proposed 1, approvedPlanned 2 */ });
test('suggestions use the workspace lists plus values already used', () => { /* ER suggestions('category') includes 'Security' and a custom 'Billing' typed on a card */ });
```

- [ ] **Step 2: Run the tests and see them fail**

Start the `iraje-qa` preview (preview_start name `iraje-qa`), then:
Run: `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --user-data-dir="$TEMP/iqa-edge-test" --virtual-time-budget=30000 --dump-dom "http://localhost:5173/tests/?only=store" | grep -o '<output id="summary"[^<]*'`
Expected: `FAIL` (imports of `createStore` / `workspaces.js` fail). If headless dumps before the run finishes, open the same URL in the browser pane and read `#summary` with `get_page_text` instead; use whichever works for every later test step.

- [ ] **Step 3: Implement `workspaces.js`, `createDb`, `createStore` and the `config.js` field flags**

Generic normalisation: fields with `options` use today's `pickOption` (aliases `passed / failed / block` kept); then every `clears` rule. `setField` applies `clears` after writing. Report defaults come from `def.reportFields` (`date` → `todayISO()`). `suggestions(key)` base list is `def.lists[key] || []`. Limits use `def.maxItems`. `.vercelignore` lists `tests/` and `docs/superpowers/`.

- [ ] **Step 4: Run the tests and see them pass**

Run the Step 2 command. Expected: `PASS 8/8`.

- [ ] **Step 5: Smoke-test Test Cases in the browser**

Open `http://localhost:5173/#/testcases/create`: the restored session still loads, typing autosaves ("All changes saved"), Pass disables Severity. No console errors (`read_console_messages onlyErrors`).

- [ ] **Step 6: Commit**

```bash
git add tests .vercelignore js/core/workspaces.js js/core/db.js js/core/store.js js/core/config.js
git commit -m "refactor: workspace definitions and a shared store factory"
```

### Task 2: Shared card editor, navigator, workspace shell and routing

**Files:**
- Modify: `js/pages/editor.js`, `js/pages/navigator.js`, `js/pages/workspace.js` (becomes the generic shell), `js/main.js`, `js/pages/home.js`, `js/ui/shortcuts.js`, `js/services/project-file.js`, `css/app.css`
- Create: `js/pages/testcases.js`, `js/pages/enhancements.js`, `tests/project-file.test.js`

**Interfaces:**
- Consumes: `createStore`, `store`, `enhancementStore`, `TESTCASES`, `ENHANCEMENTS` (Task 1).
- Produces: `createWorkspace({ def, store, views, tabs, tools }) → { mount(root, params), update(params), ws }` in `workspace.js`. `views` maps tab key → module with `mount(root, ws) → cleanup?`; `tabs` is `[{ key, icon, label, badge?(store) → string|null }]`; `tools(ws) → Node[]` (buttons placed before "All …"). `ws = { def, store, openCase(index), routes: { create, report }, newSession() }` where routes are `#/<def.route>/create` and `#/<def.route>/<def.reportTab>`.
- Produces: `testcases` (`js/pages/testcases.js`: tabs create / upload / report, tool "Download template" → `downloadTemplate`) and `enhancements` (`js/pages/enhancements.js`: tab create now; Tasks 5 and 7 add `summary` and `upload`; tool "Download template" added in Task 7).
- Produces: `editor.mount(root, ws)`, `openNavigator(ws)`; both read everything workspace-specific from `ws.def` / `ws.store` (`itemId`, `noun`, `fields`, `groups`, `evidence`, `requiredKeys`, `maxItemsMessage`, `navFilters`, `searchText`, `subtitle`, `marker`). `clears` rules disable the cleared fields' options while the rule holds; `enterHint` fields show the `Enter` / `Ctrl+Enter` hint.
- Produces: `saveProject(store, onProgress)` writes `kind: store.def.key`; `openProject(file, def, onProgress)` treats a missing `kind` as `'testcases'` and throws `ImportError('Wrong workspace', 'This project file holds <other noun.many>. Open it from the <other title> workspace.')` on mismatch; item cap `def.maxItems`.
- `main.js`: routes `/^\/testcases(?:\/(create|upload|report))?$/` → `testcases`, `/^\/enhancements(?:\/(create|upload|summary))?$/` → `enhancements`; nav links Home · Test Cases (`#/testcases/create`) · Enhancements (`#/enhancements/create`); boot runs `store.init()` and `enhancementStore.init()` together; the save indicator listens to both stores and is visible on both workspaces.
- Home: the Enhancement card becomes an `a.option-card` to `#/enhancements/create` with the spec's bullets and "Open Enhancement Report".
- Shortcuts dialog: "Next card (adds a new one on the last card)", "Previous card", "Bookmark / un-bookmark the current card".
- CSS: navigator dots `.dot.is-critical / is-high / is-medium / is-low`; `body[data-page='enhancements']` toast offsets matching the test case rules (`create`, `summary`).

- [ ] **Step 1: Write the failing project-file tests**

```js
test('enhancement project round-trips with its kind', async () => { /* seed an ER store with 1 request + 1 pngFile screenshot, saveProject, openProject(file, ENHANCEMENTS): cases[0].title equal, images.length 1 */ });
test('openProject refuses a project of the other workspace', async () => {
  await rejects(() => openProject(tcProjectFile, ENHANCEMENTS), (e) => e.title === 'Wrong workspace' && /Test Cases/.test(e.message));
});
test('old project without kind opens in Test Cases', async () => { /* zip with manifest { app: 'iraje-qa-management', format: 1, cases: [{ title: 'x' }], images: [] } → openProject(file, TESTCASES).cases.length === 1 */ });
```

- [ ] **Step 2: Run them and see them fail**

Run: the Task 1 Step 2 command with `?only=project-file`. Expected: `FAIL`.

- [ ] **Step 3: Implement the shell, the two workspace instances, editor / navigator generalisation, routing, home, shortcuts, project-file kind and CSS**

- [ ] **Step 4: Run the tests and see them pass**

Expected: `PASS 3/3`, and `?only=store` still `PASS 8/8`.

- [ ] **Step 5: Verify both workspaces in the browser**

Using the browser pane (synthetic `ClipboardEvent('paste', { clipboardData })` and `DragEvent('drop', { dataTransfer })` with a canvas PNG for screenshots):
- Home card opens `#/enhancements/create`; card shows `ER-001`, sections Request / Details / Reference screenshots; progress "0 of 6 required fields"; Next disabled until the six are filled; Next on the last card creates `ER-002`; Ctrl+Enter / Ctrl+Shift+Enter / Ctrl+B work; Clear and Delete offer Undo; navigator lists requests with priority dots and filters; reload keeps everything.
- **Switch workspaces mid-edit:** with an enhancement card open, click "Test Cases" in the nav, paste a screenshot: it lands on the test case card only; go back: the enhancement still has its own screenshot count; exactly two `.edge-nav` buttons exist in the DOM.
- Test Cases: create, Pass disables Severity, Upload tab and Reporting tab still work; "Start a new session" in one workspace leaves the other untouched.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add js css tests
git commit -m "feat: shared card engine and the Enhancement Report workspace shell"
```

### Task 3: Report document model; renderers draw any workspace (Test Cases unchanged)

**Files:**
- Create: `js/reports/tones.js`, `js/reports/docx-brand.js`, `tests/report-model.test.js`
- Modify: `js/reports/model.js`, `js/reports/pdf-report.js`, `js/reports/docx-report.js`, `js/reports/html-report.js`, `js/pages/report.js` (`generateReport` uses the document)

**Interfaces:**
- Produces (`tones.js`): `TONES` keyed `pass, fail, blocked, none, notrun, critical, high, medium, low, blue, navy, proposed, review, approved, planned, done, rejected`, each `{ fg, bg, soft, border }` as `#RRGGBB`. Existing values are copied exactly (pass `#15803D/#E7F6EC/#FFFFFF/#EDF1F8`, fail `#D92D20/#FEECEB/#FFF8F7/#F9B6B0`, blocked `#C4560C/#FFF2E5/#FFFAF4/#F9C99A`, none `#5B6680/#EEF1F6/#FFFFFF/#EDF1F8`, notrun fg `#C9D1E0`, critical `#9F1239`, high `#D92D20`, medium `#C77700`, low `#0E7490`, blue `#0451CC`, navy `#1D2548`); new tones: proposed = none, review `#0451CC/#EAF1FF`, approved `#15803D/#E7F6EC`, planned `#6D28D9/#F3EEFF`, done `#1D2548/#EEF1F6`, rejected `#D92D20/#FEECEB`. Also `rgb(hex) → [r, g, b]`, `docxHex(hex) → 'RRGGBB'`.
- Produces (`model.js`): `buildTestCaseDocument(store, { scope = 'all', layout = 'page', now = new Date() } = {}) → ReportDocument` (shape in the spec; cells are `string | number | { text, tone, bold }`; columns `{ head, w (mm, optional), align ('right' optional), bold, tone }`; index rows `{ cells, item }`). Keeps `moduleBreakdown`, `severityBreakdown`, `pct`, `loadLogo`, `watermarkPng`, `loadShot`. `buildModel` is removed.
- Produces (`docx-brand.js`): `FONT`, `CONTENT` (twips), `brandParts(d, { title, headerLine, generatedLabel }) → Promise<{ header, footer, page }>` containing today's Word header (logo + watermark + title), footer and A4 page setup.
- Produces: `build(doc, { store, onProgress })` in all three renderers.

- [ ] **Step 1: Capture the baseline before touching renderers**

Add only the `now` option to today's `buildModel` (deterministic `generatedLabel`), then in a temporary harness test seed a TC store with the fixture set (6 cases: 2 Pass, 2 Fail with severity, 1 Blocked, 1 not run, two modules, one case with two screenshots), build PDF / DOCX / HTML for `{ scope: 'all', layout: 'page' }` and `{ scope: 'defects', layout: 'flow' }` with `now = new Date('2026-10-15T10:00:00')`, and `POST` each blob to `/__save?name=base-<scope>-<layout>.<ext>`. Keep this test as `tests/report-parity.test.js` with a `?mode=base|new` switch for the file prefix.

- [ ] **Step 2: Write the failing document tests**

```js
test('test case document summarises the run', () => {
  // fixture store from Step 1
  eq(doc.glance.hero.value, '40.0%');                     // 2 pass of 5 executed (pct keeps one decimal)
  eq(doc.glance.tiles.map((t) => t.tone), ['pass', 'fail', 'blocked', 'none']);
  eq(doc.summary.tables.map((t) => t.title), ['Module-wise progress', 'Open issues by severity (Fail + Blocked)']);
  eq(doc.index.rows.length, 6);
  eq(doc.items[0].sections.map((s) => s.type), ['block', 'compare']);  // fixture case 1 has no preconditions, data or comments
  eq(doc.items[0].factsPerRow, 3);
  eq(doc.signoff, null);
});
test('defects scope keeps Fail and Blocked only', () => { /* doc.items.length 3; meta row 'Test Cases in Report' === '3 of 6' */ });
```

- [ ] **Step 3: Run them and see them fail**

Run: `?only=report-model`. Expected: `FAIL` (`buildTestCaseDocument` missing).

- [ ] **Step 4: Implement `tones.js`, `buildTestCaseDocument`, `docx-brand.js` and port the three renderers to the document**

Keep every drawing routine and measurement; replace only the data source (stats → `glance` / `summary`, hard-coded tables → `summary.tables` and `index`, the per-case body → `items[].facts / sections / images`). Renderers already handle `factsPerRow`, `half` tables and `signoff: null` generically; sign-off drawing itself is Task 4.

- [ ] **Step 5: Run the document tests**

Expected: `PASS 2/2`.

- [ ] **Step 6: Prove the test report is unchanged**

Run `report-parity` with `?mode=new`, then:
- PDF: `node $DEV/render.mjs $DEV/out/base-all-page.pdf $DEV/out/cmp/base all 1` and the same for `new-…`, then a small Node pixel compare (same `@napi-rs/canvas` from `$DEV/vend/node_modules`) per page. Expected: same page count, every page identical (or < 0.05 % differing pixels from anti-aliasing).
- HTML: both files equal after collapsing whitespace.
- DOCX: export both to PDF through Word COM (`$w = New-Object -ComObject Word.Application; $d = $w.Documents.Open($in, $false, $true); $d.ExportAsFixedFormat($out, 17); $d.Close($false); $w.Quit()`), render and compare as for PDF. Expected: identical pages.
Repeat for `defects-flow`.

- [ ] **Step 7: Commit**

```bash
git add js tests
git commit -m "refactor: reports draw a neutral report document"
```

### Task 4: Enhancement report document and sign-off

**Files:**
- Create: `js/reports/enhancement-model.js`, `tests/enhancement-report.test.js`
- Modify: `js/reports/pdf-report.js`, `js/reports/docx-report.js`, `js/reports/html-report.js` (sign-off block; tone lookups for the new tones; 4-column facts)

**Interfaces:**
- Consumes: `ReportDocument` shape and renderers (Task 3), `ENHANCEMENTS`, `PRIORITY`, `ENH_STATUS`, `PROPOSED` (Task 1).
- Produces: `statusLabel(status) → status || 'Proposed'`; `priorityStatusMatrix(items) → [{ name, counts: { Proposed, 'Under review', Approved, Planned, Done, Rejected }, total }]` (rows Critical, High, Medium, Low, plus `Not set` only when used); `groupBreakdown(items, key, emptyLabel) → [{ name, total, critical, high, medium, low }]` sorted by total desc; `ENH_SCOPES = [{ key: 'all', label: 'All requests' }, { key: 'high', label: 'Critical + High only' }, { key: 'approved', label: 'Approved + Planned only' }]`; `buildEnhancementDocument(store, { scope = 'all', layout = 'page', now = new Date() } = {}) → ReportDocument`.
- Document content per the spec "Reports" section: eyebrow / subtitle by scope (`Enhancement report`, `High-priority enhancements · Critical and High`, `Approved and planned enhancements`); default title `<Product> Enhancement Report`; meta Product, Version / Release, Prepared By, Reviewed By, Approved By, Report Date, Requests in Report (`n of N` when scoped); glance label `Priorities at a glance`, hero `Critical + High`; summary over **all** requests, KPIs Total / Critical / High / Medium / Low / Approved + Planned, bar label `Priority split`, tables `Priority × status` (full width), `By module` and `By category` (`half: true`); index columns ID, Title, Module, Priority, Status, Shots; item badge = priority (`No priority` when blank, tone `none`), accent = priority tone, facts Module / Category / Priority / Status (`factsPerRow: 4`), sections compare(Current behaviour | Proposed improvement, tone `blue`), block Business value, block Acceptance criteria when filled; `evidenceLabel 'Reference screenshots'`; filters All / Critical / High / Medium / Low; `searchPlaceholder 'Search requests…'`; `signoff { title: 'Review & sign-off', rows: [{ role: 'Prepared by', name }, { role: 'Reviewed by', name }, { role: 'Approved by', name }] }` with names from the details ('' when blank).
- Renderers draw `signoff` (when not null) as the last section: PDF and DOCX a 4-column table Role | Name | Signature | Date with tall empty Signature / Date cells; HTML the same as a table kept on one printed page.

- [ ] **Step 1: Write the failing tests**

```js
test('matrix counts a blank status as Proposed', () => { eq(priorityStatusMatrix([{ priority: 'High', status: '' }])[1].counts.Proposed, 1); });
test('scopes filter the requests but not the summary', () => {
  // 5 requests: Critical/Approved, High/'', Medium/Planned, Low/Rejected, Low/Done
  eq(buildEnhancementDocument(s, { scope: 'high' }).items.length, 2);
  eq(buildEnhancementDocument(s, { scope: 'approved' }).items.map((i) => i.title), ['A', 'C']);
  eq(buildEnhancementDocument(s, { scope: 'approved' }).summary.kpis[0].value, 5);
  eq(buildEnhancementDocument(s, { scope: 'approved' }).meta.find(([k]) => k === 'Requests in Report')[1], '2 of 5');
});
test('sign-off names come from the details', () => { /* setReport preparedBy 'Asha', approvedBy 'Ravi' → rows names ['Asha', '', 'Ravi'] */ });
test('HTML report escapes request text', async () => {
  // title '<img src=x onerror=alert(1)>', proposed '<script>x()</script>'
  ok(html.includes('&lt;img src=x onerror=alert(1)&gt;')); ok(!html.includes('<img src=x')); ok(!html.includes('<script>x()'));
});
test('PDF report survives emoji and long text', async () => { /* current: '🚀 faster ✅ ' + 'x'.repeat(5000) → blob.type 'application/pdf', size > 10 kB */ });
test('DOCX report contains the sign-off table', async () => { /* unzip word/document.xml: includes 'Review &amp; sign-off', 'Approved by', 'Ravi' */ });
```

- [ ] **Step 2: Run them and see them fail**

Run: `?only=enhancement-report`. Expected: `FAIL`.

- [ ] **Step 3: Implement `enhancement-model.js` and the renderer additions**

- [ ] **Step 4: Run the tests and see them pass**

Expected: `PASS 6/6`; `?only=report-model` still passes; re-run the Task 3 parity check (Test Cases output still identical).

- [ ] **Step 5: Look at the output**

Save each format for both layouts (`/__save`), render the PDF pages to PNG, export the DOCX to PDF via Word COM and render, print the HTML with headless Edge (`--print-to-pdf`). Check: logo and watermark on every page; cover tiles; matrix; index links jump to requests; compare boxes side by side; screenshots full width; sign-off last and not split; long text wraps.

- [ ] **Step 6: Commit**

```bash
git add js tests
git commit -m "feat: enhancement report document with priority matrix and sign-off"
```

### Task 5: Summary tab and report dialog

**Files:**
- Create: `js/pages/enhancement-summary.js`
- Modify: `js/pages/enhancements.js` (add tab `summary`, icon `chart`, label `Summary`), `css/app.css`

**Interfaces:**
- Consumes: `ws` (Task 2), `priorityStatusMatrix`, `groupBreakdown`, `ENH_SCOPES`, `statusLabel`, `buildEnhancementDocument` (Task 4), renderers' `build`.
- Produces: `mount(root, ws) → cleanup` (default export style of the other views).
- Layout per spec "Summary tab": empty state when no request has content ("Nothing to summarise yet", buttons "Create requests" / "Upload a Word file"); details panel bound to `ws.store.setReport`; KPIs; priority split bar + legend; matrix table; module and category tables side by side (`div.two-col`); request list (40 per page with the same IntersectionObserver "Show more" as Test Cases, search, filters All / Critical / High / Medium / Low / Incomplete, badges for priority (`sev.is-*`) and status (`status-badge.is-review|approved|planned|done|rejected|proposed`), blocks Current behaviour / Proposed improvement (side by side) / Business value / Acceptance criteria, screenshots with lightbox, Edit → `ws.openCase(i)`); action bar `n requests · n screenshots · n Critical + High` + **Next**.
- Report dialog: same `format-grid` cards (PDF / Word (DOCX) / HTML), selects *Include* (`ENH_SCOPES` with counts) and *Layout (PDF & Word)*; remembers the last choice; empty scope → warning toast `There are no requests in this selection.`; file name `<safeFileName(title, 'Enhancement_Report')>_<todayISO()>.<ext>`.
- CSS: the five status badge tones; segmented control wraps neatly for five Status options at ≤ 560 px.

- [ ] **Step 1: Build the tab**

- [ ] **Step 2: Verify in the browser**

With 5 seeded requests: numbers in KPIs, matrix, module and category tables match `?only=enhancement-report` fixture counts; search and each filter narrow the list; Edit opens the right card; details persist after reload; Next → each format downloads (check via `read_console_messages` no errors and the toast "Report ready"); "Approved + Planned only" with none approved shows the warning toast; layout at 375 px wide has no horizontal scroll (`resize_window preset mobile`).

- [ ] **Step 3: Commit**

```bash
git add js css
git commit -m "feat: Enhancement Report summary tab and report dialog"
```

### Task 6: Word template service

**Files:**
- Create: `js/services/enhancement-template.js`, `tests/enhancement-template.test.js`

**Interfaces:**
- Consumes: `brandParts`, `FONT`, `CONTENT` (Task 3), `getDocx`, `getJSZip`, `processImageFiles`, `ImportError`, `ENHANCEMENTS.maxUploadItems / maxUploadBytes`, `APP.maxImagesPerCase`, `APP.maxImageBytes`.
- Produces: `TEMPLATE_FILE_NAME = 'Iraje_Enhancement_Template.docx'`; `labelKind(text) → 'title' | 'description' | 'screenshot' | null` (first paragraph of the label cell, lower-cased, non-letters removed, so `Title:` → `title`; accepts `title`, `enhancementtitle`, `description`, `referencescreenshot(s)`, `screenshot(s)`); `buildTemplate({ blocks = 5 } = {}) → Promise<Blob>`; `parseTemplate(file, { onStep } = {}) → Promise<{ items: { title, current, images: string[] }[], images: ImageRecord[], found, truncated, skipped, rejected: { name, reason }[] }>` (`items[].images` are ids of `images` records, ready for `store.loadCases(items, images, { mode })`).
- Template content: branded header / footer / watermark; heading "Enhancement requests"; intro and 4 how-to lines (one block per request; copy a block for more; paste screenshots as pictures into *Reference screenshot*; upload in Iraje QA Management → Enhancement Report → Upload); blocks "Enhancement 1…5", each a 2-column table: label column 2,600 twips with soft fill, label text plus a grey hint line (`One-line summary`, `What happens today and what should change`, `Paste one or more screenshots`), value cells empty, rows at least 600 / 2,400 / 4,000 twips high. Core properties title `Iraje Enhancement Template`, creator `Iraje QA Management`.
- Parse rules: `.docx` only (`.doc` / `.docm` → `ImportError('Unsupported file', '… save it as .docx …')`); > 50 MB → `File too large`; not `PK\x03\x04` → `Damaged file`; > 5,000 entries, `word/document.xml` > 40 MB uncompressed or total > 300 MB → `File rejected`; top-level `w:tbl` only, rows in order, a `title` row starts a block, rows before any title start one; text from `w:t`, `w:tab` → space, `w:br` / `w:cr` → newline, paragraphs joined with newlines, list paragraphs (`w:numPr`) prefixed `• `; images from `a:blip/@r:embed` and `v:imagedata/@r:id` in value cells, resolved through `word/_rels/document.xml.rels` inside the package, `TargetMode="External"` skipped, `.emf` / `.wmf` rejected with `Word drawing (EMF/WMF) is not supported; paste the screenshot as a picture`, media entries larger than `APP.maxImageBytes` rejected without inflating, max 20 per block (extras rejected); empty blocks counted in `skipped`; no label rows at all → `ImportError('Not an enhancement template', …download the template from this page…)`; labels but nothing filled → `ImportError('Template is empty', …)`; more than 200 filled blocks → first 200, `truncated = found - 200`.

- [ ] **Step 1: Write the failing tests**

Filled documents are built inside the tests with the vendored `docx` library (tables with `ImageRun` from `pngFile`).

```js
test('labelKind recognises the template labels', () => {
  eq(['Title', 'Title:', 'Enhancement title', 'DESCRIPTION', 'Reference screenshots', 'Screenshot', 'Notes'].map(labelKind),
    ['title', 'title', 'title', 'description', 'screenshot', 'screenshot', null]);
});
test('a blank template is reported as empty', async () => { await rejects(() => parseTemplate(asFile(await buildTemplate())), (e) => e.title === 'Template is empty'); });
test('filled blocks become requests with screenshots', async () => {
  // table 1: Title 'Faster login' / Description 'Line 1\nLine 2' (two paragraphs) / Reference screenshot <png>
  // table 2: Title 'Export to CSV' / Description '' / Reference screenshot ''
  eq(r.items.map((i) => i.title), ['Faster login', 'Export to CSV']);
  eq(r.items[0].current, 'Line 1\nLine 2'); eq(r.items[0].images.length, 1); eq(r.images.length, 1);
});
test('many requests in one table and bullet lists', async () => { /* one table, rows Title/Description repeated 3 times, a bulleted description → 3 items, current starts with '• ' */ });
test('tolerates edited labels, hints, merged cells and nested tables', async () => {
  // label cell 'Title:' + hint paragraph; a row with 3 cells (value split over two); an empty row between blocks; a nested table inside a Description cell
  eq(r.items.length, 2); eq(r.items[0].title, 'Faster login');
});
test('external images are ignored', async () => { /* rewrite the image relationship to TargetMode="External" Target="https://example.com/x.png" with JSZip → images.length 0, no network request (check performance.getEntriesByType('resource') has no example.com) */ });
test('unsafe or wrong files are refused', async () => {
  await rejects(() => parseTemplate(new File(['x'], 'a.doc')), (e) => e.title === 'Unsupported file');
  await rejects(() => parseTemplate(new File(['not a zip'], 'a.docx')), (e) => e.title === 'Damaged file');
  await rejects(() => parseTemplate(new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'a.docx')), (e) => e.title === 'File too large');
  await rejects(() => parseTemplate(asFile(docWithoutTables)), (e) => e.title === 'Not an enhancement template');
});
test('more than 200 blocks are truncated', async () => { /* 201 filled blocks → items.length 200, truncated 1 */ });
```

- [ ] **Step 2: Run them and see them fail**

Run: `?only=enhancement-template`. Expected: `FAIL`.

- [ ] **Step 3: Implement `enhancement-template.js`**

- [ ] **Step 4: Run the tests and see them pass**

Expected: `PASS 8/8`.

- [ ] **Step 5: Check the template in Word**

Save `buildTemplate()` via `/__save`, open it with Word COM, export to PDF and render: logo, watermark, how-to, five blocks with hints; a block table copies and pastes as a block.

- [ ] **Step 6: Commit**

```bash
git add js/services/enhancement-template.js tests
git commit -m "feat: Word enhancement template download and import"
```

### Task 7: Upload tab

**Files:**
- Create: `js/pages/enhancement-upload.js`
- Modify: `js/pages/enhancements.js` (tab `upload` between Create and Summary; tool button "Download template" → template download), `css/app.css` only if needed

**Interfaces:**
- Consumes: `buildTemplate`, `parseTemplate`, `TEMPLATE_FILE_NAME` (Task 6), `ws` (Task 2), `saveBlob`, upload page classes from `upload.js` (`upload-wrap`, `upload-card`, `upload-drop`, `upload-rules`, `result`, `steps`).
- Produces: `mount(root, ws) → cleanup`; `downloadEnhancementTemplate() → Promise<void>` exported for the toolbar.
- Copy: drop title "Drop your filled enhancement template here"; text "or browse for it. Each Title / Description / Reference screenshot block becomes an enhancement card."; format chip `.docx`; buttons Browse file / Download template; rules "Word template only", "Up to 200 per upload", "Checked in your browser" (Max 50 MB …); steps: Checking file type, size and signature · Reading the document safely · Finding enhancement blocks · Extracting reference screenshots; result "n requests imported" with screenshot count, warnings (truncated, rejected images, session cap `A session holds up to 500 enhancement requests.`) and the reminder "Module, Proposed improvement, Business value and Priority still need filling on each card."; Replace / Add after mine modal as in Test Cases; "Open n requests" → `ws.openCase(first)`.

- [ ] **Step 1: Build the tab**

- [ ] **Step 2: Round-trip the real template through Word**

Download the template from the tab (save via `/__save`), fill it with Word COM (two blocks: titles, a two-line description, `InlineShapes.AddPicture` of a PNG into the first *Reference screenshot* cell), save as `filled.docx`; in the browser pane fetch `/__out/filled.docx` and dispatch it as a `drop` on the Upload tab. Expected: result "2 requests imported · 1 screenshot", cards `ER-001` / `ER-002` with Description in *Current behaviour*, the screenshot on `ER-001`, Next blocked until Module / Proposed improvement / Business value / Priority are filled; Add after mine appends; dropping a `.xlsx` shows "Unsupported file"; no console errors.

- [ ] **Step 3: Commit**

```bash
git add js css
git commit -m "feat: Enhancement Report upload tab for the Word template"
```

### Task 8: Docs, full regression and push

**Files:**
- Modify: `README.md` (Home row, an "Enhancement Report" section: card, Word template, Summary, reports, limits; structure lines for the new files; security bullet for Word uploads), `docs/DESIGN.md` (decision rows for Enhancement Report, limits rows, architecture lines for workspaces / report document, "Next iteration" without the enhancement line)

- [ ] **Step 1: Update the docs**

- [ ] **Step 2: Run every test file**

Run: the Task 1 Step 2 command without `?only`. Expected: `PASS` with every test counted (8 + 3 + 2 + 6 + 8 = 27, plus parity).

- [ ] **Step 3: Full browser regression**

Test Cases: create 3 cards with screenshots, upload `assets/IrajeTestcaseTemplate.xlsx`-shaped sheet (the one in `$DEV/out/TestSheet.xlsx`), Download TestSheet, all three reports, save and reopen a project file, new session. Enhancements: the Task 5 and Task 7 checks once more, project file save / open, opening the test case project there is refused. Both at 375 px width. No console errors.

- [ ] **Step 4: Commit and push**

```bash
git add README.md docs/DESIGN.md
git commit -m "docs: Enhancement Report"
git push -u origin feature/enhancement-report
```
Expected: branch on GitHub (Vercel preview build); `main` and `redesign/iraje-qa-management` untouched.
