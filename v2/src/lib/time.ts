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

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
