/**
 * Whatever an organiser has — a spreadsheet with its own column names, a
 * table pasted from a document — read into sessions, and only sessions.
 *
 * Nothing here writes. It guesses which column means what, turns each row
 * into a draft with the problems it has, and leaves every doubtful choice
 * (an unknown column, a room it cannot place, a date outside the event) as
 * a question for the person importing. What has no place in the programme
 * is left out, not squeezed in.
 */
import type { Event, SessionType, Speaker } from './types';
import { parseClock, parseYmd, fromMinutes, toMinutes, eachDate } from './time';
import { parseSpeakers } from './csv';

export type Target =
  | 'title' | 'abstract' | 'type' | 'date' | 'start' | 'end' | 'time' | 'duration'
  | 'room' | 'track' | 'speakers' | 'speakerTitle' | 'speakerOrg' | 'capacity' | 'email' | 'ignore';

export const TARGET_LABEL: Record<Target, string> = {
  title: 'Title', abstract: 'Abstract', type: 'Type (keynote, workshop…)', date: 'Day', start: 'Starts', end: 'Ends',
  time: 'Time range (9:00–10:00)', duration: 'Length in minutes', room: 'Room', track: 'Track', speakers: 'Speakers',
  speakerTitle: "Speaker's title", speakerOrg: "Speaker's school", capacity: 'Seats', email: 'Email (a list of people)', ignore: "Don't import",
};
export const TARGETS: Target[] = ['title', 'abstract', 'type', 'date', 'start', 'end', 'time', 'duration', 'room', 'track', 'speakers', 'speakerTitle', 'speakerOrg', 'capacity', 'email', 'ignore'];

