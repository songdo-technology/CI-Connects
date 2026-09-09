import { Session, Room, Track, ScheduleSlot } from '../types';

/**
 * Placing approved proposals onto the timetable.
 *
 * An organiser doing this by hand is holding four constraints at once — a room
 * cannot host two sessions, a speaker cannot be in two rooms, a room must be
 * big enough, and the strands should not clump so that everyone interested in
 * Leadership has to choose between three talks in one slot and none after
 * lunch. Three of those are checkable; the fourth is the one people get wrong,
 * because it is invisible until the programme is printed.
 *
 * This proposes. It does not commit: the result is a preview an organiser
 * accepts, edits or discards, for the same reason the importer works that way.
 * A timetable is a judgement, and the machine is better at the arithmetic than
 * at the judgement.
 */

export interface Placement {
  sessionId: string;
  day: number;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  /** Why this slot, in the organiser's terms. */
  rationale: string;
}

export interface Unplaced {
  sessionId: string;
  reason: string;
}

export interface ScheduleResult {
  placements: Placement[];
  unplaced: Unplaced[];
  /** Things that are legal but worth a second look. */
  warnings: string[];
}

interface Occupancy {
  /** roomId -> set of "day:start" keys already taken. */
  rooms: Map<string, Set<string>>;
  /** speakerId -> set of "day:start" keys already taken. */
  speakers: Map<string, Set<string>>;
  /** "day:start" -> trackIds already running in that slot. */
  slotTracks: Map<string, string[]>;
  /** trackId -> how many sessions of that strand are placed on each day. */
  trackDays: Map<string, Map<number, number>>;
}

const slotKey = (day: number, startMinutes: number) => `${day}:${startMinutes}`;

function buildOccupancy(scheduled: Session[]): Occupancy {
  const occ: Occupancy = {
    rooms: new Map(), speakers: new Map(), slotTracks: new Map(), trackDays: new Map(),
  };
  for (const s of scheduled) {
    const key = slotKey(s.day, s.startMinutes);
    if (!occ.rooms.has(s.roomId)) occ.rooms.set(s.roomId, new Set());
    occ.rooms.get(s.roomId)!.add(key);
    for (const speaker of s.speakerIds) {
      if (!occ.speakers.has(speaker)) occ.speakers.set(speaker, new Set());
      occ.speakers.get(speaker)!.add(key);
    }
    occ.slotTracks.set(key, [...(occ.slotTracks.get(key) ?? []), s.trackId]);
    if (!occ.trackDays.has(s.trackId)) occ.trackDays.set(s.trackId, new Map());
    const days = occ.trackDays.get(s.trackId)!;
    days.set(s.day, (days.get(s.day) ?? 0) + 1);
  }
  return occ;
}

/**
 * How good a given room-and-slot is for a session. Higher is better.
 *
 * Hard constraints are handled before scoring — anything reaching here is
 * legal, and the score only decides which legal option is best.
 */
function score(
  session: Session, room: Room, slot: ScheduleSlot, occ: Occupancy, totalDays: number,
): { value: number; notes: string[] } {
  const notes: string[] = [];
  let value = 0;
  const key = slotKey(slot.day, slot.startMinutes);

  // Strand spread within the slot. The heaviest term, because a slot with two
  // Leadership talks forces a choice nobody should have to make and leaves
  // another slot with none.
  const sameTrackHere = (occ.slotTracks.get(key) ?? []).filter((t) => t === session.trackId).length;
  value -= sameTrackHere * 40;
  if (sameTrackHere === 0) notes.push('no clash of strand in this slot');

  // Strand spread across days, so a strand is not all on Friday.
  const perDay = occ.trackDays.get(session.trackId);
  const onThisDay = perDay?.get(slot.day) ?? 0;
  const busiest = perDay ? Math.max(...[...perDay.values()], 0) : 0;
  if (totalDays > 1 && onThisDay < busiest) {
    value += 15;
    notes.push('balances the strand across days');
  }
  value -= onThisDay * 5;

  // Room fit. A twenty-person workshop in the six-hundred-seat theatre reads
  // as a failure to the twenty people in it, and denies the room to something
  // that needed it.
  const needed = session.maxAttendees || 0;
  if (needed > 0) {
    const slack = room.capacity - needed;
    if (slack < 0) return { value: -Infinity, notes: ['room is too small'] };
    // Best fit is the smallest room that still works.
    value -= Math.min(slack, 300) * 0.15;
    if (slack <= room.capacity * 0.35) notes.push('room is a close fit');
  }

  return { value, notes };
}

