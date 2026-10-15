# Iraje QA Management

Write test cases card by card or import your existing sheet, attach the screenshots that prove each
result, and turn a full test cycle into a polished, audit-ready report: the filled Excel **TestSheet**,
plus **PDF**, **Word (DOCX)** and **HTML** reports, all branded with the Iraje logo and a
"Iraje Software" watermark on every page. The **Enhancement Report** workspace does the same for
improvement requests: describe the gap and the proposed improvement, back it with reference
screenshots, prioritise it and hand the team a branded report with a review and sign-off block.

Everything runs in the browser. Test cases and screenshots never leave the tester's machine.

## Using it

| Page | What it does |
| --- | --- |
| **Welcome** | Purpose of the tool and the way in. |
| **Home** | Pick a workspace: **Test Cases** or **Enhancement Report**. |
| **Test Cases → Create** | One large card per test case with every field of the template. |
| **Test Cases → Upload** | Import a filled Iraje test case template; each row becomes a card. |
| **Test Cases → Reporting** | Summary of all test cases with screenshots, **Download TestSheet** and **Next** (PDF / DOCX / HTML). |
| **Enhancement Report → Create** | One card per enhancement request. |
| **Enhancement Report → Upload** | Import the filled Word enhancement template; each block becomes a card. |
| **Enhancement Report → Summary** | Priority overview, priority × status matrix, all requests with screenshots and **Next** (PDF / DOCX / HTML). |

### The test case card

* Fields mirror the template exactly. **Required:** Title / Description, Module / Feature, Field / Control,
  Test Steps, Expected Result, Actual Result and Status. Severity is disabled when the Status is Pass,
  the same rule the template enforces.
* **Screenshots:** browse, drag and drop onto the card, or paste from the clipboard (images only).
  Drag thumbnails to reorder; click to zoom.
* **Prev** is disabled on the first card. **Next** unlocks once all required fields are filled, and on
  the last card it starts a new test case. **Clear** unlocks as soon as anything is typed. Clear and Delete
  both offer **Undo**.
* The counter at the top right shows `‹ 3 / 10 ›`; click the number to jump to any test case.
  The large `‹` / `›` buttons on the screen edges go to the first / last test case.
* **Bookmarks:** the red bookmark on the card (or `Ctrl + B`) marks a test case; manage them from the
  bookmark button at the top.
* **All test cases** opens a navigator with search, status filters and drag-and-drop reordering.
* **Finish** checks for incomplete test cases and opens the Reporting tab.

### The enhancement request card

* **Request:** Title, Module / Feature and Priority (Critical / High / Medium / Low) are required; Category
  (Functionality, UI / UX, Usability, Performance, Security, …, or your own) and Status (Under review,
  Approved, Planned, Done, Rejected; empty means **Proposed**) are optional.
* **Details:** Current behaviour, Proposed improvement and Business value are required; Acceptance criteria
  is optional.
* **Reference screenshots**, bookmarks, the navigator (filters by priority), Undo, autosave and every
  keyboard shortcut work exactly as on the test case card. IDs read `ER-001`, `ER-002`, …

### Word enhancement template

