# Enhancement Report workspace: design

Status: approved in conversation with the owner on 2026-10-15; awaiting review of this written spec.
Branch: `feature/enhancement-report` (from `redesign/iraje-qa-management`), pushed, not merged.

## Goal

Let a tester (or anyone, via a Word template) turn every "it would be better if…" into a clear, prioritised
enhancement request with reference screenshots, and hand the team a branded PDF, Word or HTML report,
with the same speed, privacy and polish as the Test Cases workspace.

## Decisions agreed with the owner

| Topic | Decision |
| --- | --- |
| Shape | One report holds many enhancement requests, one card each (`ER-001`, `ER-002`…). |
| Session | Separate from Test Cases: own autosave database, own "new session", own project file kind. |
| Required fields | Title, Module / Feature, Current behaviour, Proposed improvement, Business value, Priority. |
| Optional fields | Category, Acceptance criteria, Status. No effort field. |
| Priority scale | Critical / High / Medium / Low, same words and colours as Severity in Test Cases. |
| Status | Under review / Approved / Planned / Done / Rejected; blank is shown as **Proposed**. |
| Template | A Word (DOCX) template, not Excel: minimal blocks of Title, Description, Reference screenshot. Download it, fill it in Word, upload it back; each block becomes a card. |
| Template mapping | Title → Title, Description → Current behaviour, images → reference screenshots. Missing required fields are completed on the card. |
| Report options | Scope filter, layout choice, priority matrix, sign-off block. |
| Approach | Shared, schema-driven engines (store, card editor, navigator, workspace shell, report renderers) used by both workspaces. |
| Navigation | Header nav becomes Home · Test Cases · Enhancements; each workspace keeps its reporting view as a tab. |

## User-facing behaviour

### Home

The Enhancement Report card is enabled and opens `#/enhancements/create`. Bullets: describe the gap, the
proposed improvement and its value; back it with reference screenshots; export PDF, Word or HTML, or import
the Word template.

### Workspace `#/enhancements/(create|upload|summary)`

Head: title "Enhancement Report", session subtitle, tabs **Create · Upload · Summary**, tools
**Download template** (DOCX), **All requests** (navigator), **Bookmarks**, **More** (save / open project file,
start a new session).

### The enhancement card

| Section | Field | Kind | Required |
| --- | --- | --- | --- |
| 1 Request | Title | textarea (2 rows, wide) | yes |
| | Module / Feature | combo (suggests values used in this session) | yes |
| | Category | combo: Functionality, UI / UX, Usability, Performance, Security, Accessibility, Reporting, Integration, Compliance | |
| | Priority | segment: Critical, High, Medium, Low | yes |
| | Status | segment: Under review, Approved, Planned, Done, Rejected (blank = Proposed) | |
| 2 Details | Current behaviour | textarea (wide) | yes |
| | Proposed improvement | textarea (wide) | yes |
| | Business value | textarea (wide), "Who benefits and how" | yes |
| | Acceptance criteria | textarea (wide) | |
| 3 Reference screenshots | paste / drop / browse, reorder, zoom; 20 per request | | |

Behaviour is identical to the test case card: progress bar of required fields, Next unlocks when complete
(and creates a new card on the last one), Prev, Clear / Delete with Undo, counter with jump, first / last edge
buttons, bookmarks, `Ctrl+Enter` / `Ctrl+Shift+Enter` / `Ctrl+B` / `Ctrl+V`, Finish (prunes empty cards,
offers to fix incomplete ones, then opens Summary).

Navigator ("All requests"): search, filters All / Critical / High / Medium / Low / Incomplete / Bookmarked,
drag or `Alt+↑/↓` to reorder.

### Upload tab (Word template)

* **Download template** builds `Iraje_Enhancement_Template.docx` in the browser: Iraje logo header and
  "Iraje Software" watermark, a short how-to, then 5 blank blocks. Each block is a 2-column table with rows
  **Title**, **Description**, **Reference screenshot** (the label cell also carries a small grey hint; the
  value cells are empty so nothing has to be deleted). More blocks: copy and paste a block.
* **Upload**: drop or browse a `.docx`. Rows are read in order; every row labelled *Title* starts a new
  block, so both "one table per request" and "many requests in one table" work. Recognised labels
  (case and punctuation insensitive): `Title` / `Enhancement title`; `Description`; `Reference screenshot(s)` /
  `Screenshot(s)`. Text keeps line breaks; list paragraphs become `• ` lines. Every image inside a block is
  imported (up to 20), in document order. Blocks with no text and no image are skipped.
