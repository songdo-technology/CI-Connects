import { unzipSync, strFromU8 } from 'fflate';

/** One sheet as a grid of text. Dates and times arrive as YYYY-MM-DD and
 *  HH:MM, however Excel stored them; merged cells repeat their value. */
export interface Sheet { name: string; rows: string[][] }

const decodeXml = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&');

const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const rowIndex = (ref: string) => Number(ref.replace(/\D+/g, '')) - 1;
const pad = (n: number) => String(n).padStart(2, '0');

/** An Excel serial as text: a date, a time of day, or both. */
function serialToText(serial: number): string {
  const days = Math.floor(serial); const mins = Math.round((serial - days) * 1440);
  const time = `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  if (days === 0) return time;
  const d = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return mins === 0 ? date : `${date} ${time}`;
}

/**
 * Reads an .xlsx workbook without a spreadsheet library: it is a zip of XML,
 * and a programme needs only the cell text. Styles are read far enough to
 * tell a date or a time from a plain number.
 */
export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes, { filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(f.name) });
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');

  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));

  const styles = text('xl/styles.xml');
  const custom = new Map<number, string>([...styles.matchAll(/<numFmt [^>]*?numFmtId="(\d+)"[^>]*?formatCode="([^"]*)"/g)].map((m) => [Number(m[1]), decodeXml(m[2])]));
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
  const fmtOfStyle = [...xfs.matchAll(/<xf\b([^>]*)>/g)].map((m) => Number(/numFmtId="(\d+)"/.exec(m[1])?.[1] ?? 0));
  const isDateFmt = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    const code = (custom.get(id) ?? '').replace(/\[[^\]]*\]|"[^"]*"|\\./g, '');
    return /[dmyhs]/i.test(code) && !/^[#0,.%E+\-\s?/]*$/i.test(code);
  };

  const rels = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)].map((m) => [/Id="([^"]+)"/.exec(m[1])?.[1] ?? '', /Target="([^"]+)"/.exec(m[1])?.[1] ?? '']));
  const sheets = [...text('xl/workbook.xml').matchAll(/<sheet\b([^>]*)>/g)].map((m) => ({ name: decodeXml(/name="([^"]*)"/.exec(m[1])?.[1] ?? 'Sheet'), rid: /r:id="([^"]+)"/.exec(m[1])?.[1] ?? '' }));

  return sheets.map(({ name, rid }) => {
    const target = (rels.get(rid) ?? '').replace(/^\/?xl\//, '').replace(/^\.\//, '');
    const xml = text(`xl/${target}`);
    const grid: string[][] = [];
    const put = (r: number, c: number, v: string) => { while (grid.length <= r) grid.push([]); const row = grid[r]; while (row.length <= c) row.push(''); row[c] = v; };
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1]; const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]; if (!ref) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n'; const style = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
      const body = m[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v ?? -1)] ?? '';
      else if (type === 'inlineStr') value = decodeXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str' || type === 'e') value = decodeXml(v ?? '');
      else if (v != null && v !== '') {
        const n = Number(v);
        value = Number.isFinite(n) && style >= 0 && isDateFmt(fmtOfStyle[style] ?? 0) ? serialToText(n) : String(Number.isFinite(n) ? Number(n.toFixed(6)) : v);
      }
      if (value !== '') put(rowIndex(ref), colIndex(ref), value.replace(/\r\n?/g, '\n').trim());
    }
    // A merged cell says its value once; every cell it covers means it.
    for (const mm of xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)) {
      const r0 = rowIndex(mm[1]), c0 = colIndex(mm[1]), r1 = rowIndex(mm[2]), c1 = colIndex(mm[2]);
      const v = grid[r0]?.[c0] ?? ''; if (!v) continue;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!(grid[r]?.[c])) put(r, c, v);
    }
    const width = Math.max(0, ...grid.map((r) => r.length));
    const rows = grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')).filter((r) => r.some((x) => x.trim()));
    return { name, rows };
  }).filter((s) => s.rows.length > 0);
}