export function scheduleProposals(input: {
  /** Already on the timetable. Treated as fixed. */
  scheduled: Session[];
  /** Approved and awaiting a slot. */
  proposals: Session[];
  rooms: Room[];
  slots: ScheduleSlot[];
  tracks: Track[];
}): ScheduleResult {
  const { scheduled, proposals, rooms, slots } = input;
  const occ = buildOccupancy(scheduled);
  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];
  const warnings: string[] = [];

  if (rooms.length === 0) return { placements, unplaced: proposals.map((p) => ({ sessionId: p.id, reason: 'No rooms defined.' })), warnings };
  if (slots.length === 0) return { placements, unplaced: proposals.map((p) => ({ sessionId: p.id, reason: 'No time slots defined.' })), warnings };

  const totalDays = new Set(slots.map((s) => s.day)).size;

  // Hardest first. A session needing 200 seats has few homes; placing it after
  // the flexible ones would leave it with none, which is how greedy scheduling
  // fails when it processes in arbitrary order.
  const ordered = [...proposals].sort((a, b) => (b.maxAttendees || 0) - (a.maxAttendees || 0));

  for (const session of ordered) {
    let best: { placement: Placement; value: number } | null = null;

    for (const slot of slots) {
      if (session.unavailableDays?.includes(slot.day)) continue;
      const key = slotKey(slot.day, slot.startMinutes);

      // A speaker cannot be in two rooms at once. Checked before rooms,
      // because it rules out the whole slot rather than one room in it.
      const speakerBusy = session.speakerIds.some((id) => occ.speakers.get(id)?.has(key));
      if (speakerBusy) continue;

      for (const room of rooms) {
        if (occ.rooms.get(room.id)?.has(key)) continue;

        const { value, notes } = score(session, room, slot, occ, totalDays);
        if (value === -Infinity) continue;

        if (!best || value > best.value) {
          best = {
            value,
            placement: {
              sessionId: session.id,
              day: slot.day,
              roomId: room.id,
              startMinutes: slot.startMinutes,
              endMinutes: slot.endMinutes,
              rationale: notes.length ? notes.join('; ') : 'first free room in this slot',
            },
          };
        }
      }
    }

    if (!best) {
      const tooBig = session.maxAttendees > Math.max(...rooms.map((r) => r.capacity));
      unplaced.push({
        sessionId: session.id,
        reason: tooBig
          ? `Needs ${session.maxAttendees} seats; the largest room holds `
            + `${Math.max(...rooms.map((r) => r.capacity))}.`
          : 'Every slot is either full or clashes with this speaker.',
      });
      continue;
    }

    placements.push(best.placement);

    // Fold the decision into the occupancy so later sessions see it. Without
    // this the scheduler would happily put four talks in the same room.
    const key = slotKey(best.placement.day, best.placement.startMinutes);
    if (!occ.rooms.has(best.placement.roomId)) occ.rooms.set(best.placement.roomId, new Set());
    occ.rooms.get(best.placement.roomId)!.add(key);
    for (const speaker of session.speakerIds) {
      if (!occ.speakers.has(speaker)) occ.speakers.set(speaker, new Set());
      occ.speakers.get(speaker)!.add(key);
    }
    occ.slotTracks.set(key, [...(occ.slotTracks.get(key) ?? []), session.trackId]);
    if (!occ.trackDays.has(session.trackId)) occ.trackDays.set(session.trackId, new Map());
    const days = occ.trackDays.get(session.trackId)!;
    days.set(best.placement.day, (days.get(best.placement.day) ?? 0) + 1);
  }

  // Balance is reported, not enforced. An organiser may have a good reason for
  // a lopsided day, and refusing to schedule would be the wrong response.
  for (const [trackId, days] of occ.trackDays) {
    const counts = [...days.values()];
    if (counts.length > 1 && Math.max(...counts) - Math.min(...counts) >= 3) {
      const name = input.tracks.find((t) => t.id === trackId)?.name ?? 'A strand';
      warnings.push(`${name} is unevenly spread across the days (${counts.join(' vs ')}).`);
    }
  }
  for (const [key, trackIds] of occ.slotTracks) {
    const dupes = trackIds.filter((t, i) => trackIds.indexOf(t) !== i);
    if (dupes.length > 0) {
      const [day, start] = key.split(':');
      const name = input.tracks.find((t) => t.id === dupes[0])?.name ?? 'a strand';
      warnings.push(
        `Day ${day} at ${Math.floor(Number(start) / 60)}:${String(Number(start) % 60).padStart(2, '0')} `
        + `has more than one ${name} session — attendees must choose between them.`);
    }
  }

  return { placements, unplaced, warnings };
}

/**
 * The slots a programme already uses.
 *
 * Derived from what is scheduled rather than configured separately: an event
 * with a fixed keynote at 09:00 and breakouts at 11:00 has already declared
 * its shape, and asking an organiser to restate it is how the two drift apart.
 */
export function inferSlots(sessions: Session[]): ScheduleSlot[] {
  const seen = new Map<string, ScheduleSlot>();
  for (const s of sessions) {
    const key = slotKey(s.day, s.startMinutes);
    if (!seen.has(key)) {
      seen.set(key, { day: s.day, startMinutes: s.startMinutes, endMinutes: s.endMinutes });
    }
  }
  return [...seen.values()].sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes);
}
