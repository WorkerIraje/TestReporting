# Iraje QA Management: design notes

Status: implemented (rebuild of the TestReporting site, October 2026; Enhancement Report added 15 October 2026).

## Goal

Let a tester author or import test cases, attach screenshot evidence quickly, and produce professional
reports, with minimal friction, on any screen size, without any data leaving the browser. The Enhancement
Report workspace does the same for improvement requests.

## Decisions agreed with the owner

| Topic | Decision |
| --- | --- |
| Theme | iraje.com: white surfaces, Iraje blue `#0451CC`, navy `#1D2548`, Poppins, 40 px rounded cards with a blue base line, round icon chips, pill buttons. |
| Title / branding | Iraje logo top-left, title "Iraje QA Management"; credit line on the welcome page. |
| Template | `assets/IrajeTestcaseTemplate.xlsx` is the single source of truth: field list, dropdown lists (read at runtime from the Summary sheet), import validation and the TestSheet export. |
| Required fields | Title / Description, Module / Feature, Field / Control, Test Steps, Expected Result, Actual Result, Status. |
| Keyboard | `Enter` = new line inside a field; `Ctrl+Enter` = next card; `Ctrl+Shift+Enter` = previous card; `Tab` / `Shift+Tab` = field traversal; `Ctrl+B` = bookmark. |
| Upload limit | 600 test cases per upload: the first 600 are imported with a warning; more can be added with Next or a second upload (append), up to the template's 1,500-row capacity. |
| Extras | Autosave and resume (IndexedDB), test case navigator (search / filter / drag reorder), "defects only" report scope, shareable `.iqa` project file. |
| Delivery | Pushed to a feature branch first so Vercel builds a preview; production updates only when merged to `main`. |
| Enhancement Report | Second workspace on the same card engine (spec: `docs/superpowers/specs/2026-10-15-enhancement-report-design.md`). Required: Title, Module / Feature, Priority, Current behaviour, Proposed improvement, Business value; optional: Category, Status (blank = Proposed), Acceptance criteria. No effort field. |
| Enhancement priority | Critical / High / Medium / Low, same words and colours as Severity. |
| Enhancement template | A Word (DOCX) template, not Excel: blocks of Title, Description, Reference screenshot; Description maps to Current behaviour. |
| Enhancement reports | PDF / DOCX / HTML with scope (all, Critical + High, Approved + Planned), layout, priority × status matrix and a Review & sign-off block. |
| Navigation | Header: Home · Test Cases · Enhancements; each workspace keeps its reporting view as a tab. |

## Architecture

* **Static site, no build step:** ES modules plus vendored UMD libraries loaded on demand. Vercel deploys
  the repository as-is.
* **Workspaces:** `js/core/workspaces.js` describes Test Cases and the Enhancement Report (fields, groups,
  wording, limits, statistics, navigator filters). The store, card editor, navigator and workspace shell are
  shared and read their behaviour from these definitions.
* **State:** `js/core/store.js` (`createStore(definition)`) holds the ordered cards, the current position
  and report details, emits events, and debounces writes to IndexedDB (`cases`, `images`, `kv` stores).
  Each workspace has its own database (`iraje-qa-management`, `iraje-qa-enhancements`). Screenshots are
  stored as Blobs with a pre-rendered thumbnail; only the visible card is rendered, so 1,000+ cases stay
  instant.
* **Template I/O:** import uses SheetJS in a Web Worker; export edits the template's XML with JSZip and
  DOMParser, writing inline strings and forcing a full recalculation on open.
* **Reports:** each workspace builds a neutral report document (`js/reports/model.js`,
  `js/reports/enhancement-model.js`: cover, summary, index, items, sign-off, colours named by shared tones)
  that three renderers draw: jsPDF (+ AutoTable) for PDF, `docx` for Word, and a self-contained HTML
  document.
* **Word template:** `js/services/enhancement-template.js` builds the branded template with `docx` and
  reads a filled one back with JSZip + `DOMParser`.

## Limits

| Limit | Value |
| --- | --- |
| Test cases per session | 1,500 (template rows 7–1506) |
| Test cases per upload | 600 |
| Upload size | 10 MB |
| Screenshots per test case | 20 |
| Screenshot size | 15 MB, 40 megapixels |
| Project file | 512 MB |
| Enhancement requests per session | 500 |
| Enhancement blocks per Word upload | 200 |
| Word upload size | 50 MB |

## Next iteration (proposed)

* Optional screenshot annotation (arrows, boxes, blur for sensitive data) before it is attached.
