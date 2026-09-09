export type AttendeeType = 'internal_faculty' | 'internal_staff' | 'external_guest' | 'student';

/** Role names are stable identifiers stored in Firestore and matched by the
 *  security rules — renaming one is a data migration, not a label change. */
export type UserRole =
  | 'technical_admin'
  | 'event_organizer'
  | 'speaker'
  | 'sponsor'
  | 'front_desk'
  | 'attendee';

/** How a person got into the platform. Chadwick staff use Workspace SSO;
 *  external guests redeem the access code emailed to them with their invite. */
export type AuthMethod = 'google_sso' | 'guest_code';

export interface AuthSession {
  userId: string;
  method: AuthMethod;
  signedInAt: string;
}

/** Catering options offered at each meal service. `dietary` drives the badge
 *  chip so kitchen and service staff can read a preference at a glance. */
export type DietaryTag =
  | 'western'
  | 'korean'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'gluten_free'
  | 'nut_free';

export interface MealOption {
  id: string;
  label: string;
  dietary: DietaryTag;
  description: string;
  /** Optional per-option cap; undefined means the option is uncapped. */
  maxServings?: number;
}

export interface MealService {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'snack' | 'reception';
  day: number;
  dateStr: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  location: string;
  options: MealOption[];
  /** userId -> mealOptionId. Kept here rather than on the profile so a
   *  service can be reconciled against the kitchen's counts in one place. */
  selections: Record<string, string>;
}

/** Written when a badge is scanned at a session door. Retained as the
 *  attendance record of truth — who was where, and whether they belonged. */
export interface AttendanceRecord {
  id: string;
  userId: string;
  sessionId: string;
  scannedAt: string;
  location: string;
  /** verified      - reserved for this session and scanned at its door
   *  wrong_session - scanned at a session they hold no reservation for
   *  walk_in       - admitted without a reservation, seats permitting */
  status: 'verified' | 'wrong_session' | 'walk_in';
  scannedBy: string;
}

/**
 * Glows and grows. Two named fields rather than one comment box, because a
 * single box reliably collects only complaints or only praise; asking for both
 * by name gets each from the same person.
 */
export type FeedbackTargetKind = 'session' | 'meal' | 'overall' | 'venue' | 'organisation';

export interface FeedbackEntry {
  id: string;
  userId: string;
  targetKind: FeedbackTargetKind;
  /** Session id, meal-service id, or a fixed key for event-wide aspects. */
  targetId: string;
  /** 1-5. The glow and grow carry the substance; this makes it sortable. */
  rating: number;
  glow: string;
  grow: string;
  submittedAt: string;
  /** Withheld names still count toward ratings, but the text is unattributed. */
  isAnonymous: boolean;
}

/** Event-wide aspects that always accept feedback, regardless of attendance. */
export const EVENT_FEEDBACK_ASPECTS: { id: string; kind: FeedbackTargetKind; label: string; hint: string }[] = [
  { id: 'overall', kind: 'overall', label: 'The conference overall', hint: 'Programme, balance of strands, and whether it felt worth the two days.' },
  { id: 'catering', kind: 'meal', label: 'Food & refreshments', hint: 'Quality, choice, dietary provision and queue times.' },
  { id: 'venue', kind: 'venue', label: 'Venue & wayfinding', hint: 'Rooms, signage, accessibility and getting between sessions.' },
  { id: 'organisation', kind: 'organisation', label: 'Registration & communication', hint: 'Sign-up, the portal, the badge, and knowing where to be.' },
];

export interface DirectMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  /** What they are actually called. Printed large on the badge, because the
   *  name on a passport is rarely the name someone answers to across a room. */
  preferredName?: string;
  title: string;
  department: string;
  organization: string;
  userType: AttendeeType;
  role: UserRole;
  avatarUrl: string;
  bio: string;
  isDirectoryVisible: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  linkedInUrl?: string;
  phone?: string;
  interests?: string[];
  /** Standing dietary requirement, distinct from a per-service pick. */
  dietaryTag?: DietaryTag;
  dietaryNotes?: string;
  /** Redeemed by external guests at sign-in; absent for SSO users. */
  accessCode?: string;
  /** Opt-in: allow the badge QR to hand over contact details when scanned. */
  shareContactOnScan: boolean;
  /** Opt-out: when false, nobody can start a direct message with this person.
   *  Defaults to allowed when absent, so existing accounts keep working. */
  allowMessages?: boolean;
  /** For sponsor delegates: which sponsor organisation they represent. Drives
   *  the organisation shown on their badge. */
  sponsorId?: string;
  /** Free-form profile links — personal site, X, Instagram, ORCID. LinkedIn
   *  keeps its own field because the directory surfaces it specifically. */
  socialLinks?: { label: string; url: string }[];
  /** Sample entry to be replaced per event. Surfaces a visible marker on the
   *  public speaker card so placeholder copy is never mistaken for a booking. */
  isPlaceholder?: boolean;
}