* Existing requests → modal: Cancel / Add after mine / Replace mine (same as project files).
* Result panel: how many requests were imported, how many screenshots, files skipped (with reasons), and a
  reminder that Module, Proposed improvement, Business value and Priority still need filling.

### Summary tab

1. **Report details**: Report title, Product, Version / Release, Prepared by, Reviewed by, Approved by,
   Report date.
2. **Overview** KPIs: Total, Critical, High, Medium, Low, Approved + Planned; a priority split bar with legend.
3. **Priority × status matrix**: rows Critical…Low, columns Proposed, Under review, Approved, Planned,
   Done, Rejected, Total.
4. **By module** (Total, Critical, High, Medium, Low) and **by category** (same columns).
5. **Request list**: search, filters All / Critical / High / Medium / Low / Incomplete, each request with
   badges, fields, screenshots (zoom), Edit.
6. **Action bar**: counts and **Next** → report dialog.

Report dialog: format PDF / Word (DOCX) / HTML; *Include*: All requests · Critical + High only ·
Approved + Planned only; *Layout (PDF & Word)*: one request per page · continuous.

### Reports (PDF, DOCX, HTML)

Same frame as the test report: small Iraje logo header and faint "Iraje Software" watermark on every page,
footer with app name, generation time and page numbers.

1. **Cover**: eyebrow ("Enhancement report"), title, product line, details boxes (Product, Version / Release,
   Prepared by, Reviewed by, Approved by, Report date, Requests in report), "Priorities at a glance": a
   hero tile (Critical + High count) and tiles Critical / High / Medium / Low with a priority split bar
   (HTML: donut).
2. **Executive summary**: KPI row, priority split bar, priority × status matrix, by-module and by-category
   tables.
3. **Request index**: ID (links to the request), Title, Module, Priority, Status, Shots.
4. **Each request**: title band (ID, title, priority badge, priority-coloured accent), facts (Module,
   Category, Priority, Status), **Current behaviour vs Proposed improvement** side by side, Business value,
   Acceptance criteria (when filled), reference screenshots full width with captions.
5. **Review & sign-off**: rows Prepared by / Reviewed by / Approved by with the names from the details and
   empty Signature and Date boxes.

HTML extras: search, priority filter chips, image zoom, print button, print-ready pages.

## Architecture

### Workspace definitions (`js/core/workspaces.js`, new)

Two plain objects, `TESTCASES` and `ENHANCEMENTS`, each describing one workspace:

* identity: `key` (`testcases` / `enhancements`), `route`, `title`, `idPrefix` (`TC` / `ER`) and `itemId(i)`,
  item id prefix for `uid()` (`tc` / `er`), `noun` (`{ one, many, One, Many }`), `dbName`;
* schema: `fields`, `groups`, `evidence` (section title + hint), `reportFields`, derived `fieldKeys`,
  `requiredKeys`, `fieldByKey`;
* limits: `maxItems`, `maxItemsMessage`;
* lists: default dropdown lists and the keys that also suggest values already used in the session;
* behaviour hooks: `stats(items)`, `searchText(item)`, `subtitle(item)` (navigator and bookmarks second line),
  `marker(item)` (navigator dot: class + title), `navFilters`.

Test case fields keep living in `config.js` (the importer and TestSheet depend on them); `TESTCASES` wraps them.

Cross-field rules are declarative: the test case Status field gets
`clears: { when: 'Pass', fields: ['severity'] }`. The store applies it on `setField` and `normalize`; the editor
disables the cleared fields' options while the rule holds. This replaces the hard-coded Pass / Severity checks.
A field may set `enterHint: true` to show the `Enter` / `Ctrl+Enter` hint (test case Steps).

### Storage

* `db.js` → `createDb(name)`; the existing `db` export stays (`iraje-qa-management`). Enhancements use their
  own database `iraje-qa-enhancements`, so existing saved test cases need no migration and image clean-up in
  one workspace can never delete the other's screenshots.
* `store.js` → `createStore(workspace)`. Same public API as today plus `isComplete`, `missingFields`,
  `hasContent`, `schema` on the instance. `store` (test cases) and `enhancementStore` are exported; the old
  named helpers (`isComplete`, `missingFields`, `hasContent`, `normalizeCase`, `blankCase`) keep working for
  the test-case-only modules. Segment / select fields with fixed `options` are normalised generically
  (case-insensitive match, existing aliases kept). Both stores initialise at boot.
* Header save indicator listens to both stores and is shown on both workspaces.

### Shared pages

