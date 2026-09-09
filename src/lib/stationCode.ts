/**
 * The code a check-in station displays for people to scan themselves in with.
 *
 * The reverse of pointing a camera at a badge, and better in several real
 * situations: an iPad on a stand has a poor rear camera, a queue moves faster
 * when everyone uses their own phone, and a screen already beside a session
 * door can show this without any device being bought.
 *
 * The person's own phone does the authenticating — they follow the link,
 * they are already signed in, and the platform records them. Nothing is
 * trusted from the station itself.
 *
 * The code rotates, because the alternative is a poster somebody photographs
 * and shares with a colleague who never came. A window of a minute and a half
 * is long enough to scan from across a desk and short enough that a
 * photograph is worthless by the time it has been sent to anyone.
 */

const WINDOW_MS = 90_000;

const bucket = (at = Date.now()) => Math.floor(at / WINDOW_MS);

/** The token a station shows right now. */
export function stationToken(eventId: string, sessionId?: string): string {
  return [eventId, sessionId ?? '', bucket()].join('~');
}

export interface StationClaim {
  eventId: string;
  sessionId?: string;
}

/**
 * Reads a token, refusing one that is stale.
 *
 * The previous and next windows are accepted as well as the current one: a
 * scan can straddle a boundary, and a device whose clock is a few seconds out
 * is normal. That gives an effective life of between ninety seconds and four
 * and a half minutes, which is the honest cost of not requiring a server.
 */
export function readStationToken(raw: string): StationClaim | null {
  const parts = raw.split('~');
  if (parts.length !== 3) return null;
  const [eventId, sessionId, stamp] = parts;
  const at = Number(stamp);
  if (!eventId || !Number.isFinite(at)) return null;
  if (Math.abs(bucket() - at) > 1) return null;
  return { eventId, sessionId: sessionId || undefined };
}

/** Whether a token was well-formed but simply too old, so the difference can
 *  be explained rather than reported as an invalid code. */
export function isExpiredStationToken(raw: string): boolean {
  const parts = raw.split('~');
  if (parts.length !== 3) return false;
  const at = Number(parts[2]);
  return Number.isFinite(at) && Math.abs(bucket() - at) > 1;
}

export const stationUrl = (eventId: string, sessionId?: string): string =>
  `${typeof window === 'undefined' ? '' : window.location.origin}`
  + `/?checkin=${encodeURIComponent(stationToken(eventId, sessionId))}`;
