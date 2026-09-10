import { Event, Session, Room } from './types';

const stamp = (date: string, hhmm: string) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** An iCalendar file of the given sessions, in Korea Standard Time. */
export function buildIcs(event: Event, sessions: Session[], rooms: Room[]): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CI Connects//v2//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const s of sessions) {
    const room = rooms.find((r) => r.id === s.roomId);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@ci-connects`,
      `DTSTART;TZID=Asia/Seoul:${stamp(s.date, s.start)}`,
      `DTEND;TZID=Asia/Seoul:${stamp(s.date, s.end)}`,
      `SUMMARY:${esc(`${s.title} — ${event.name}`)}`,
      `LOCATION:${esc([room?.name, event.venueName].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${esc(s.abstract)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadText(filename: string, text: string, type = 'text/calendar') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
