import { Session } from './types';
import { toMinutes } from './time';

/** Sessions in programme order: date, start, then title. */
export const byStart = (a: Session, b: Session) =>
  a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start) || a.title.localeCompare(b.title);

/** The distinct time slots of one day, each with the sessions starting then. */
export function slotsForDay(sessions: Session[], date: string): { start: string; end: string; sessions: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions.filter((x) => x.date === date).sort(byStart)) {
    const key = s.start;
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()].map(([start, list]) => ({
    start,
    end: list.reduce((latest, s) => (toMinutes(s.end) > toMinutes(latest) ? s.end : latest), list[0].end),
    sessions: list,
  }));
}

export const overlaps = (a: Session, b: Session) =>
  a.date === b.date && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

/** Sessions this person holds a seat in that clash with the given one. */
export const clashesFor = (session: Session, mine: Session[]) =>
  mine.filter((m) => m.id !== session.id && overlaps(m, session));

export type SeatState = 'open' | 'reserved' | 'waitlisted' | 'full' | 'unlimited';

export function seatState(s: Session, userId: string | null): SeatState {
  if (s.capacity === 0) return 'unlimited';
  if (userId && s.reservedUserIds.includes(userId)) return 'reserved';
  if (userId && s.waitlistUserIds.includes(userId)) return 'waitlisted';
  return s.reservedUserIds.length >= s.capacity ? 'full' : 'open';
}

/** The next reservation state after somebody taps the seat button, and the
 *  arrays to write. Cancelling a seat promotes the first person waiting. */
export function toggleSeat(s: Session, userId: string): Pick<Session, 'reservedUserIds' | 'waitlistUserIds'> {
  const reserved = [...s.reservedUserIds];
  const waitlist = [...s.waitlistUserIds];
  if (reserved.includes(userId)) {
    reserved.splice(reserved.indexOf(userId), 1);
    if (waitlist.length > 0 && s.capacity > 0) reserved.push(waitlist.shift()!);
  } else if (waitlist.includes(userId)) {
    waitlist.splice(waitlist.indexOf(userId), 1);
  } else if (s.capacity === 0 || reserved.length < s.capacity) {
    reserved.push(userId);
  } else {
    waitlist.push(userId);
  }
  return { reservedUserIds: reserved, waitlistUserIds: waitlist };
}

/** Distinct speakers across a programme, with the sessions each gives. */
export function speakerIndex(sessions: Session[]): { name: string; title?: string; org?: string; sessions: Session[] }[] {
  const map = new Map<string, { name: string; title?: string; org?: string; sessions: Session[] }>();
  for (const s of sessions) {
    for (const sp of s.speakers) {
      const key = sp.name.trim().toLowerCase();
      if (!key) continue;
      const entry = map.get(key) ?? { name: sp.name.trim(), title: sp.title, org: sp.org, sessions: [] };
      entry.sessions.push(s);
      if (!entry.title && sp.title) entry.title = sp.title;
      if (!entry.org && sp.org) entry.org = sp.org;
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
