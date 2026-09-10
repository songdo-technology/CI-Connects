/**
 * The whole model of CI Connects v2, in one place.
 *
 * Three roles. An administrator runs the platform; a schedule administrator
 * runs programmes and nothing else; everyone else is a user who is put on an
 * event's list and then sees it. Every document carries string dates
 * (YYYY-MM-DD) and 24-hour times (HH:MM); presentation formats them.
 */

export type Role = 'admin' | 'schedule_admin' | 'user';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  schedule_admin: 'Schedule admin',
  user: 'Member',
};

export interface Profile {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
  org?: string;
  title?: string;
  role: Role;
  /** Events this person may see inside of. Written by administrators only. */
  eventAccess: string[];
  dietary?: string;
  createdAt: string;
}

/** A place on an event for an address, made before that person has ever
 *  signed in. Its id is `${eventId}__${sha256(email)}`, which is what lets the
 *  security rules find it from a token without a query. */
export interface Invite {
  id: string;
  email: string;
  eventId: string;
  invitedBy: string;
  createdAt: string;
  note?: string;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  startDate: string;
  endDate: string;
  venueName: string;
  venueAddress?: string;
  coverUrl: string;
  status: 'draft' | 'published';
  registrationOpen: boolean;
  createdBy: string;
  createdAt: string;
}

export type SessionType = 'keynote' | 'talk' | 'workshop' | 'panel' | 'break' | 'social';

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  keynote: 'Keynote', talk: 'Talk', workshop: 'Workshop', panel: 'Panel', break: 'Break', social: 'Social',
};

export interface Speaker {
  name: string;
  title?: string;
  org?: string;
}

export interface Session {
  id: string;
  eventId: string;
  title: string;
  abstract: string;
  type: SessionType;
  date: string;
  start: string;
  end: string;
  roomId: string;
  trackId?: string;
  speakers: Speaker[];
  /** 0 means unlimited: a break, a meal, a plenary that everyone attends. */
  capacity: number;
  reservedUserIds: string[];
  waitlistUserIds: string[];
  materials?: { label: string; url: string }[];
  featured?: boolean;
  /** A partner credited on this session. */
  sponsorId?: string;
  /** The code inside the QR on this session's door. Somebody who scans it
   *  with their own phone records their own attendance; the rules check the
   *  code against this field. Rotate it and the old QR stops working. */
  checkinCode?: string;
}

export type SponsorTier = 'platinum' | 'gold' | 'silver' | 'partner';
export const SPONSOR_TIER_LABEL: Record<SponsorTier, string> = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', partner: 'Partner' };
export const SPONSOR_TIERS: SponsorTier[] = ['platinum', 'gold', 'silver', 'partner'];

export interface Sponsor {
  id: string;
  eventId: string;
  name: string;
  tier: SponsorTier;
  logoUrl?: string;
  url?: string;
  blurb?: string;
  order: number;
}

export interface Room {
  id: string;
  eventId: string;
  name: string;
  capacity: number;
  location?: string;
  order: number;
}

export interface Track {
  id: string;
  eventId: string;
  name: string;
  color: string;
  order: number;
}

export interface Attendance {
  id: string;
  eventId: string;
  /** null is the venue itself: arrived at the door. */
  sessionId: string | null;
  userId: string;
  at: string;
  by: string;
  /** Present when the person recorded it themselves by scanning a door. */
  code?: string;
}

export interface Announcement {
  id: string;
  eventId: string | null;
  title: string;
  body: string;
  level: 'info' | 'urgent';
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Feedback {
  id: string;
  eventId: string;
  sessionId: string;
  userId: string;
  rating: number;
  comment?: string;
  at: string;
}

export interface SiteSettings {
  id: 'site';
  name: string;
  tagline: string;
  contactEmail: string;
}

/** Collection name → document type. The store is typed by this. */
export interface Collections {
  users: Profile;
  invites: Invite;
  events: Event;
  sessions: Session;
  rooms: Room;
  tracks: Track;
  sponsors: Sponsor;
  attendance: Attendance;
  announcements: Announcement;
  feedback: Feedback;
  settings: SiteSettings;
}
export type CollectionName = keyof Collections;
