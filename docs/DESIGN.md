# Iraje QA Management: design notes

Status: implemented (rebuild of the TestReporting site, October 2026).

## Goal

Let a tester author or import test cases, attach screenshot evidence quickly, and produce professional
reports, with minimal friction, on any screen size, without any data leaving the browser.

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
| Enhancement Report | Shown greyed out as "Coming soon"; planned for the next iteration. |

## Architecture

* **Static site, no build step:** ES modules plus vendored UMD libraries loaded on demand. Vercel deploys
  the repository as-is.
* **State:** `js/core/store.js` holds the ordered test cases, the current position and report details,
  emits events, and debounces writes to IndexedDB (`cases`, `images`, `kv` stores). Screenshots are stored
  as Blobs with a pre-rendered thumbnail; only the visible card is rendered, so 1,000+ cases stay instant.
* **Template I/O:** import uses SheetJS in a Web Worker; export edits the template's XML with JSZip and
  DOMParser, writing inline strings and forcing a full recalculation on open.
* **Reports:** one shared model (`js/reports/model.js`) feeds three generators: jsPDF (+ AutoTable) for
  PDF, `docx` for Word, and a self-contained HTML document.

## Limits

| Limit | Value |
| --- | --- |
| Test cases per session | 1,500 (template rows 7–1506) |
| Test cases per upload | 600 |
| Upload size | 10 MB |
| Screenshots per test case | 20 |
| Screenshot size | 15 MB, 40 megapixels |
| Project file | 512 MB |

## Next iteration (proposed)

* Enhancement Report workspace (same card engine, enhancement-specific fields and report).
* Optional screenshot annotation (arrows, boxes, blur for sensitive data) before it is attached.
