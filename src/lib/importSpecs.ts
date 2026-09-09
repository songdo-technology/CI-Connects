import {
  Room, Sponsor, SponsorTier, MealService, MealOption, Session, Track, UserProfile, Invite,
  UserRole, generateAccessCode, SPONSOR_TIER_ORDER,
} from '../types';
import { BatchOperation } from './data/store';
import { initialsAvatar } from './avatar';
import {
  FieldSpec, cell, parseCount, parseClock, formatClock, parseDate, sameName,
} from './csvImport';

/**
 * What each kind of spreadsheet means.
 *
 * One row can create several records: a session row also brings in the room it
 * is in, the track it belongs to and the person presenting it, because that is
 * how a programme is actually written down. Making the organiser import three
 * separate files and cross-reference them by hand is the work this replaces.
 *
 * Nothing here writes. Each row is turned into the operations it *would*
 * perform, which the preview shows and the organiser confirms.
 */

export interface ImportContext {
  eventId: string;
  rooms: Room[];
  tracks: Track[];
  sponsors: Sponsor[];
  users: UserProfile[];
  mealServices: MealService[];
  invites: Invite[];
  sessions: Session[];
  currentUserId: string;
  /** Records created by earlier rows in this same import, so two sessions in
   *  B-201 produce one room rather than two. */
  pending: Map<string, string>;
}

export interface RowResult {
  /** What the preview row reads as. */
  summary: string;
  detail?: string;
  problems: string[];
  /** Named when the row matches something already stored. */
  duplicateOf?: string;
  ops: BatchOperation[];
}

export interface ImportSpec {
  key: string;
  label: string;
  blurb: string;
  fields: FieldSpec[];
  template: string[][];
  build: (row: string[], map: Record<string, number>, ctx: ImportContext) => RowResult;
}

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------------------------------------------ rooms */

export const ROOM_SPEC: ImportSpec = {
  key: 'rooms',
  label: 'Rooms',
  blurb: 'Physical spaces. These outlive any one event, so importing them once '
    + 'makes every future programme a matter of naming a room rather than describing it.',
  fields: [
    { key: 'name', label: 'Name', aliases: ['room', 'space', 'location'], required: true },
    { key: 'capacity', label: 'Capacity', aliases: ['seats', 'max', 'size'], required: true },
    { key: 'floorLabel', label: 'Floor', aliases: ['level', 'where'] },
    { key: 'building', label: 'Building', aliases: ['block', 'wing'] },
  ],
  template: [
    ['Name', 'Capacity', 'Floor', 'Building'],
    ['Main Theater', '600', 'Ground floor', 'Arts Centre'],
    ['Black Box', '200', 'Ground floor', 'Arts Centre'],
    ['B-201', '25', 'Second floor', 'B Block'],
  ],
  build: (row, map, ctx) => {
    const name = cell(row, map.name);
    const capacity = parseCount(cell(row, map.capacity));
    const problems: string[] = [];
    if (!name) problems.push('No room name.');
    if (capacity === null) problems.push('Capacity is not a number.');

    const existing = ctx.rooms.find((r) => sameName(r.name, name));
    const item: Room = {
      id: existing?.id ?? id('room'),
      name,
      capacity: capacity ?? 0,
      floorLabel: cell(row, map.floorLabel) || existing?.floorLabel || '',
      ...(cell(row, map.building) ? { building: cell(row, map.building) } : {}),
    };

    return {
      summary: name || '(unnamed)',
      detail: capacity !== null ? `${capacity} seats` : undefined,
      problems,
      duplicateOf: existing ? `${existing.name} (${existing.capacity} seats)` : undefined,
      ops: problems.length ? [] : [{
        op: existing ? 'update' : 'create',
        key: 'rooms',
        ...(existing ? { id: existing.id, patch: item } : { item }),
      } as BatchOperation],
    };
  },
};

/* --------------------------------------------------------------- sponsors */

const TIER_ALIASES: Record<string, SponsorTier> = {
  host: 'Host', platinum: 'Platinum', gold: 'Gold',
  silver: 'Silver', bronze: 'Bronze', exhibitor: 'Exhibitor', exhibitors: 'Exhibitor',
};

