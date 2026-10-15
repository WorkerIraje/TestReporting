/* Parses an uploaded spreadsheet off the main thread so a large or hostile file
   can never freeze the page. The main thread terminates this worker on timeout. */
/* global XLSX */
importScripts('../../vendor/xlsx.core.min.js');

// CSV saved by Excel is either "CSV UTF-8" (with BOM) or legacy ANSI (Windows-1252).
function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

self.onmessage = (event) => {
  const { buffer, kind, maxRows } = event.data;
  try {
    const opts = {
      sheetRows: maxRows,
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      bookVBA: false,
    };
    const wb = kind === 'csv'
      ? XLSX.read(decodeCsv(buffer), { ...opts, type: 'string', raw: true })
      : XLSX.read(new Uint8Array(buffer), { ...opts, type: 'array' });
    const sheets = {};
    for (const name of wb.SheetNames.slice(0, 20)) {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) {
        sheets[name] = { origin: { r: 0, c: 0 }, rows: [] };
        continue;
      }
      const range = XLSX.utils.decode_range(ws['!ref']);
      if (range.e.c - range.s.c > 60) range.e.c = range.s.c + 60; // the template has 15 columns
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true, range });
      sheets[name] = { origin: { r: range.s.r, c: range.s.c }, rows };
    }
    self.postMessage({ ok: true, sheetNames: wb.SheetNames, sheets });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
