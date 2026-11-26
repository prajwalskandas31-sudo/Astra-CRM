import * as XLSX from 'xlsx';

/**
 * The house style of every Excel download (taken from the RA Periodic "NISM Certification Details" sheet):
 * a deep teal-navy title row and band, the column headings in the same colour with white bold text and lighter
 * blue dividers, then white rows with a light grey grid. Text wraps, rows get room to breathe, columns are sized.
 *
 * Each row of a sheet gets a role:
 *   title     the report name, merged across the table, white bold 14 pt, centred
 *   subtitle  the band under the title (period, description); an empty one is the plain band of the sample
 *   header    column headings
 *   body      table rows
 *   total     a totals row (bold, light teal)
 *   section   the heading of a second table on the same sheet
 *   kv        a "Label | Value" line (label shaded)
 *   text      plain text below a table (signature lines and the like)
 *   note      small grey text (remarks, disclaimers)
 *   blank     an empty spacer row
 */
export const REPORT_COLORS = {
  fill: '104869',      // title, band and header fill
  divider: '3C7294',   // lines inside the header band
  grid: 'D9D9D9',      // lines between the white rows
  ink: '1F1F1F',
  white: 'FFFFFF',
  total: 'E3ECF2',
  label: 'F2F6F9',
  note: '595959'
};

const FONT = 'Calibri';
const line = (rgb, style = 'thin') => ({ style, color: { rgb } });
const box = (rgb, style) => ({ top: line(rgb, style), bottom: line(rgb, style), left: line(rgb, style), right: line(rgb, style) });
const font = (extra = {}) => ({ name: FONT, sz: 11, color: { rgb: REPORT_COLORS.ink }, ...extra });
const solid = (rgb) => ({ patternType: 'solid', fgColor: { rgb } });

const STYLES = {
  title: {
    font: font({ sz: 14, bold: true, color: { rgb: REPORT_COLORS.white } }), fill: solid(REPORT_COLORS.fill),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  },
  subtitle: {
    font: font({ sz: 10.5, color: { rgb: REPORT_COLORS.white } }), fill: solid(REPORT_COLORS.fill),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  },
  header: {
    font: font({ bold: true, color: { rgb: REPORT_COLORS.white } }), fill: solid(REPORT_COLORS.fill),
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: box(REPORT_COLORS.divider)
  },
  body: { font: font(), alignment: { vertical: 'center', wrapText: true }, border: box(REPORT_COLORS.grid) },
  total: { font: font({ bold: true }), fill: solid(REPORT_COLORS.total), alignment: { vertical: 'center', wrapText: true }, border: box(REPORT_COLORS.grid) },
  section: {
    font: font({ sz: 12, bold: true, color: { rgb: REPORT_COLORS.fill } }), alignment: { horizontal: 'left', vertical: 'bottom' },
    border: { bottom: line(REPORT_COLORS.fill, 'medium') }
  },
  kvLabel: { font: font({ bold: true }), fill: solid(REPORT_COLORS.label), alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: box(REPORT_COLORS.grid) },
  kvValue: { font: font(), alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: box(REPORT_COLORS.grid) },
  text: { font: font(), alignment: { horizontal: 'left', vertical: 'center' } },
  note: { font: font({ sz: 10, italic: true, color: { rgb: REPORT_COLORS.note } }), alignment: { horizontal: 'left', vertical: 'center', wrapText: true } }
};

// Roles merged across the full width when the row holds a single value
const BANNER = new Set(['title', 'subtitle', 'section', 'note']);
// Roles that size the columns
const SIZING = new Set(['header', 'body', 'total', 'kv']);

const text = (cell) => {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  return cell.w !== undefined ? String(cell.w) : String(cell.v);
};

const linesFor = (value, chars, bold) => {
  const per = Math.max(1, chars - 1);
  return String(value).split('\n').reduce((n, part) => n + Math.max(1, Math.ceil((part.length * (bold ? 1.12 : 1.02)) / per)), 0);
};

