/**
 * A spreadsheet in, sessions out.
 *
 * Columns, in any order, matched by header name (case-insensitive):
 *   title, abstract, type, date, start, end, room, track, speakers, capacity
 * `speakers` is "Name (Title, Org); Name (Title, Org)". Times accept
 * "9:00", "09:00", "9:00 AM", "9am". Dates accept YYYY-MM-DD or D/M/YYYY.
 */
import { Session, SessionType, Speaker } from './types';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export function parseTime(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function parseDateCell(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function parseSpeakers(raw: string): Speaker[] {
  return raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^(.*?)\s*\((.*)\)\s*$/);
    if (!m) return { name: part };
    const [title, org] = m[2].split(',').map((x) => x.trim());
    return { name: m[1].trim(), title: title || undefined, org: org || undefined };
  });
}

const TYPES: SessionType[] = ['keynote', 'talk', 'workshop', 'panel', 'break', 'social'];

export interface ImportRow {
  line: number;
  session: Omit<Session, 'id' | 'eventId' | 'reservedUserIds' | 'waitlistUserIds' | 'roomId' | 'trackId'> & { room: string; track?: string };
  problems: string[];
}

export function rowsToSessions(rows: string[][], defaultDate: string): ImportRow[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const get = (r: string[], name: string) => { const i = col(name); return i >= 0 ? (r[i] ?? '').trim() : ''; };
  return rows.slice(1).map((r, idx) => {
    const problems: string[] = [];
    const title = get(r, 'title'); if (!title) problems.push('no title');
    const start = parseTime(get(r, 'start')); if (!start) problems.push('start time unreadable');
    const end = parseTime(get(r, 'end')); if (!end) problems.push('end time unreadable');
    const date = get(r, 'date') ? parseDateCell(get(r, 'date')) : defaultDate; if (!date) problems.push('date unreadable');
    const room = get(r, 'room'); if (!room) problems.push('no room');
    const typeRaw = get(r, 'type').toLowerCase();
    const type = (TYPES.includes(typeRaw as SessionType) ? typeRaw : 'talk') as SessionType;
    const capacity = Number(get(r, 'capacity') || 0) || 0;
    return {
      line: idx + 2,
      problems,
      session: {
        title, abstract: get(r, 'abstract'), type,
        date: date ?? defaultDate, start: start ?? '09:00', end: end ?? '10:00',
        room, track: get(r, 'track') || undefined,
        speakers: parseSpeakers(get(r, 'speakers')), capacity,
      },
    };
  });
}

export const CSV_TEMPLATE = `title,abstract,type,date,start,end,room,track,speakers,capacity
Opening keynote,What we can build together,keynote,2026-10-17,09:00,10:00,Main Theater,Plenary,"Speaker to be confirmed (Head of School, Chadwick International)",0
AI in the classroom,Practical moves for Monday,workshop,2026-10-17,10:30,11:45,B-201,Teaching & learning,"Speaker to be confirmed (Teacher, Chadwick International)",25`;
