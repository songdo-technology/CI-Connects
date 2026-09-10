/** Small, dependency-free date and time helpers. Dates are YYYY-MM-DD, times HH:MM (24h). */

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** "09:00" → "9:00 AM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const parseDate = (ymd: string): Date => new Date(`${ymd}T00:00:00`);

/** "2026-10-17" → "Saturday, 17 October 2026" */
export function formatDate(ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string {
  return parseDate(ymd).toLocaleDateString('en-GB', opts);
}

/** "17 Oct" */
export const formatShortDate = (ymd: string) =>
  parseDate(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A range as people write it: "17 October 2026" or "17–18 October 2026". */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start, { day: 'numeric', month: 'long', year: 'numeric' });
  const a = parseDate(start), b = parseDate(end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${b.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }
  return `${formatShortDate(start)} – ${formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Every date from start to end inclusive. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = parseDate(start); const last = parseDate(end);
  while (d <= last) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type EventPhase = 'upcoming' | 'live' | 'past';
export function eventPhase(startDate: string, endDate: string): EventPhase {
  const t = todayYmd();
  if (t < startDate) return 'upcoming';
  if (t > endDate) return 'past';
  return 'live';
}

export const daysUntil = (ymd: string): number =>
  Math.ceil((parseDate(ymd).getTime() - Date.now()) / 86_400_000);

export const nowIso = () => new Date().toISOString();

/** A moment as a clock time in the reader's own zone: "2:05 PM". Never the
 *  browser locale — that put "오전" on every check-in for a Korean machine. */
export const formatClock = (iso: string): string => {
  const d = new Date(iso);
  return formatTime(fromMinutes(d.getHours() * 60 + d.getMinutes()));
};

/** "17 Oct 2026, 2:05 PM" — or just the day. */
export const formatStamp = (iso: string, withTime = true): string => {
  const day = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return withTime ? `${day}, ${formatClock(iso)}` : day;
};

/** What a person typed for a time — "9", "930", "9:30", "09.30", "9:30 pm" —
 *  as HH:MM, or null when it is not one. */
export function parseClock(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*(am|pm|a|p)?$/.exec(raw.trim().toLowerCase());
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] ?? '0'); const ap = m[3];
  if (ap?.startsWith('p') && h < 12) h += 12;
  if (ap?.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return fromMinutes(h * 60 + min);
}

/** What a person typed for a date — "2026-10-17", "2026.10.17", "2026/10/17",
 *  "20261017" — as YYYY-MM-DD, or null when it is not a real date. */
export function parseYmd(raw: string): string | null {
  const m = /^(\d{4})[-./\s]?(\d{1,2})[-./\s]?(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