/** Apply the house style to a sheet whose row r has the role roles[r]. */
export function styleSheet(ws, roles) {
  if (!ws || !ws['!ref']) return ws;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const merges = ws['!merges'] = ws['!merges'] || [];

  // A row's own width: its last filled (or merged) column
  const ownWidth = (r) => {
    for (let c = range.e.c; c >= 0; c -= 1) {
      if (text(ws[XLSX.utils.encode_cell({ r, c })]) !== '' || merges.some(m => m.s.r <= r && m.e.r >= r && m.s.c <= c && m.e.c >= c)) return c + 1;
    }
    return 1;
  };
  // Each table is as wide as its heading (a group of heading rows); banners span the widest table
  const spans = [];
  let current = 0;
  roles.forEach((role, r) => {
    if (role === 'header') current = roles[r - 1] === 'header' ? Math.max(current, ownWidth(r)) : ownWidth(r);
    if (role === 'header' || role === 'body' || role === 'total') spans[r] = Math.max(current, ownWidth(r));
  });
  roles.forEach((role, r) => { if (role === 'header' && roles[r - 1] === 'header') for (let k = r - 1; roles[k] === 'header'; k -= 1) spans[k] = spans[r]; });
  let width = Math.max(1, ...spans.filter(Boolean));
  if (width === 1) width = range.e.c + 1;

  // Column widths: keep the ones given, size the rest from the content
  if (!ws['!cols'] || !ws['!cols'].length) {
    const longest = Array(width).fill(0);
    roles.forEach((role, r) => {
      if (!SIZING.has(role)) return;
      for (let c = 0; c < width; c += 1) {
        if (merges.some(m => m.s.r <= r && m.e.r >= r && m.s.c <= c && m.e.c >= c && m.e.c > m.s.c)) continue;
        const longestLine = Math.max(...text(ws[XLSX.utils.encode_cell({ r, c })]).split('\n').map(s => s.length));
        longest[c] = Math.max(longest[c], role === 'header' ? Math.min(longestLine, 24) : longestLine);
      }
    });
    ws['!cols'] = longest.map(n => ({ wch: Math.min(50, Math.max(10, n + 3)) }));
  }
  const colWidth = (c) => ws['!cols'][c]?.wch || ws['!cols'][c]?.wpx / 7 || 12;

  // Banners span the table
  roles.forEach((role, r) => {
    if (!BANNER.has(role) || width < 2) return;
    if (merges.some(m => m.s.r <= r && m.e.r >= r)) return;
    let filled = 0;
    for (let c = 0; c <= range.e.c; c += 1) if (text(ws[XLSX.utils.encode_cell({ r, c })]) !== '') filled += 1;
    if (filled <= 1) merges.push({ s: { r, c: 0 }, e: { r, c: width - 1 } });
  });

  const rows = ws['!rows'] = ws['!rows'] || [];
  roles.forEach((role, r) => {
    if (!role || role === 'blank') return;
    const span = role === 'kv' ? 2 : spans[r] || width;
    let lines = 1;
    for (let c = 0; c < span; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c });
      let cell = ws[ref];
      const value = text(cell);
      if (role === 'text' && !cell) continue;
      if (!cell) {
        cell = ws[ref] = { t: 's', v: '' };
      }
      // A copy per cell: the writer stores a cell's number format on its style object, so a shared object
      // would hand one cell's date format to every number after it
      const s = JSON.parse(JSON.stringify(role === 'kv' ? (c === 0 ? STYLES.kvLabel : STYLES.kvValue) : STYLES[role]));
      if ((role === 'body' || role === 'total') && cell.t === 's') s.alignment.horizontal = 'left';
      if (cell.z) s.numFmt = cell.z;
      cell.s = s;

      // Height: the wrapped lines of the tallest cell (merged cells use their merged width)
      if (value === '') continue;
      const merge = merges.find(m => m.s.r <= r && m.e.r >= r && m.s.c <= c && m.e.c >= c);
      if (merge && (merge.s.c !== c || merge.s.r !== r)) continue;
      if (merge && merge.e.r > merge.s.r) continue;
      let chars = 0;
      for (let k = merge ? merge.s.c : c; k <= (merge ? merge.e.c : c); k += 1) chars += colWidth(k);
      lines = Math.max(lines, linesFor(value, chars * (role === 'title' ? 0.78 : 1), role === 'header' || role === 'total'));
    }
    const lineHeight = role === 'title' ? 19 : 15;
    const pad = { title: 14, subtitle: 8, header: 10, section: 10, note: 4, text: 4 }[role] ?? 7;
    const min = { title: 32, subtitle: 20, header: 26, section: 24, note: 16, text: 16 }[role] ?? 20;
    rows[r] = { hpt: Math.max(min, Math.min(409, lines * lineHeight + pad)) };
  });
  return ws;
}

/**
 * Builds a styled sheet row by row:
 *   const b = reportSheet(); b.title('Report'); b.subtitle('Nov 2026'); b.header([...]); b.rows([...]); b.build();
 * b.row is the index the next row will get (for merges).
 */
export function reportSheet() {
  const aoa = [];
  const roles = [];
  const api = {
    get row() { return aoa.length; },
    add(role, cells) { aoa.push(cells); roles.push(role); return api; },
    title(t) { return api.add('title', [t]); },
    subtitle(t = '') { return api.add('subtitle', [t]); },
    header(cells) { return api.add('header', cells); },
    rows(list) { list.forEach(cells => api.add('body', cells)); return api; },
    body(cells) { return api.add('body', cells); },
    total(cells) { return api.add('total', cells); },
    section(t) { return api.add('section', [t]); },
    kv(label, value) { return api.add('kv', [label, value]); },
    text(t) { return api.add('text', [t]); },
    note(t) { return api.add('note', [t]); },
    blank() { return api.add('blank', []); },
    /** The sheet, styled. Options: cols (wch numbers), merges. */
    build({ cols, merges } = {}) {
      const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [['']]);
      if (cols) ws['!cols'] = cols.map(wch => ({ wch }));
      if (merges) ws['!merges'] = merges;
      return styleSheet(ws, roles);
    }
  };
  return api;
}

/** A plain report sheet: title band, optional subtitle, one header row, the rows, an optional total and notes. */
export const tableSheet = ({ title, subtitle = '', header, rows, records, total, notes = [], cols, merges }) => {
  if (records) {
    header = header || Object.keys(records[0] || {});
    rows = records.map(rec => header.map(h => rec[h] ?? ''));
  }
  const b = reportSheet();
  if (title) b.title(title).subtitle(subtitle);
  b.header(header).rows(rows);
  if (total) b.total(total);
  if (notes.length) { b.blank(); notes.forEach(n => b.note(n)); }
  return b.build({ cols, merges });
};

/** Header-only style for upload templates, which must keep their headings in row 1. */
export const styleHeaderRow = (ws) => {
  const range = XLSX.utils.decode_range(ws['!ref']);
  return styleSheet(ws, ['header', ...Array(range.e.r).fill('body')]);
};

/** Download the workbook with its styles. Falls back to an unstyled file rather than failing the download. */
export async function writeReport(wb, fileName) {
  try {
    const mod = await import('xlsx-js-style');
    const XLSXStyle = mod.default || mod;
    XLSXStyle.writeFile(wb, fileName, { cellStyles: true });
  } catch (err) {
    console.error('Styled Excel export failed, downloading without styles:', err);
    XLSX.writeFile(wb, fileName);
  }
}
