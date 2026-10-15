# Iraje QA Management

Write test cases card by card or import your existing sheet, attach the screenshots that prove each
result, and turn a full test cycle into a polished, audit-ready report: the filled Excel **TestSheet**,
plus **PDF**, **Word (DOCX)** and **HTML** reports, all branded with the Iraje logo and a
"Iraje Software" watermark on every page.

Everything runs in the browser. Test cases and screenshots never leave the tester's machine.

## Using it

| Page | What it does |
| --- | --- |
| **Welcome** | Purpose of the tool and the way in. |
| **Home** | Pick a workspace: **Test Cases**, or **Enhancement Report** (coming soon). |
| **Test Cases → Create** | One large card per test case with every field of the template. |
| **Test Cases → Upload** | Import a filled Iraje test case template; each row becomes a card. |
| **Test Cases → Reporting** | Summary of all test cases with screenshots, **Download TestSheet** and **Next** (PDF / DOCX / HTML). |

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

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl + Enter` | Next test case (creates a new one on the last card) |
| `Ctrl + Shift + Enter` | Previous test case |
| `Ctrl + B` | Bookmark / un-bookmark the current test case |
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

### Sessions

* Work is **autosaved** in the browser (IndexedDB) as you type and restored on the next visit.
* **Save project file** (`.iqa`) packs all test cases and screenshots into one file that a teammate can
  open with **Open project file**.
* **Start a new session** clears everything (with confirmation).

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
* **Spreadsheet formula injection:** the TestSheet writes every value as an inline string, so text such
  as `=HYPERLINK(...)` can never become a live formula.
* **Up-to-date libraries:** SheetJS 0.20.3 (fixes CVE-2023-30533 and CVE-2024-22363 present in the
  0.18.5 build the previous version loaded from a CDN), jsPDF 4.2.1.

## Project structure

```
index.html              App shell (header, router outlet)
css/app.css             Design system and all styles
js/main.js              Bootstrap + hash router
js/core/                config (template mapping, limits), store (state + autosave), db (IndexedDB), util, loader
js/ui/                  dom builder, icons, modal, toast, popover, lightbox, sortable, shortcuts
js/pages/               welcome, home, workspace (tabs), editor (card), navigator, upload, report
js/services/            images, importer, template (TestSheet), project-file
js/reports/             model + html / pdf / docx generators
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

## Deploying

Vercel serves the repository as-is (no framework preset, no build command). `vercel.json` adds the security
headers. Every branch gets a preview deployment; merging to `main` updates production.

## Third-party software

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

made by Aniket ~ Product Security Specialist at Iraje Software