export interface Track {
  id: string;
  name: string;
  colorHex: string;
  orderIndex: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floorLabel: string;
  building?: string;
  /** Set once a room is matched to its Veracross Rooms & Resources record.
   *  Unset means the row is still locally defined. */
  veracrossResourceId?: string;
}

/** Ordered by prominence. `Host` sits outside the paid ladder — the school
 *  convening the event is acknowledged, not sold a package. */
export type SponsorTier = 'Host' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Exhibitor';

export interface Sponsor {
  id: string;
  name: string;
  tier: SponsorTier;
  /** The single lead sponsor within Platinum, given the largest treatment. */
  isPremier?: boolean;
  /** Open tier slot, rendered as an invitation rather than a company. */
  isPlaceholder?: boolean;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  tagline?: string;
}

/** Display weights per tier, used by the public page and the sponsor rail. */
export const SPONSOR_TIER_ORDER: SponsorTier[] =
  ['Host', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Exhibitor'];

export interface Session {
  id: string;
  eventId: string;
  roomId: string;
  trackId: string;
  title: string;
  description: string;
  day: number; // 1 or 2
  dateStr: string;
  startTime: string; // e.g. "09:00 AM"
  endTime: string;   // e.g. "10:15 AM"
  startMinutes: number; // for sorting/timeline calculation
  endMinutes: number;
  maxAttendees: number;
  reservedUserIds: string[];
  waitlistUserIds: string[];
  speakerIds: string[];
  /** Headline sponsor for this session, shown prominently. */
  primarySponsorId?: string;
  /** Smaller sponsors credited alongside it. */
  supportingSponsorIds?: string[];
  slidesUrl?: string;
  slidesName?: string;
  /** A recording of this session specifically. Event-level recap video covers
   *  the keynote; this covers the breakout somebody could not get into. */
  recordingUrl?: string;
  /** Files and links a speaker attaches to their own session. Uploads land in
   *  Firebase Storage; links are stored as-is, since plenty of presentations
   *  live in Slides or Canva and should not be copied into our bucket. */
  materials?: SessionMaterial[];
  isFeatured?: boolean;
  tags: string[];

  /**
   * Where this session is in the proposal pipeline.
   *
   * Absent means an organiser created it directly and it is simply on the
   * programme — every existing row keeps working untouched. A speaker's own
   * submission starts as `proposed`, becomes `approved` when an organiser
   * accepts it, and only then is it eligible to be given a room and a time.
   *
   * Declined proposals are kept rather than deleted: a speaker who submitted
   * in good faith is owed a visible answer, not a disappearance.
   */
  status?: 'proposed' | 'approved' | 'declined';
  /** Uid of the speaker who submitted it. */
  proposedBy?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** The organiser's note back to the speaker, shown on their proposal. */
  reviewNote?: string;
  /** What the speaker asked for, before a slot exists. Kept separate from the
   *  scheduled times so re-running the scheduler never loses the request. */
  requestedMinutes?: number;
  /** Day the speaker cannot attend, honoured by the scheduler where possible. */
  unavailableDays?: number[];
}

/** A period the programme can place a session in. */
export interface ScheduleSlot {
  day: number;
  startMinutes: number;
  endMinutes: number;
}

export interface SessionMaterial {
  id: string;
  name: string;
  url: string;
  kind: 'slides' | 'pdf' | 'link' | 'file';
  /** Uid of whoever attached it, so a speaker may remove their own. */
  addedBy: string;
  addedAt: string;
  /** Bytes, for uploads. Absent for links. */
  sizeBytes?: number;
}

export interface CommunityTopic {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string;
  authorDepartment: string;
  authorType: AttendeeType;
  title: string;
  content: string;
  category: 'General' | 'Informal Meetups' | 'Carpool & Dinners' | 'Ask Organizers';
  location?: string;
  meetupTime?: string;
  rsvpUserIds: string[];
  createdAt: string;
  likesCount: number;
  replies: {
    id: string;
    authorName: string;
    authorAvatar: string;
    authorDepartment: string;
    content: string;
    createdAt: string;
  }[];
}

export interface BroadcastAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'urgent';
  timestamp: string;
  active: boolean;
}

