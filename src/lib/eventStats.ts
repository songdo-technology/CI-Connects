import { EventConfig, Session, eventStatus } from '../types';

/**
 * The numbers on the front page, derived rather than typed in.
 *
 * Every figure here comes from the events themselves, so the hero cannot drift
 * away from the catalogue underneath it. A hand-written "500+ attendees" is
 * wrong the moment somebody adds an event, and nobody ever remembers to go and
 * change it.
 *
 * Two of these must not be summed, which is the whole reason this file exists
 * rather than a `.reduce()` at the call site:
 *
 *  - Countries and schools OVERLAP between events. The same eight Korean
 *    schools attend three things a year; adding those columns would claim
 *    twenty-four. We take the maximum instead, which is a true lower bound —
 *    "at least this many have been represented" — and never overstates.
 *  - Attendees are counted per event on purpose. Somebody who came to two
 *    events was welcomed twice, and "attendees welcomed" is the honest name
 *    for that. It is not a count of distinct people, and must not be labelled
 *    as one.
 */

export interface HeroStat {
  key: string;
  value: string;
  label: string;
  /** Shown under the number where the figure needs a caveat to be honest. */
  note?: string;
}

/**
 * Reads a count out of an outcome value.
 *
 * Outcomes are free text because organisers write them: "210", "40+",
 * "Designing for AGENCY", "4.6", "100%". Only plain counts are usable, so a
 * percentage, a rating or a phrase returns null rather than a wrong number.
 */
function asCount(raw: string): number | null {
  const value = raw.trim();
  if (!value || value.includes('%') || value.includes('.')) return null;
  const match = value.match(/^(\d[\d,]*)\+?$/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Every outcome and recap highlight an event carries, as one list. */
function figuresOf(event: EventConfig): { label: string; value: string }[] {
  return [...(event.outcomes ?? []), ...(event.recap?.highlights ?? [])];
}

/** Sums a matching figure across events. Each event contributes at most once,
 *  since outcomes and recap highlights usually repeat the same number. */
function sumAcross(events: EventConfig[], match: RegExp): number {
  return events.reduce((total, e) => {
    const hit = figuresOf(e).find((f) => match.test(f.label));
    return total + (hit ? asCount(hit.value) ?? 0 : 0);
  }, 0);
}

/** The largest single-event figure. Used where the sets overlap. */
function maxAcross(events: EventConfig[], match: RegExp): number {
  return events.reduce((best, e) => {
    const hit = figuresOf(e).find((f) => match.test(f.label));
    const n = hit ? asCount(hit.value) : null;
    return n !== null && n > best ? n : best;
  }, 0);
}

const format = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function heroStats(events: EventConfig[], sessions: Session[]): HeroStat[] {
  const past = events.filter((e) => eventStatus(e) === 'past');
  const upcoming = events.filter((e) => eventStatus(e) !== 'past');

  const attendees = sumAcross(past, /attendee|educator|participant|colleague|places/i);
  const countries = maxAcross(past, /countr/i);
  const organisations = maxAcross(past, /school|organisation|organization/i);
  // Sessions actually recorded in the programme beat a claimed figure, but
  // past events are landing pages without one, so fall back to their outcomes.
  const sessionCount = sumAcross(past, /session/i) || sessions.length;

  const stats: HeroStat[] = [];

  if (past.length) {
    stats.push({ key: 'hosted', value: String(past.length), label: 'Events hosted' });
  }
  if (attendees) {
    stats.push({
      key: 'attendees',
      value: `${format(attendees)}+`,
      label: 'Attendees welcomed',
      note: 'across all events',
    });
  }
  if (countries) {
    stats.push({ key: 'countries', value: `${countries}`, label: 'Countries represented' });
  }
  if (organisations) {
    stats.push({ key: 'schools', value: `${organisations}`, label: 'Schools and partners' });
  }
  if (sessionCount) {
    stats.push({ key: 'sessions', value: `${format(sessionCount)}`, label: 'Sessions delivered' });
  }
  if (upcoming.length) {
    stats.push({ key: 'upcoming', value: String(upcoming.length), label: 'Coming up next' });
  }

  return stats;
}