**Download template** (Enhancement Report toolbar or Upload tab) builds `Iraje_Enhancement_Template.docx`:
the Iraje logo and watermark, a short how-to, and five blocks with **Title**, **Description** and
**Reference screenshot** rows. Anyone can fill it in Word; copy a block for more requests and paste
screenshots as pictures. On **Upload**, every filled block becomes a card: Title → Title,
Description → Current behaviour, pictures → reference screenshots. Module, Proposed improvement,
Business value and Priority are then completed on each card. Up to **200 blocks per upload**, 50 MB per
file, **500 requests** per session.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl + Enter` | Next card (creates a new one on the last card) |
| `Ctrl + Shift + Enter` | Previous card |
| `Ctrl + B` | Bookmark / un-bookmark the current card |
| `Enter` | New line inside a field (moves to the next field in single-line inputs) |
| `Tab` / `Shift + Tab` | Next / previous field |
| `Ctrl + V` | Paste a screenshot from the clipboard |
| `Esc` | Close a dialog, drawer or image viewer |

On macOS use `⌘` instead of `Ctrl`.

### Upload rules

* Accepted: `.xlsx`, `.xlsm`, `.xls`, `.csv`, **only** in the Iraje test case template layout. The header
  row must match the template's 15 columns (Test ID … Comments / Defect ID). Other sheets, the previous
  template and renamed files are rejected with a clear message.
* Up to **600 test cases per upload** (the first 600 are imported and a warning explains the rest).
  Keep adding with **Next**, or upload another sheet with *Add after mine*, up to **1,500** in total,
  which is the template's capacity.
* Maximum file size 10 MB.

### Download TestSheet

The original template (`assets/IrajeTestcaseTemplate.xlsx`) is filled at the XML level, so every style,
dropdown, colour rule, formula, the protected **Summary** dashboard and its chart stay exactly as designed.
Product details from the Reporting tab go into the Summary sheet, new testers and test types are added to
its dropdown lists, and Excel recalculates everything when the file is opened. Screenshots stay in the
reports.

### Reports

All three formats share the same structure: cover, executive summary (status split, module-wise
progress, open issues by severity), a test case index, then each test case with its screenshots. Every page
carries a small Iraje logo and a faint "Iraje Software" watermark. Options: **all test cases** or
**defects only** (Fail + Blocked), and **one test case per page** or **continuous** layout.

* **PDF:** A4, embedded Poppins, clickable index, PDF bookmarks, full-width screenshots.
* **Word (DOCX):** Segoe UI (the template's font), logo in the header, watermark behind the text,
  linked index, editable in Word / WPS / Google Docs.
* **HTML:** a single self-contained file with search, status filters, image zoom and print-ready pages.

The **enhancement report** uses the same frame: cover with priorities at a glance, executive summary
(priority split, priority × status matrix, by module, by category), a request index, each request with
Current behaviour and Proposed improvement side by side, Business value, Acceptance criteria and its
reference screenshots, and a closing **Review & sign-off** block (Prepared / Reviewed / Approved by, with
empty Signature and Date boxes). Options: **all requests**, **Critical + High only** or
**Approved + Planned only**, and one request per page or continuous.

### Sessions

* Work is **autosaved** in the browser (IndexedDB) as you type and restored on the next visit. Each
  workspace has its own session: clearing one never touches the other.
* **Save project file** (`.iqa`) packs all cards and screenshots of a workspace into one file that a
  teammate can open with **Open project file** in the same workspace (the other workspace refuses it).
* **Start a new session** clears the current workspace (with confirmation).

## Security

Built for a security-sensitive product team:

* **No server-side storage:** all processing is local; nothing is uploaded.
* **Strict Content Security Policy** (`vercel.json` + meta tag): scripts only from this site, no inline
  scripts, no third-party CDNs at runtime (all libraries are vendored in `vendor/`), `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, plus HSTS, `nosniff`, `no-referrer`
  and a locked-down `Permissions-Policy`.
* **XSS-safe rendering:** user text is only set through `textContent`; generated HTML reports escape
  every value.
* **Upload hardening:** extension allow-list, size cap, file-signature (magic byte) check, zip-bomb
  guard (uncompressed size inspected before parsing), row cap, parsing in a Web Worker with a timeout,
  and exact template header matching.
* **Image hardening:** screenshots are accepted by file signature only (PNG, JPEG, GIF, WebP, BMP);
  SVG and disguised files are rejected; decoded dimensions are capped.
* **Word upload hardening:** `.docx` only, 50 MB cap, ZIP signature check, entry-count and uncompressed
  size limits checked before anything is inflated, XML read with `DOMParser`, picture references resolved
  inside the file only (linked pictures are never fetched), every picture through the image checks above.
* **Spreadsheet formula injection:** the TestSheet writes every value as an inline string, so text such
  as `=HYPERLINK(...)` can never become a live formula.
* **Up-to-date libraries:** SheetJS 0.20.3 (fixes CVE-2023-30533 and CVE-2024-22363 present in the
  0.18.5 build the previous version loaded from a CDN), jsPDF 4.2.1.

## Project structure

```
index.html              App shell (header, router outlet)
css/app.css             Design system and all styles
js/main.js              Bootstrap + hash router
js/core/                config (template mapping, limits), workspaces (Test Cases / Enhancement definitions),
                        store (state + autosave, one per workspace), db (IndexedDB), util, loader
js/ui/                  dom builder, icons, modal, toast, popover, lightbox, sortable, shortcuts
js/pages/               welcome, home, workspace (shared shell), testcases / enhancements (instances),
                        editor (card), navigator, upload, report, enhancement-upload, enhancement-summary
js/services/            images, importer, template (TestSheet), enhancement-template (Word), project-file
js/reports/             model (report documents) + enhancement-model, tones, docx-brand,
                        html / pdf / docx renderers
js/workers/             spreadsheet parser worker
vendor/                 jszip, jspdf (+ autotable), docx, SheetJS: pinned, with licenses
assets/                 Excel template, logo, fonts (Poppins, OFL)
docs/DESIGN.md          Design decisions
vercel.json             Security headers and caching
```

## Running locally

It is a static site with no build step. Serve the folder with any static server, for example:

```bash
npx --yes http-server -p 5173 -c-1
```

Then open <http://localhost:5173>. Opening `index.html` directly from disk does not work, because browsers
block ES modules and workers on `file://`.

Tests run in the browser: open <http://localhost:5173/tests.html> (add `?only=store` to run one file).
`tests/`, `tests.html` and `docs/superpowers/` are listed in `.vercelignore`, so they are never deployed.

## Deploying

Vercel serves the repository as-is (no framework preset, no build command). `vercel.json` adds the security
headers. Every branch gets a preview deployment; merging to `main` updates production.

## Third-party software

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

made by Aniket ~ Product Security Specialist at Iraje Software
