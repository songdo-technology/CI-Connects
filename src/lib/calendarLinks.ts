import { EventConfig, Session, Room } from '../types';

/**
 * Getting an event into somebody's own calendar.
 *
 * Two routes, because people's calendars differ and neither covers everyone:
 * a Google Calendar URL for the majority here, and a downloadable .ics for
 * Outlook, Apple Calendar and everything else. Both are generated in the
 * browser — no service, no account, nothing to configure.
 */

/** Calendar timestamps are UTC with no punctuation: 20271015T020000Z. */
function stamp(dateStr: string, minutes: number, tzOffsetHours: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  // Korea has no daylight saving, so a fixed offset is exact rather than a
  // simplification that breaks twice a year.
  const utc = Date.UTC(y, m - 1, d, Math.floor(minutes / 60) - tzOffsetHours, minutes % 60);
  return new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const KST = 9;

/** Escapes the characters iCalendar treats as structure. */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

interface CalendarEntry {
  title: string;
  description: string;
  location: string;
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
  url?: string;
}

export function entryForEvent(event: EventConfig): CalendarEntry {
  return {
    title: event.name,
    description: [event.tagline, event.summary].filter(Boolean).join('\n\n'),
    location: [event.venueName, event.venueAddress].filter(Boolean).join(', '),
    dateStr: event.startDate,
    // A whole-day event where no times are recorded: 09:00 to 17:00 is a
    // better guess than midnight to midnight, which blocks out the evening.
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    url: typeof window === 'undefined' ? undefined : `${window.location.origin}/?event=${event.slug}`,
  };
}

export function entryForSession(session: Session, room?: Room, event?: EventConfig): CalendarEntry {
  return {
    title: session.title,
    description: session.description,
    location: [room?.name, event?.venueName].filter(Boolean).join(', '),
    dateStr: session.dateStr,
    startMinutes: session.startMinutes,
    endMinutes: session.endMinutes,
  };
}

export function googleCalendarUrl(entry: CalendarEntry): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', entry.title);
  url.searchParams.set('dates',
    `${stamp(entry.dateStr, entry.startMinutes, KST)}/${stamp(entry.dateStr, entry.endMinutes, KST)}`);
  url.searchParams.set('details',
    [entry.description, entry.url].filter(Boolean).join('\n\n'));
  url.searchParams.set('location', entry.location);
  url.searchParams.set('ctz', 'Asia/Seoul');
  return url.toString();
}

/** An .ics file for everything that is not Google Calendar. */
export function icsFor(entries: CalendarEntry[], calendarName: string): string {
  const now = stamp(new Date().toISOString().slice(0, 10), 0, 0);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chadwick International//CI Connects//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  for (const [i, e] of entries.entries()) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${now}-${i}@ci-connects`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.dateStr, e.startMinutes, KST)}`,
      `DTEND:${stamp(e.dateStr, e.endMinutes, KST)}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc([e.description, e.url].filter(Boolean).join('\n\n'))}`,
      `LOCATION:${esc(e.location)}`,
      ...(e.url ? [`URL:${e.url}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  // iCalendar requires CRLF. Some clients tolerate LF; Outlook does not.
  return lines.join('\r\n');
}

export function downloadIcs(entries: CalendarEntry[], filename: string): void {
  const blob = new Blob([icsFor(entries, filename)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase()}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