export const SPONSOR_SPEC: ImportSpec = {
  key: 'sponsors',
  label: 'Sponsors',
  blurb: 'The sponsor library is shared across events, so a partner entered once '
    + 'can be placed on next year’s programme without being retyped.',
  fields: [
    { key: 'name', label: 'Name', aliases: ['company', 'organisation', 'partner'], required: true },
    { key: 'tier', label: 'Tier', aliases: ['level', 'package'], required: true,
      hint: SPONSOR_TIER_ORDER.join(', ') },
    { key: 'websiteUrl', label: 'Website', aliases: ['url', 'site', 'link'] },
    { key: 'logoUrl', label: 'Logo URL', aliases: ['logo', 'image'] },
    { key: 'tagline', label: 'Tagline', aliases: ['strapline', 'slogan'] },
    { key: 'description', label: 'Description', aliases: ['about', 'blurb'] },
  ],
  template: [
    ['Name', 'Tier', 'Website', 'Logo URL', 'Tagline', 'Description'],
    ['McGraw Hill Education', 'Platinum', 'https://www.mheducation.com', '', 'Learning science, applied', ''],
    ['Incheon Tourism Organization', 'Gold', 'https://www.incheon.go.kr', '', '', ''],
    ['Rustic Pathways', 'Silver', 'https://rusticpathways.com', '', '', ''],
  ],
  build: (row, map, ctx) => {
    const name = cell(row, map.name);
    const rawTier = cell(row, map.tier).toLowerCase();
    const tier = TIER_ALIASES[rawTier];
    const problems: string[] = [];
    if (!name) problems.push('No sponsor name.');
    if (!tier) {
      problems.push(rawTier
        ? `"${cell(row, map.tier)}" is not a tier. Use one of: ${SPONSOR_TIER_ORDER.join(', ')}.`
        : 'No tier given.');
    }

    const existing = ctx.sponsors.find((s) => sameName(s.name, name));
    const item: Sponsor = {
      id: existing?.id ?? id('spon'),
      name,
      tier: tier ?? 'Exhibitor',
      ...(cell(row, map.websiteUrl) ? { websiteUrl: cell(row, map.websiteUrl) } : {}),
      ...(cell(row, map.logoUrl) ? { logoUrl: cell(row, map.logoUrl) } : {}),
      ...(cell(row, map.tagline) ? { tagline: cell(row, map.tagline) } : {}),
      ...(cell(row, map.description) ? { description: cell(row, map.description) } : {}),
    };

    return {
      summary: name || '(unnamed)',
      detail: tier,
      problems,
      duplicateOf: existing ? `${existing.name} — currently ${existing.tier}` : undefined,
      ops: problems.length ? [] : [{
        op: existing ? 'update' : 'create',
        key: 'sponsors',
        ...(existing ? { id: existing.id, patch: item } : { item }),
      } as BatchOperation],
    };
  },
};

/* ----------------------------------------------------------------- dining */

/**
 * Reads a dietary tag from what the organiser actually wrote.
 *
 * Only tags stated in the label are applied. A restriction is not inferred
 * from a dish name — "chicken salad" is not declared nut-free here just
 * because it contains no nuts, because the one mistake in this file with real
 * consequences is telling somebody a dish is safe when nobody checked.
 * Anything unstated falls back to a plain cuisine label, and the preview says
 * how many rows that applied to so they can be confirmed.
 */
const DIETARY_KEYWORDS: [RegExp, MealOption['dietary']][] = [
  [/\bvegan\b/i, 'vegan'],
  [/\bvegetarian\b|\bveggie\b/i, 'vegetarian'],
  [/\bhalal\b/i, 'halal'],
  [/gluten[\s-]?free|\bgf\b/i, 'gluten_free'],
  [/nut[\s-]?free/i, 'nut_free'],
  [/\bkorean\b|bibimbap|bulgogi|kimchi|japchae|tteok/i, 'korean'],
];

export function readDietary(label: string): MealOption['dietary'] {
  for (const [pattern, tag] of DIETARY_KEYWORDS) if (pattern.test(label)) return tag;
  return 'western';
}

/** How many options in a service had no tag stated and were defaulted. */
export function untaggedCount(labels: string[]): number {
  return labels.filter((l) => !DIETARY_KEYWORDS.some(([p]) => p.test(l))).length;
}

