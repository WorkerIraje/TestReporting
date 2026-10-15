// Shared report palette. A report document refers to colours by tone name; each renderer maps the
// tone to its own colour format (RGB arrays for PDF, RRGGBB for Word, CSS for HTML).
// fg = text / accents, bg = badge and tile fills, soft = tinted panels, border = tinted outlines.

export const TONES = Object.freeze({
  pass: { fg: '#15803D', bg: '#E7F6EC', soft: '#FFFFFF', border: '#EDF1F8' },
  fail: { fg: '#D92D20', bg: '#FEECEB', soft: '#FFF8F7', border: '#F9B6B0' },
  blocked: { fg: '#C4560C', bg: '#FFF2E5', soft: '#FFFAF4', border: '#F9C99A' },
  none: { fg: '#5B6680', bg: '#EEF1F6', soft: '#FFFFFF', border: '#EDF1F8' },
  notrun: { fg: '#C9D1E0', bg: '#EEF1F6', soft: '#FFFFFF', border: '#EDF1F8' },
  critical: { fg: '#9F1239', bg: '#FDE8EE', soft: '#FFF7F9', border: '#F5B8C8' },
  high: { fg: '#D92D20', bg: '#FEECEB', soft: '#FFF8F7', border: '#F9B6B0' },
  medium: { fg: '#C77700', bg: '#FFF4E0', soft: '#FFFBF3', border: '#F5D49A' },
  low: { fg: '#0E7490', bg: '#E3F4F8', soft: '#F5FBFD', border: '#A9DCE8' },
  blue: { fg: '#0451CC', bg: '#EAF1FF', soft: '#F2F6FF', border: '#C9DAFB' },
  navy: { fg: '#1D2548', bg: '#EEF1F6', soft: '#F9FBFF', border: '#E1E7F2' },
  proposed: { fg: '#5B6680', bg: '#EEF1F6', soft: '#FFFFFF', border: '#EDF1F8' },
  review: { fg: '#0451CC', bg: '#EAF1FF', soft: '#F2F6FF', border: '#C9DAFB' },
  approved: { fg: '#15803D', bg: '#E7F6EC', soft: '#F6FCF8', border: '#A7DFBA' },
  planned: { fg: '#6D28D9', bg: '#F3EEFF', soft: '#FAF7FF', border: '#D9C8FB' },
  done: { fg: '#1D2548', bg: '#EEF1F6', soft: '#F9FBFF', border: '#E1E7F2' },
  rejected: { fg: '#D92D20', bg: '#FEECEB', soft: '#FFF8F7', border: '#F9B6B0' },
});

export const tone = (key) => TONES[key] || TONES.none;

/** '#RRGGBB' -> [r, g, b] (jsPDF). */
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** '#RRGGBB' -> 'RRGGBB' (docx). */
export const docxHex = (hex) => hex.slice(1).toUpperCase();

/** A table cell is a plain value or { v, tone, bold, badge }. */
export const cellValue = (c) => (c !== null && typeof c === 'object' ? c.v : c);
export const cellStyle = (c) => (c !== null && typeof c === 'object' ? c : {});
