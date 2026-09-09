import { Session, UserProfile } from '../types';

/**
 * Badge QR payloads and print sizing.
 *
 * The QR is deliberately dynamic. A badge that encodes only "who" makes the
 * door scanner ask which session it is standing at; a badge that also encodes
 * "what this person is booked into right now" lets a scan resolve the session
 * on its own. The holder's screen re-renders as the day moves, so the code in
 * front of the scanner is always the current one.
 *
 * Printed cards are the exception and say so: paper cannot change at 11am, so a
 * printed QR carries identity only and the scanner supplies the session.
 */

export const BADGE_PAYLOAD_VERSION = 1;

export interface BadgePayload {
  /** Marks this as ours, so a scanner can reject unrelated QR codes. */
  t: 'ci-badge';
  v: number;
  /** Who. */
  uid: string;
  /** Which event they are attending. */
  evt: string;
  /** The session they are booked into at scan time, when there is one. */
  sid?: string;
  /** 'live' re-reads the clock; 'print' is a static card. */
  mode: 'live' | 'print';
  /** Minute the code was generated, so a stale screenshot is detectable. */
  at?: number;
}

/**
 * The session this person is booked into around `minutes`.
 *
 * Includes a grace window before the start, because people scan in as they
 * arrive rather than on the hour, and a door queue at 08:55 for a 09:00 session
 * should still resolve to that session.
 */
export function currentSessionFor(
  user: UserProfile,
  sessions: Session[],
  minutes: number,
  day: number,
  graceMinutes = 20,
): Session | undefined {
  const booked = sessions
    .filter((s) => s.day === day && s.reservedUserIds.includes(user.id))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return (
    booked.find((s) => minutes >= s.startMinutes - graceMinutes && minutes < s.endMinutes)
    // Nothing running: point at their next one, so an early arrival still
    // scans into something sensible.
    ?? booked.find((s) => s.startMinutes > minutes)
  );
}

export function buildBadgePayload(
  user: UserProfile,
  eventId: string,
  session: Session | undefined,
  mode: 'live' | 'print',
): string {
  const payload: BadgePayload = {
    t: 'ci-badge',
    v: BADGE_PAYLOAD_VERSION,
    uid: user.id,
    evt: eventId,
    mode,
    ...(session ? { sid: session.id } : {}),
    ...(mode === 'live' ? { at: Math.floor(Date.now() / 60000) } : {}),
  };
  return JSON.stringify(payload);
}

/** Parses a scanned code, returning null for anything that is not ours. */
export function parseBadgePayload(raw: string): BadgePayload | null {
  try {
    const parsed = JSON.parse(raw) as BadgePayload;
    return parsed?.t === 'ci-badge' ? parsed : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ printing */

export interface LanyardSize {
  id: string;
  label: string;
  /** Inches. */
  width: number;
  height: number;
  note: string;
}

/**
 * Real insert sizes, because a badge printed to the wrong dimensions is
 * useless — it either rattles in the holder or will not go in.
 */
export const LANYARD_SIZES: LanyardSize[] = [
  {
    id: 'cr80-portrait',
    label: 'CR80 portrait',
    width: 2.125, height: 3.375,
    note: 'Standard ID-card size. The most common rigid holder.',
  },
  {
    id: 'cr80-landscape',
    label: 'CR80 landscape',
    width: 3.375, height: 2.125,
    note: 'Same card turned sideways, for horizontal holders.',
  },
  {
    id: 'a7',
    label: 'A7 portrait',
    width: 2.91, height: 4.13,
    note: 'Common European insert. Slightly taller than CR80.',
  },
  {
    id: 'conference-35',
    label: '3.5 × 5.5 in',
    width: 3.5, height: 5.5,
    note: 'Large conference insert. Most room for sessions and QR.',
  },
  {
    id: 'a6',
    label: 'A6 portrait',
    width: 4.13, height: 5.83,
    note: 'Largest common insert. Reads from a distance.',
  },
  {
    id: 'conference-46',
    label: '4 × 6 in',
    width: 4, height: 6,
    note: 'US conference insert. Fits 4×6 badge holders.',
  },
];

/**
 * Type scale for a given card size.
 *
 * A CR80 card is a third the area of a 4×6, so a fixed layout either wastes
 * the large card or overflows the small one. Everything is expressed relative
 * to card width, which keeps the proportions identical across sizes.
 */
export function badgeScale(size: LanyardSize) {
  const w = size.width;
  return {
    /** Largest first-name size that still fits the card, in inches. */
    firstNameMax: w * 0.30,
    qr: Math.min(w * 0.42, size.height * 0.22),
    padding: w * 0.055,
    bandFont: Math.max(5, w * 2.1),
    metaFont: Math.max(5, w * 2.4),
    /** Small cards cannot carry a session list without becoming unreadable. */
    showSessions: size.width >= 3.4 && size.height >= 5,
    showDietary: size.height >= 3.3,
  };
}
