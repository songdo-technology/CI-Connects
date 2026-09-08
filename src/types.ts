export type AttendeeType = 'internal_faculty' | 'internal_staff' | 'external_guest' | 'student';

export type UserRole = 'attendee' | 'speaker' | 'organizer' | 'admin' | 'security';

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
  isFeatured?: boolean;
  tags: string[];
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
  /** Marks demo/scaffold content. Surfaces a visible badge on the public page
   *  so a sample event is never mistaken for a real announced one. */
  isTemplate?: boolean;
  /** The flagship event of the year, given prominence on the hub. */
  isFeatured?: boolean;
  /** True when this event's sessions, badges and portal are wired up. Others
   *  are showcase entries with a landing page only. */
  hasPortal?: boolean;
  highlights?: { label: string; value: string }[];
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

/** Resolves an event's status from its dates against a reference day. */
export function eventStatus(e: EventConfig, today = new Date()): EventStatus {
  const start = new Date(e.startDate + 'T00:00:00');
  const end = new Date(e.endDate + 'T23:59:59');
  if (today > end) return 'past';
  if (today >= start) return 'live';
  return 'upcoming';
}