export type ActiveTab =
  | 'agenda'
  | 'badge'
  | 'dining'
  | 'community'
  | 'directory'
  | 'messages'
  | 'profile'
  | 'propose'
  | 'feedback'
  | 'admin'
  | 'luckydraw';

/** Where an event sits relative to today. Derived from its dates rather than
 *  stored, so an event cannot go stale by being left in the wrong state. */
export type EventStatus = 'past' | 'live' | 'upcoming';

export type EventCategory =
  | 'Conference'
  | 'Symposium'
  | 'Workshop'
  | 'Community'
  | 'Admissions'
  | 'Student';

/**
 * Everything the public-facing page for one event renders.
 *
 * The platform hosts many of these across a year, so the heavier storytelling
 * fields are optional: a two-hour workshop needs a name, dates and a summary,
 * while the flagship conference earns an About section, FAQs and a Discover
 * block. The page renders whatever is present and omits the rest.
 */
export interface EventConfig {
  id: string;
  /** URL-facing identifier: /?event=<slug> */
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  /** One or two lines for the events hub card. */
  summary: string;
  category: EventCategory;
  /** Longer prose for the event's own page. */
  description?: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  venueName: string;
  venueAddress?: string;
  heroImageUrl: string;
  registrationOpen: boolean;
  registrationNote?: string;
  /** Uid of the organiser who owns this event. The security rules gate every
   *  edit on it, so an event without an owner is one nobody but a technical
   *  admin can change. Stamped at creation, including during seeding. */
  ownerId?: string;
  /** When registration opens. Before this the event is announced but not
   *  bookable, which is a different message from "closed". */
  registrationOpensAt?: string;
  /** When it closes. Absent means it stays open until the event begins. */
  registrationClosesAt?: string;
  /** Filled in afterwards: what happened, and how to watch it back. */
  recap?: {
    summary?: string;
    /** A link, not an upload — recordings live in Drive, YouTube or Stream.
     *  Anything embeddable is embedded; anything else falls back to a link. */
    recordingUrl?: string;
    recordingLabel?: string;
    photoUrls?: string[];
    highlights?: { label: string; value: string }[];
    /** What people should take away, in their own words. Prose, not metrics:
     *  "42 attended" is a highlight, "start with the exit ticket" is a
     *  takeaway, and conflating them makes both useless. */
    takeaways?: string[];
    /** Slides, handouts and readings, linked rather than uploaded so the
     *  presenter keeps ownership of the current version. */
    materials?: { label: string; url: string; presenter?: string }[];
  };
  /** Drafts are visible only to organisers; published events are the public
   *  website. Absent is treated as published, so existing rows keep working. */
  status?: 'draft' | 'published';
  /** Marks demo/scaffold content. Surfaces a visible badge on the public page
   *  so a sample event is never mistaken for a real announced one. */
  isTemplate?: boolean;
  /** The flagship event of the year, given prominence on the hub. */
  isFeatured?: boolean;
  /** True when this event's sessions, badges and portal are wired up. Others
   *  are showcase entries with a landing page only. */
  hasPortal?: boolean;
  highlights?: { label: string; value: string }[];
  /** Named leads for workshop-style events, where who is running it is the
   *  main reason to attend. Distinct from session speakers, which only the
   *  full-programme events carry. */
  presenters?: { name: string; role: string; note?: string }[];
  about?: { heading: string; body: string }[];
  /** Recorded after the fact, shown on past-event cards. */
  outcomes?: { label: string; value: string }[];
  /** The "get to know the school" half of the event. Present when the
   *  conference doubles as a way for visiting educators to meet the community
   *  and consider joining it; omit for a purely academic programme. */
  discover?: {
    heading: string;
    intro: string;
    points: { title: string; body: string }[];
    closing: string;
  };
  faqs?: { question: string; answer: string }[];
}

