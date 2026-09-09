import {
  EventConfig, Session, Room, Track, UserProfile, AttendanceRecord, FeedbackEntry,
  eventStatus,
} from '../types';

/**
 * What an organiser can actually learn from a run of events.
 *
 * Every figure is derived and every one is answerable: nothing here is a
 * number chosen because it was easy to compute. The questions are the ones
 * asked while planning the next programme — did people come, what drew them,
 * who comes back, and were the rooms the right size.
 *
 * Sample events are excluded throughout. An average show rate that includes
 * fabricated attendance is worse than no average at all, because it looks like
 * evidence.
 */

export interface EventStats {
  event: EventConfig;
  sessions: number;
  /** Reservations across the event's sessions. */
  booked: number;
  /** Distinct people who scanned into at least one session. */
  people: number;
  /** Scans, which exceed people when somebody attends several sessions. */
  attendances: number;
  /** Of the seats booked, how many were used. Null when nothing was booked. */
  showRate: number | null;
}

export interface SessionStats {
  session: Session;
  room?: Room;
  track?: Track;
  booked: number;
  attended: number;
  capacity: number;
  /** Attendance against the room, which is what makes a room the wrong size. */
  fill: number;
}

export interface Analytics {
  /** True when there is nothing real to report on yet. */
  empty: boolean;
  eventsRun: number;
  uniquePeople: number;
  totalAttendances: number;
  averageShowRate: number | null;
  averageRating: number | null;
  byEvent: EventStats[];
  bestAttended: SessionStats[];
  worstAttended: SessionStats[];
  /** Rooms that were badly matched to demand, in either direction. */
  roomMismatches: SessionStats[];
  /** How many people attended 1 event, 2 events, and so on. */
  returning: { events: number; people: number }[];
  /** Where attendees came from, biggest first. */
  organisations: { name: string; people: number }[];
  /** Attendance per strand, for judging whether the programme was balanced. */
  byTrack: { track: Track; attended: number; sessions: number }[];
}

export function buildAnalytics(input: {
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  tracks: Track[];
  users: UserProfile[];
  attendance: AttendanceRecord[];
  feedback: FeedbackEntry[];
}): Analytics {
  const { sessions, rooms, tracks, users, attendance, feedback } = input;

  // Real, and already happened. An event still to come has no attendance and
  // would drag every average towards zero.
  const events = input.events.filter(
    (e) => !e.isTemplate && eventStatus(e) === 'past');
  const eventIds = new Set(events.map((e) => e.id));
  const relevantSessions = sessions.filter((s) => eventIds.has(s.eventId));
  const sessionById = new Map(relevantSessions.map((s) => [s.id, s]));
  const records = attendance.filter((a) => sessionById.has(a.sessionId));

  const byEvent: EventStats[] = events.map((event) => {
    const own = relevantSessions.filter((s) => s.eventId === event.id);
    const ownIds = new Set(own.map((s) => s.id));
    const rows = records.filter((a) => ownIds.has(a.sessionId));
    const booked = own.reduce((n, s) => n + s.reservedUserIds.length, 0);
    return {
      event,
      sessions: own.length,
      booked,
      people: new Set(rows.map((a) => a.userId)).size,
      attendances: rows.length,
      showRate: booked > 0 ? Math.round((rows.length / booked) * 100) : null,
    };
  })
    // An event with nothing booked and nobody scanned has no attendance story
    // to tell, and listing it at 0% reads as a failure rather than as silence.
    .filter((e) => e.booked > 0 || e.attendances > 0)
    .sort((a, b) => b.event.startDate.localeCompare(a.event.startDate));

  const sessionStats: SessionStats[] = relevantSessions.map((session) => {
    const room = rooms.find((r) => r.id === session.roomId);
    const attended = records.filter((a) => a.sessionId === session.id).length;
    const capacity = room?.capacity ?? session.maxAttendees ?? 0;
    return {
      session,
      room,
      track: tracks.find((t) => t.id === session.trackId),
      booked: session.reservedUserIds.length,
      attended,
      capacity,
      fill: capacity > 0 ? attended / capacity : 0,
    };
  }).filter((s) => s.attended > 0 || s.booked > 0);

  const ranked = [...sessionStats].sort((a, b) => b.attended - a.attended);

  // Counted per person across events, which is the only way to see whether the
  // same forty people come to everything or a new audience arrives each time.
  const eventsPerPerson = new Map<string, Set<string>>();
  for (const record of records) {
    const eventId = sessionById.get(record.sessionId)!.eventId;
    if (!eventsPerPerson.has(record.userId)) eventsPerPerson.set(record.userId, new Set());
    eventsPerPerson.get(record.userId)!.add(eventId);
  }
  const returningCounts = new Map<number, number>();
  for (const attended of eventsPerPerson.values()) {
    returningCounts.set(attended.size, (returningCounts.get(attended.size) ?? 0) + 1);
  }

  const orgCounts = new Map<string, Set<string>>();
  for (const userId of eventsPerPerson.keys()) {
    const org = users.find((u) => u.id === userId)?.organization?.trim();
    if (!org) continue;
    if (!orgCounts.has(org)) orgCounts.set(org, new Set());
    orgCounts.get(org)!.add(userId);
  }

  const trackTotals = tracks.map((track) => {
    const own = sessionStats.filter((s) => s.track?.id === track.id);
    return {
      track,
      sessions: own.length,
      attended: own.reduce((n, s) => n + s.attended, 0),
    };
  }).filter((t) => t.sessions > 0).sort((a, b) => b.attended - a.attended);

  const rated = feedback.filter((f) => f.rating > 0);
  const withRate = byEvent.filter((e) => e.showRate !== null);

  return {
    empty: events.length === 0 || records.length === 0,
    eventsRun: events.length,
    uniquePeople: eventsPerPerson.size,
    totalAttendances: records.length,
    averageShowRate: withRate.length
      ? Math.round(withRate.reduce((n, e) => n + (e.showRate ?? 0), 0) / withRate.length)
      : null,
    averageRating: rated.length
      ? Math.round((rated.reduce((n, f) => n + f.rating, 0) / rated.length) * 10) / 10
      : null,
    byEvent,
    bestAttended: ranked.slice(0, 6),
    worstAttended: ranked.filter((s) => s.booked > 0).slice(-5).reverse(),
    // Half-empty in a big room, or over capacity in a small one. Both are a
    // room decision to make differently next time.
    roomMismatches: sessionStats
      .filter((s) => s.capacity > 0 && (s.fill < 0.35 || s.fill > 1))
      .sort((a, b) => Math.abs(b.fill - 0.7) - Math.abs(a.fill - 0.7))
      .slice(0, 5),
    returning: [...returningCounts.entries()]
      .map(([events, people]) => ({ events, people }))
      .sort((a, b) => a.events - b.events),
    organisations: [...orgCounts.entries()]
      .map(([name, people]) => ({ name, people: people.size }))
      .sort((a, b) => b.people - a.people)
      .slice(0, 8),
    byTrack: trackTotals,
  };
}