const SYNONYMS: [Target, string[]][] = [
  ['email', ['email', 'emailaddress', 'mail', 'e-mail']],
  ['title', ['title', 'sessiontitle', 'session', 'sessionname', 'workshoptitle', 'topic', 'activity', 'what', 'name', 'event', 'workshop']],
  ['abstract', ['abstract', 'description', 'desc', 'details', 'summary', 'blurb', 'overview', 'about', 'sessiondescription']],
  ['type', ['type', 'format', 'kind', 'sessiontype', 'sessionformat']],
  ['date', ['date', 'day', 'when', 'sessiondate']],
  ['start', ['start', 'starttime', 'begins', 'begin', 'from', 'timestart', 'startat']],
  ['end', ['end', 'endtime', 'finish', 'ends', 'until', 'to', 'timeend', 'endat']],
  ['time', ['time', 'times', 'timeslot', 'slot', 'period', 'schedule', 'block']],
  ['duration', ['duration', 'length', 'minutes', 'mins', 'min']],
  ['room', ['room', 'location', 'venue', 'place', 'where', 'space', 'roomnumber', 'roomno', 'classroom', 'roomname']],
  ['track', ['track', 'strand', 'stream', 'theme', 'category', 'subject', 'focus', 'area', 'division', 'pathway']],
  ['speakers', ['speaker', 'speakers', 'presenter', 'presenters', 'facilitator', 'facilitators', 'host', 'hosts', 'leader', 'leaders', 'instructor', 'teacher', 'presentedby', 'ledby', 'who', 'presentername', 'speakername']],
  ['speakerTitle', ['speakertitle', 'position', 'jobtitle', 'presentertitle', 'role']],
  ['speakerOrg', ['organisation', 'organization', 'org', 'school', 'company', 'affiliation', 'institution', 'presenterschool']],
  ['capacity', ['capacity', 'seats', 'max', 'maxattendees', 'maxparticipants', 'limit', 'size', 'spots', 'cap', 'maximum']],
];
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The row that names the columns: the first with several cells that read like headings. */
export function findHeaderRow(rows: string[][]): number {
  let best = 0, bestScore = -1;
  rows.slice(0, 15).forEach((row, i) => {
    const cells = row.filter((c) => c.trim());
    if (cells.length < 2) return;
    const hits = row.filter((c) => SYNONYMS.some(([, words]) => words.includes(squash(c)))).length;
    const score = hits * 3 + (cells.every((c) => c.length < 40) ? 1 : 0);
    if (hits > 0 && score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

/** Which column means what. Exact names first, then names that contain one; each meaning once. */
export function guessMapping(headers: string[]): Target[] {
  const out: Target[] = headers.map(() => 'ignore');
  const taken = new Set<Target>();
  const assign = (exact: boolean) => headers.forEach((h, i) => {
    if (out[i] !== 'ignore' || !h.trim()) return;
    const k = squash(h);
    for (const [target, words] of SYNONYMS) {
      if (taken.has(target)) continue;
      if (exact ? words.includes(k) : words.some((w) => w.length >= 4 && k.includes(w))) { out[i] = target; taken.add(target); return; }
    }
  });
  assign(true); assign(false);
  return out;
}

// ------------------------------------------------------------------ cells
/** "9", "9:30", "0930", "9.30", "9am", "noon", "2026-10-16 09:00" */
export function readClock(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t === 'noon' || t === 'midday') return '12:00';
  const stamped = /(\d{1,2}:\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(t);
  if (/^\d{4}-\d{2}-\d{2} /.test(t) && stamped) return parseClock(`${stamped[1]}${stamped[2] ?? ''}`);
  return parseClock(t.replace(/(\d):(\d{2}):\d{2}/, '$1:$2'));
}

/** "9:00-10:00", "9–10am", "1:30 - 2:45 PM", "09:00~10:00", "9 to 10" */
export function readRange(raw: string): { start: string; end: string } | null {
  const parts = raw.trim().toLowerCase().split(/\s*(?:-|–|—|~|→|\bto\b|\buntil\b)\s*/).filter(Boolean);
  if (parts.length !== 2) return null;
  const mer = (s: string) => /(am|pm|a|p)$/.exec(s.trim())?.[1]?.[0];
  let [a, b] = parts; const ma = mer(a), mb = mer(b);
  if (!ma && mb) { // "1-2pm": the start shares the end's half of the day unless that puts it after the end
    const same = readClock(`${a}${mb === 'p' ? 'pm' : 'am'}`), end = readClock(b);
    if (same && end && toMinutes(same) <= toMinutes(end)) a = `${a}${mb === 'p' ? 'pm' : 'am'}`; else if (mb === 'p') a = `${a}am`;
  }
  const start = readClock(a), end = readClock(b);
  return start && end ? { start, end } : null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ymd = (y: number, m: number, d: number) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};

/** A day, however it was written; without a year it takes the event's. */
export function readDate(raw: string, event: Pick<Event, 'startDate' | 'endDate'>): string | null {
  const t = raw.trim(); if (!t) return null;
  const year = Number(event.startDate.slice(0, 4));
  const iso = parseYmd(t.split(' ')[0]); if (iso) return iso;
  let m = /^day\s*(\d+)$/i.exec(t);
  if (m) return eachDate(event.startDate, event.endDate)[Number(m[1]) - 1] ?? null;
  m = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/.exec(t);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]); const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : year;
    const dm = ymd(y, b, a), md = ymd(y, a, b);
    const inside = (d: string | null) => Boolean(d && d >= event.startDate && d <= event.endDate);
    if (a > 12) return dm; if (b > 12) return md;
    return inside(dm) ? dm : inside(md) ? md : dm;
  }
  m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
  if (m) return ymd(year, Number(m[1]), Number(m[2]));
  const words = t.toLowerCase().replace(/,/g, ' ').split(/\s+/);
  const mi = words.findIndex((w) => MONTHS.includes(w.slice(0, 3)) && /^[a-z]+\.?$/.test(w));
  if (mi >= 0) {
    const month = MONTHS.indexOf(words[mi].slice(0, 3)) + 1;
    const nums = words.filter((w) => /^\d+(st|nd|rd|th)?$/.test(w)).map((w) => parseInt(w, 10));
    const day = nums.find((n) => n >= 1 && n <= 31); const y = nums.find((n) => n > 1900) ?? year;
    if (day) return ymd(y, month, day);
  }
  return null;
}

export function inferType(cell: string, title: string): SessionType {
  const s = `${cell} ${title}`.toLowerCase();
  if (/\b(keynote|plenary|opening|closing ceremony)\b/.test(s)) return 'keynote';
  if (/\b(workshop|hands-on|lab|studio)\b/.test(s)) return 'workshop';
  if (/\b(panel|job.?alike|roundtable|round table|discussion|forum)\b/.test(s)) return 'panel';
  if (/\b(break|lunch|coffee|recess|transition|tea|snack)\b/.test(s)) return 'break';
  if (/\b(social|reception|registration|networking|dinner|mixer)\b/.test(s)) return 'social';
  return 'talk';
}

/** "A / B", "A & B", "A and B", one per line — outside brackets — as "A; B". */
function readSpeakers(raw: string): Speaker[] {
  let depth = 0, out = '';
  for (const ch of raw) {
    if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1);
    out += depth === 0 && (ch === '/' || ch === '&' || ch === '\n') ? ';' : ch;
  }
  return parseSpeakers(out.replace(/\s+and\s+/gi, (m, off: number) => (out.slice(0, off).split('(').length === out.slice(0, off).split(')').length ? ';' : m)));
}