export const MEAL_SPEC: ImportSpec = {
  key: 'mealServices',
  label: 'Dining',
  blurb: 'One row per sitting. Options are listed in a single cell, separated by '
    + 'semicolons, because that is how a caterer sends them.',
  fields: [
    { key: 'name', label: 'Name', aliases: ['service', 'sitting', 'meal'], required: true },
    { key: 'day', label: 'Day', aliases: ['dayno', 'daynumber'], required: true },
    { key: 'startTime', label: 'Start time', aliases: ['start', 'from', 'time'] },
    { key: 'endTime', label: 'End time', aliases: ['end', 'until', 'to'] },
    { key: 'date', label: 'Date', aliases: ['when'] },
    { key: 'location', label: 'Location', aliases: ['where', 'room', 'venue'] },
    { key: 'options', label: 'Options', aliases: ['choices', 'menu'],
      hint: 'Semicolon separated, e.g. "Bibimbap; Vegetarian pasta; Halal chicken"' },
  ],
  template: [
    ['Name', 'Day', 'Date', 'Start time', 'End time', 'Location', 'Options'],
    ['Day 1 Lunch', '1', '2027-10-15', '12:15 PM', '01:30 PM', 'Dining Hall',
      'Bibimbap; Vegetarian pasta; Halal chicken; Gluten-free bowl'],
    ['Day 2 Lunch', '2', '2027-10-16', '12:15 PM', '01:30 PM', 'Dining Hall',
      'Bulgogi; Vegan curry; Halal beef'],
  ],
  build: (row, map, ctx) => {
    const name = cell(row, map.name);
    const day = parseCount(cell(row, map.day));
    const options = cell(row, map.options).split(';').map((o) => o.trim()).filter(Boolean);
    const problems: string[] = [];
    if (!name) problems.push('No service name.');
    if (day === null) problems.push('Day must be a number (1 for the first day).');
    if (options.length === 0) problems.push('No options listed. Separate them with semicolons.');

    const existing = ctx.mealServices.find((m) => sameName(m.name, name));
    const startMinutes = parseClock(cell(row, map.startTime));
    const endMinutes = parseClock(cell(row, map.endTime));

    // Guessed from the name, which is what organisers actually write. A wrong
    // guess only affects an icon, and the field is editable afterwards.
    const lower = name.toLowerCase();
    const type: MealService['type'] =
      lower.includes('breakfast') ? 'breakfast'
      : lower.includes('reception') || lower.includes('dinner') ? 'reception'
      : lower.includes('snack') || lower.includes('break') ? 'snack'
      : 'lunch';

    const item: MealService = {
      id: existing?.id ?? id('meal'),
      name,
      type,
      day: day ?? 1,
      dateStr: parseDate(cell(row, map.date)) || existing?.dateStr || '',
      startTime: startMinutes !== null ? formatClock(startMinutes) : cell(row, map.startTime),
      endTime: endMinutes !== null ? formatClock(endMinutes) : cell(row, map.endTime),
      startMinutes: startMinutes ?? 0,
      endMinutes: endMinutes ?? 0,
      location: cell(row, map.location) || 'Dining Hall',
  
      options: options.map((label, i) => ({
        id: `${existing?.id ?? 'opt'}-${i}`,
        label,
        dietary: readDietary(label),
        description: '',
      })),
      selections: existing?.selections ?? {},
    };

    return {
      summary: name || '(unnamed)',
      detail: (() => {
        const untagged = untaggedCount(options);
        const base = `${options.length} option${options.length === 1 ? '' : 's'}`;
        return untagged
          ? `${base} · ${untagged} need a dietary tag confirming`
          : base;
      })(),
      problems,
      duplicateOf: existing ? `${existing.name} on day ${existing.day}` : undefined,
      ops: problems.length ? [] : [{
        op: existing ? 'update' : 'create',
        key: 'mealServices',
        ...(existing ? { id: existing.id, patch: item } : { item }),
      } as BatchOperation],
    };
  },
};

/* ----------------------------------------------------------------- guests */

const ROLE_ALIASES: Record<string, UserRole> = {
  attendee: 'attendee', delegate: 'attendee', participant: 'attendee',
  speaker: 'speaker', presenter: 'speaker', sponsor: 'sponsor',
};

