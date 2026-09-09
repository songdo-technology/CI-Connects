/**
 * Reading a spreadsheet an organiser actually has.
 *
 * The rows come from Excel, Google Sheets, or a table pasted out of an email,
 * so the parser has to survive quoted fields containing commas, doubled quotes
 * as escapes, newlines inside cells, a UTF-8 BOM, and CRLF endings. Splitting
 * on commas handles none of that and fails on the first session title with a
 * comma in it.
 *
 * Nothing here writes. Parsing, mapping and validating all produce a preview
 * the organiser confirms, because an import that silently creates ninety wrong
 * rows is worse than one that refuses.
 */

/** RFC 4180, plus the tolerances real files need. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // A BOM survives every round trip through Excel and would otherwise become
  // part of the first header's name, so no column would ever match it.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    // Skip lines that are entirely empty — trailing newlines are universal.
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }

    if (char === '"') { quoted = true; i += 1; continue; }
    if (char === ',') { endField(); i += 1; continue; }
    if (char === '\r') { i += 1; continue; }
    if (char === '\n') { endRow(); i += 1; continue; }
    field += char; i += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Reduces a header to something matchable: "Start Time" and "start_time" are
 *  the same column, and organisers write both. */
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface FieldSpec {
  key: string;
  label: string;
  /** Header spellings seen in the wild, normalised on comparison. */
  aliases: string[];
  required?: boolean;
  hint?: string;
}

/**
 * Matches spreadsheet columns to fields.
 *
 * Exact alias first, then a containment check, so "Session Title" finds
 * `title` without an alias entry for every phrasing anyone might use. A column
 * is claimed once: two headers that both look like `title` must not both win,
 * or the second silently overwrites the first.
 */
export function mapColumns(
  headers: string[],
  fields: FieldSpec[],
): Record<string, number> {
  const map: Record<string, number> = {};
  const taken = new Set<number>();
  const normalised = headers.map(normalise);

  for (const field of fields) {
    const aliases = [field.key, field.label, ...field.aliases].map(normalise);
    let found = normalised.findIndex((h, i) => !taken.has(i) && aliases.includes(h));
    if (found === -1) {
      found = normalised.findIndex(
        (h, i) => !taken.has(i) && h.length > 2 && aliases.some((a) => h.includes(a) || a.includes(h)),
      );
    }
    if (found !== -1) { map[field.key] = found; taken.add(found); }
  }
  return map;
}

/** A parsed row, with whatever is wrong with it attached. */
export interface PreviewRow<T> {
  /** Line number in the file, for pointing at the offending row. */
  line: number;
  value: T;
  problems: string[];
  /** Matches something already stored, so importing would duplicate it. */
  duplicateOf?: string;
}

/** Reads a cell, tolerating a missing column. */
export const cell = (row: string[], index: number | undefined): string =>
  (index === undefined ? '' : (row[index] ?? '')).trim();

/** Parses a count. Organisers write "30 seats" and "c. 40" as often as "30". */
export function parseCount(raw: string): number | null {
  const match = raw.match(/\d[\d,]*/);
  if (!match) return null;
  const n = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a clock time into minutes from midnight.
 *
 * Accepts "9:00 AM", "09:00", "9am", "1400". A spreadsheet exports whichever
 * of these the author's locale produced, and a schedule that silently sorts
 * wrong is worse than one that refuses to import.
 */
export function parseClock(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!value) return null;

  const suffix = value.endsWith('am') ? 'am' : value.endsWith('pm') ? 'pm' : null;
  const digits = suffix ? value.slice(0, -2) : value;

  let hours: number;
  let minutes: number;
  if (digits.includes(':')) {
    const [h, m] = digits.split(':');
    hours = Number(h); minutes = Number(m);
  } else if (/^\d{3,4}$/.test(digits)) {
    hours = Number(digits.slice(0, digits.length - 2));
    minutes = Number(digits.slice(-2));
  } else if (/^\d{1,2}$/.test(digits)) {
    hours = Number(digits); minutes = 0;
  } else {
    return null;
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes > 59) return null;
  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

/** Renders minutes back as the 12-hour string the rest of the app stores. */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/** ISO date from the several ways a sheet writes one. Returns '' if unreadable. */
export function parseDate(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // D/M/Y and M/D/Y are indistinguishable below 13, so the ambiguity is real
  // and unresolvable from the value alone. Day-first matches the school's
  // locale; the preview shows the result so a wrong reading is visible.
  const slash = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/** Case- and punctuation-insensitive match, for spotting existing records. */
export const sameName = (a: string, b: string) => normalise(a) === normalise(b);

/** Turns rows back into a file, for the downloadable templates. */
export function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