// ------------------------------------------------------------------ rows
export interface DraftRow {
  line: number;
  title: string; abstract: string; type: SessionType;
  date: string | null; start: string | null; end: string | null;
  room: string; track: string; speakers: Speaker[]; capacity: number;
  email: string;
  problems: string[];
}

export function buildDrafts(rows: string[][], headerRow: number, mapping: Target[], event: Event): DraftRow[] {
  const col = (t: Target) => mapping.indexOf(t);
  const cell = (r: string[], t: Target) => { const i = col(t); return i >= 0 ? (r[i] ?? '').trim() : ''; };
  const oneDay = event.startDate === event.endDate;
  return rows.slice(headerRow + 1).map((r, idx) => {
    const problems: string[] = [];
    const title = cell(r, 'title');
    if (!title) problems.push('no title');
    let start = cell(r, 'start') ? readClock(cell(r, 'start')) : null;
    let end = cell(r, 'end') ? readClock(cell(r, 'end')) : null;
    const range = cell(r, 'time') ? readRange(cell(r, 'time')) : null;
    if (range) { start = start ?? range.start; end = end ?? range.end; }
    else if (cell(r, 'time') && !start) start = readClock(cell(r, 'time'));
    const mins = parseInt(cell(r, 'duration'), 10);
    if (start && !end && Number.isFinite(mins) && mins > 0) end = fromMinutes(Math.min(toMinutes(start) + mins, 23 * 60 + 59));
    if (!start) problems.push(cell(r, 'start') || cell(r, 'time') ? `start time "${cell(r, 'start') || cell(r, 'time')}" unreadable` : 'no start time');
    else if (!end) problems.push('no end time');
    else if (toMinutes(end) <= toMinutes(start)) problems.push('ends before it starts');
    const dateCell = cell(r, 'date') || (/^\d{4}-\d{2}-\d{2} /.test(cell(r, 'start')) ? cell(r, 'start') : '');
    const date = dateCell ? readDate(dateCell, event) : oneDay ? event.startDate : null;
    if (dateCell && !date) problems.push(`day "${dateCell}" unreadable`);
    const speakers = readSpeakers(cell(r, 'speakers'));
    if (speakers.length === 1) { speakers[0] = { ...speakers[0], title: speakers[0].title ?? (cell(r, 'speakerTitle') || undefined), org: speakers[0].org ?? (cell(r, 'speakerOrg') || undefined) }; }
    const capacity = parseInt(cell(r, 'capacity').replace(/[^\d]/g, ''), 10);
    return {
      line: headerRow + idx + 2, title, abstract: cell(r, 'abstract'), type: inferType(cell(r, 'type'), title),
      date, start, end, room: cell(r, 'room'), track: cell(r, 'track'), speakers,
      capacity: Number.isFinite(capacity) ? capacity : 0, email: cell(r, 'email').toLowerCase(), problems,
    };
  }).filter((d) => d.title || d.start || d.room || d.email);
}

/** A sheet of addresses rather than sessions. */
export const looksLikePeople = (mapping: Target[]) => mapping.includes('email') && !mapping.includes('start') && !mapping.includes('time');