/**
 * Whether an event can be booked right now, and why not when it cannot.
 *
 * Kept separate from EventStatus because "announced but not yet open" and
 * "closed" are different messages to a reader, and collapsing them into one
 * boolean loses the more useful half.
 */
export type RegistrationState =
  | { state: 'open' }
  | { state: 'opens_later'; opensAt: string }
  | { state: 'closed'; reason: 'ended' | 'closed' | 'not_open' };

export function registrationState(e: EventConfig, today = new Date()): RegistrationState {
  const end = new Date(e.endDate + 'T23:59:59');
  if (today > end) return { state: 'closed', reason: 'ended' };

  if (e.registrationOpensAt) {
    const opens = new Date(e.registrationOpensAt + 'T00:00:00');
    if (today < opens) return { state: 'opens_later', opensAt: e.registrationOpensAt };
  }
  if (e.registrationClosesAt) {
    const closes = new Date(e.registrationClosesAt + 'T23:59:59');
    if (today > closes) return { state: 'closed', reason: 'closed' };
  }
  return e.registrationOpen ? { state: 'open' } : { state: 'closed', reason: 'not_open' };
}

/** Resolves an event's status from its dates against a reference day. */
export function eventStatus(e: EventConfig, today = new Date()): EventStatus {
  const start = new Date(e.startDate + 'T00:00:00');
  const end = new Date(e.endDate + 'T23:59:59');
  if (today > end) return 'past';
  if (today >= start) return 'live';
  return 'upcoming';
}

/* ============================================================
   Prizes and spend — the operational side an event manager owns.
   ============================================================ */

/** A prize in the closing draw. Managed by organisers, drawn on the day. */
export interface Prize {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  /** Donating sponsor, when there is one. */
  sponsorId?: string;
  /** How many of this prize there are. */
  quantity: number;
  orderIndex: number;
  /** Set once drawn. A prize is drawn at most once per unit of quantity. */
  wonBy?: { userId: string; drawnAt: string }[];
}

export type CostCategory =
  | 'Catering'
  | 'Venue'
  | 'Speakers'
  | 'Materials'
  | 'Technology'
  | 'Travel'
  | 'Marketing'
  | 'Other';

/**
 * A single line of event spend. Budgeted and actual are separate fields
 * rather than one number, because the useful question during planning is the
 * gap between them, and after the event it is whether the gap was real.
 */
export interface CostEntry {
  id: string;
  eventId: string;
  label: string;
  category: CostCategory;
  /** Minor units of the currency, to avoid float arithmetic on money. */
  budgetedMinor: number;
  actualMinor: number;
  currency: string;
  note?: string;
  /** Uid of whoever recorded it. */
  recordedBy: string;
  recordedAt: string;
}

export const COST_CATEGORIES: CostCategory[] = [
  'Catering', 'Venue', 'Speakers', 'Materials', 'Technology', 'Travel', 'Marketing', 'Other',
];

/** Money is stored in minor units; this is the only place it becomes a string. */
export function formatMoney(minor: number, currency = 'KRW'): string {
  const major = currency === 'KRW' ? minor : minor / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(major);
}

/**
 * A guest invitation.
 *
 * External attendees have no Chadwick account, so an organiser records them
 * here first. On their first sign-in the invitation is adopted — their profile
 * is created with the name, organisation and role recorded here, rather than
 * them arriving as an anonymous attendee an organiser then has to fix up.
 *
 * The access code is a human confirmation ("your code is 4K7QP2"), not the
 * security. Authentication is the email link, because a short code cannot be
 * verified in a browser without publishing every code to it.
 */
export interface Invite {
  id: string;
  email: string;
  fullName: string;
  organization: string;
  title?: string;
  role: UserRole;
  /** Short, readable, no ambiguous characters. */
  accessCode: string;
  eventId?: string;
  invitedBy: string;
  invitedAt: string;
  /** Set when the invitation has been used. */
  claimedAt?: string;
  claimedByUid?: string;
}

/** Six characters, avoiding 0/O and 1/I/L so it can be read aloud. */
export function generateAccessCode(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}