export const GUEST_SPEC: ImportSpec = {
  key: 'invites',
  label: 'Guests',
  blurb: 'External attendees who have no Chadwick login. Importing them here means '
    + 'their name, organisation and role are already right when they first sign in.',
  fields: [
    { key: 'email', label: 'Email', aliases: ['address', 'mail'], required: true },
    { key: 'fullName', label: 'Full name', aliases: ['name'], required: true },
    { key: 'organization', label: 'Organisation', aliases: ['school', 'company', 'org'] },
    { key: 'title', label: 'Title', aliases: ['role', 'position', 'jobtitle'] },
    { key: 'inviteRole', label: 'Platform role', aliases: ['type', 'access'],
      hint: 'attendee, speaker or sponsor' },
  ],
  template: [
    ['Email', 'Full name', 'Organisation', 'Title', 'Platform role'],
    ['jlee@seoulforeign.org', 'Jenny Lee', 'Seoul Foreign School', 'Head of Learning', 'attendee'],
    ['k.tan@uwcsea.edu.sg', 'Kevin Tan', 'UWCSEA', 'Director of Innovation', 'speaker'],
  ],
  build: (row, map, ctx) => {
    const email = cell(row, map.email).toLowerCase();
    const fullName = cell(row, map.fullName);
    const problems: string[] = [];
    if (!email.includes('@')) problems.push('Not a valid email address.');
    if (!fullName) problems.push('No name.');
    if (email.endsWith('@chadwickschool.org')) {
      problems.push('Chadwick accounts sign in with Google and need no invitation.');
    }

    const existing = ctx.invites.find((i) => i.email.toLowerCase() === email);
    const item: Invite = {
      id: existing?.id ?? id('inv'),
      email,
      fullName,
      organization: cell(row, map.organization),
      title: cell(row, map.title),
      role: ROLE_ALIASES[cell(row, map.inviteRole).toLowerCase()] ?? 'attendee',
      accessCode: existing?.accessCode ?? generateAccessCode(),
      eventId: ctx.eventId,
      invitedBy: ctx.currentUserId,
      invitedAt: new Date().toISOString(),
    };

    return {
      summary: fullName || email || '(blank)',
      detail: [item.organization, item.role].filter(Boolean).join(' · '),
      problems,
      duplicateOf: existing ? `already invited as ${existing.fullName}` : undefined,
      ops: problems.length ? [] : [{
        op: existing ? 'update' : 'create',
        key: 'invites',
        ...(existing ? { id: existing.id, patch: item } : { item }),
      } as BatchOperation],
    };
  },
};

/* -------------------------------------------------------------- programme */

const TRACK_COLOURS = ['#002b54', '#2a6791', '#5e6513', '#b04318', '#56a0d3', '#8b9b92'];