* `editor.js`, `navigator.js` and the workspace shell take the workspace context `ws`
  (`{ def, store, openCase, routes }`) instead of importing the test case store and fields.
* `workspace.js` → `createWorkspace(def, views, options)` returning `{ mount, update }`; the Test Cases and
  Enhancements workspaces are two instances. Project file actions pass the store; the manifest records `kind`.
* `main.js` routes `#/enhancements/(create|upload|summary)`; nav shows Home · Test Cases · Enhancements.
* Keyboard shortcut dialog wording becomes workspace-neutral ("next card").

### Enhancement pages (new)

* `js/pages/enhancement-upload.js`: Word template download + `.docx` upload UI.
* `js/pages/enhancement-summary.js`: Summary tab and report dialog.

### Word template (`js/services/enhancement-template.js`, new)

* `buildTemplate()` → Blob, built with the vendored `docx` library and the shared branded header / footer.
* `parseTemplate(file)` → `{ items, images, rejected, skippedBlocks }` using JSZip + `DOMParser` on
  `word/document.xml` and `word/_rels/document.xml.rels`; images found through `a:blip r:embed` and
  `v:imagedata r:id`; external (linked) images are ignored, never fetched.

### Reports

The shared model becomes a neutral **report document** that the three renderers draw, so both workspaces get
exactly the same frame and styling:

```
{ title, subtitle, eyebrow, headerLine, author, keywords, appName, generatedLabel, layout,
  meta: [[label, value]],
  glance: { label, hero: { label, value, sub }, tiles: [{ label, value, sub, tone }], bar: [{ label, value, tone }] },
  summary: { title, kpis: [{ label, value, tone }], barLabel, tables: [{ title, cols, rows, half }] },
  index: { title, cols, rows },                       // first column links to the item
  items: [{ id, title, badge: { text, tone }, accent, facts, factsPerRow, sections, images,
            evidenceLabel, filterKey, searchText }],
  sections: block { title, text } | compare { left: { title, text }, right: { title, text }, tone },
  filters: [{ key, label }], searchPlaceholder, noun,
  signoff: { title, rows: [{ role, name }] } | null }
```

* `tone` is a key into one shared palette (pass, fail, blocked, none, critical, high, medium, low, blue, navy,
  review, approved, planned, done, rejected, proposed); each renderer maps it to its own colour format.
* `pdf-report.js`, `docx-report.js`, `html-report.js` render any report document. Their drawing code is kept;
  only the data source changes. The test report must look the same as before.
* `model.js` builds the test case document (`buildTestCaseDocument`) and keeps the shared assets (logo,
  watermark, screenshots, `pct`). `enhancement-model.js` (new) builds the enhancement document and the
  breakdowns the Summary tab also uses.
* The branded DOCX header / footer moves to a small helper shared by the Word renderer and the template.

## Limits

| Limit | Value |
| --- | --- |
| Requests per session | 500 |
| Requests per Word upload | 200 (first 200 imported, with a warning) |
| Word upload size | 50 MB |
| Screenshots per request | 20 |
| Screenshot size | 15 MB, 40 megapixels (shared with Test Cases) |

## Security

* User text only through `textContent`; HTML report values escaped (renderer unchanged).
* Word upload: `.docx` extension only (`.doc` / `.docm` refused with "save as .docx"), size cap, ZIP signature
  (`PK\x03\x04`), entry-count cap, per-entry and total uncompressed size caps checked before inflating, XML
  parsed with `DOMParser` (no external entity resolution), relationship targets resolved inside the package
  only, `TargetMode="External"` ignored, every image through the existing signature / dimension checks.
* Project files carry `kind`; a file of the other kind is refused with a clear message.
* No new third-party code; CSP unchanged.

## Testing

* Browser (built-in pane, local static server): Home card, enhancement card (required fields, Next, Prev,
  Clear / Delete Undo, bookmarks, navigator filters / reorder, paste / drop / browse screenshots, autosave
  after reload), Upload (template download, round trip with text + a pasted image, append / replace,
  rejection of a non-template file), Summary (details, matrix, filters, Edit), all three reports with each
  scope and layout.
* Output checks: PDF rendered to PNG with pdf.js, DOCX opened in Word via COM (and the template round trip),
  HTML printed with headless Edge.
* Regression: Test Cases create, upload, TestSheet, all three reports, project file save / open, new session;
  both workspaces keep separate sessions.

## Out of scope

Excel template for enhancements, effort estimation, Requested by / Reference fields, screenshot annotation,
merging both workspaces into one report.