export const SESSION_SPEC: ImportSpec = {
  key: 'sessions',
  label: 'Programme',
  blurb: 'One row per session. Rooms, tracks and speakers named here are matched to '
    + 'what already exists and created only when genuinely new.',
  fields: [
    { key: 'title', label: 'Title', aliases: ['session', 'name'], required: true },
    { key: 'date', label: 'Date', aliases: ['day', 'when'], required: true },
    { key: 'startTime', label: 'Start time', aliases: ['start', 'from'], required: true },
    { key: 'endTime', label: 'End time', aliases: ['end', 'until', 'to'], required: true },
    { key: 'roomName', label: 'Room', aliases: ['location', 'venue', 'where'] },
    { key: 'trackName', label: 'Track', aliases: ['strand', 'theme', 'category'] },
    { key: 'speakerName', label: 'Speaker', aliases: ['presenter', 'facilitator', 'lead'] },
    { key: 'speakerEmail', label: 'Speaker email', aliases: ['presenteremail', 'email'] },
    { key: 'description', label: 'Description', aliases: ['summary', 'abstract', 'about'] },
    { key: 'capacity', label: 'Capacity', aliases: ['seats', 'max'] },
  ],
  template: [
    ['Title', 'Date', 'Start time', 'End time', 'Room', 'Track', 'Speaker', 'Speaker email', 'Description', 'Capacity'],
    ['Argument in the Age of Autocomplete', '2027-10-15', '11:00 AM', '12:15 PM', 'B-201',
      'Keen Minds', 'Dr. Sarah Lin', 'slin@chadwickschool.org',
      'Teaching students to defend a position a model could have written for them', '25'],
    ['Quiet Leadership', '2027-10-15', '01:45 PM', '03:00 PM', 'Black Box',
      'Leadership', 'Prof. David Kim', 'dkim@chadwickschool.org',
      'How middle leaders build capacity without adding load', '200'],
  ],
  build: (row, map, ctx) => {
    const title = cell(row, map.title);
    const dateStr = parseDate(cell(row, map.date));
    const startMinutes = parseClock(cell(row, map.startTime));
    const endMinutes = parseClock(cell(row, map.endTime));

    const problems: string[] = [];
    if (!title) problems.push('No session title.');
    if (!dateStr) problems.push(`Could not read the date "${cell(row, map.date)}".`);
    if (startMinutes === null) problems.push(`Could not read the start time "${cell(row, map.startTime)}".`);
    if (endMinutes === null) problems.push(`Could not read the end time "${cell(row, map.endTime)}".`);
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      problems.push('The session ends before it starts.');
    }

    const ops: BatchOperation[] = [];

    /** Finds an existing record, then one created by an earlier row, and only
     *  then makes a new one — so a repeated room name yields a single room. */
    const resolve = <T extends { id: string }>(
      kind: string, name: string, existing: T | undefined, make: () => T,
    ): string | undefined => {
      if (!name) return undefined;
      if (existing) return existing.id;
      const key = `${kind}:${name.toLowerCase()}`;
      const already = ctx.pending.get(key);
      if (already) return already;
      const created = make();
      ctx.pending.set(key, created.id);
      ops.push({ op: 'create', key: kind as 'rooms', item: created } as BatchOperation);
      return created.id;
    };

    const roomName = cell(row, map.roomName);
    const capacity = parseCount(cell(row, map.capacity));
    const roomId = resolve<Room>('rooms', roomName,
      ctx.rooms.find((r) => sameName(r.name, roomName)),
      () => ({ id: id('room'), name: roomName, capacity: capacity ?? 30, floorLabel: '' }));

    const trackName = cell(row, map.trackName);
    const trackId = resolve<Track>('tracks', trackName,
      ctx.tracks.find((t) => sameName(t.name, trackName)),
      () => ({
        id: id('track'),
        name: trackName,
        colorHex: TRACK_COLOURS[(ctx.pending.size + ctx.tracks.length) % TRACK_COLOURS.length],
        description: '',
        orderIndex: ctx.tracks.length + ctx.pending.size,
      }));

    const speakerName = cell(row, map.speakerName);
    const speakerEmail = cell(row, map.speakerEmail).toLowerCase();
    const speakerId = resolve<UserProfile>('users', speakerEmail || speakerName,
      ctx.users.find((u) => (speakerEmail && u.email.toLowerCase() === speakerEmail)
        || (!speakerEmail && sameName(u.fullName, speakerName))),
      () => ({
        id: id('user'), email: speakerEmail, fullName: speakerName,
        title: '', department: '', organization: 'Chadwick International',
        userType: speakerEmail.endsWith('@chadwickschool.org') ? 'internal_staff' : 'external_guest',
        role: 'speaker', avatarUrl: initialsAvatar(speakerName), bio: '',
        isDirectoryVisible: true, checkedIn: false, shareContactOnScan: false,
      }));

    const existing = ctx.sessions.find((s) =>
      s.eventId === ctx.eventId && sameName(s.title, title));

    if (problems.length === 0) {
      const item: Session = {
        id: id('sess'),
        eventId: ctx.eventId,
        roomId: roomId ?? '',
        trackId: trackId ?? '',
        title,
        description: cell(row, map.description),
        // Day 1 is the earliest date in the file, worked out by the caller.
        day: 1,
        dateStr,
        startTime: formatClock(startMinutes!),
        endTime: formatClock(endMinutes!),
        startMinutes: startMinutes!,
        endMinutes: endMinutes!,
        maxAttendees: capacity ?? ctx.rooms.find((r) => r.id === roomId)?.capacity ?? 30,
        reservedUserIds: [],
        waitlistUserIds: [],
        speakerIds: speakerId ? [speakerId] : [],
        tags: [],
      };
      ops.push({ op: 'create', key: 'sessions', item } as BatchOperation);
    }

    return {
      summary: title || '(untitled)',
      detail: [dateStr, cell(row, map.startTime), roomName].filter(Boolean).join(' · '),
      problems,
      duplicateOf: existing ? `a session called "${existing.title}" already exists` : undefined,
      ops: problems.length ? [] : ops,
    };
  },
};

export const IMPORT_SPECS: ImportSpec[] =
  [SESSION_SPEC, ROOM_SPEC, SPONSOR_SPEC, MEAL_SPEC, GUEST_SPEC];
