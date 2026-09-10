import { UserProfile, UserRole } from '../types';

/**
 * Role and permission model.
 *
 * Permissions are checked, never roles. Call sites ask `can(user, 'events:create')`
 * rather than `user.role === 'technical_admin'`, so adding a role later is a
 * change to one table here instead of a hunt through twenty-five components.
 *
 * This mirrors the Firestore security rules exactly — see `firestore.rules`.
 * The client-side check is for hiding controls a user cannot use; the rules are
 * what actually enforces it. Never treat this file as the security boundary.
 */

export type Permission =
  // Events
  | 'events:create'
  | 'events:edit_any'
  | 'events:edit_own'
  | 'events:publish'
  | 'events:delete'
  // Programme
  | 'sessions:edit_any'
  | 'sessions:edit_own'
  | 'sessions:upload_materials'
  | 'dining:manage'
  | 'sponsors:manage'
  | 'rooms:manage'
  // People
  | 'users:view_directory'
  | 'users:view_all'
  | 'users:manage_roles'
  // Operations
  | 'attendance:scan'
  | 'checkin:manage'
  | 'announcements:send'
  | 'signage:broadcast'
  // Feedback
  | 'feedback:submit'
  | 'feedback:view_all'
  // Event operations that only the people running it should reach
  | 'luckydraw:manage'
  | 'attendance:view_all'
  | 'costs:view'
  // Participation
  | 'profile:edit_own'
  | 'reservations:manage_own'
  | 'community:post'
  | 'messages:send'
  // System
  | 'integrations:manage'
  | 'data:export';

/** Everything a signed-in person can do regardless of role. */
const BASE: Permission[] = [
  'profile:edit_own',
  'reservations:manage_own',
  'community:post',
  'messages:send',
  'feedback:submit',
  'users:view_directory',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  attendee: [...BASE],

  // A speaker owns their own presence: profile, bio, links, and the materials
  // attached to sessions they are presenting. Nothing beyond that.
  speaker: [
    ...BASE,
    'sessions:edit_own',
    'sessions:upload_materials',
  ],

  // Runs every event end to end — the same reach as an administrator over
  // event content — but stops at the platform itself: no role assignment and
  // no integrations. That boundary is the whole point of the separation.
  event_organizer: [
    ...BASE,
    'events:create',
    'events:edit_any',
    'events:edit_own',
    'events:delete',
    'events:publish',
    'sessions:edit_any',
    'sessions:edit_own',
    'dining:manage',
    'sponsors:manage',
    'rooms:manage',
    'users:view_all',
    'attendance:scan',
    'checkin:manage',
    'announcements:send',
    'signage:broadcast',
    'feedback:view_all',
    'luckydraw:manage',
    'attendance:view_all',
    'costs:view',
    'sessions:upload_materials',
    'data:export',
  ],

  // A sponsor delegate is an attendee with a company behind them. They book,
  // network and give feedback like anyone else; representing an organisation
  // confers no editorial rights over the event.
  sponsor: [...BASE],

  // Door and desk only. Deliberately has no content permissions and no access
  // to contact details — verifying someone is at the venue should not require
  // the ability to read their profile.
  front_desk: [
    ...BASE,
    'attendance:scan',
    'checkin:manage',
  ],

  technical_admin: [
    ...BASE,
    'events:create',
    'events:edit_any',
    'events:edit_own',
    'events:publish',
    'events:delete',
    'sessions:edit_any',
    'sessions:edit_own',
    'dining:manage',
    'sponsors:manage',
    'rooms:manage',
    'users:view_all',
    'users:manage_roles',
    'attendance:scan',
    'checkin:manage',
    'announcements:send',
    'signage:broadcast',
    'feedback:view_all',
    'luckydraw:manage',
    'attendance:view_all',
    'costs:view',
    'sessions:upload_materials',
    'integrations:manage',
    'data:export',
  ],
};

export function can(user: UserProfile | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

/**
 * Ownership-aware check for resources that belong to someone.
 * A user passes if they may edit anything of that kind, or may edit their own
 * and this is theirs.
 */
export function canEdit(
  user: UserProfile | null | undefined,
  anyPermission: Permission,
  ownPermission: Permission,
  ownerId: string | undefined,
): boolean {
  if (!user) return false;
  if (can(user, anyPermission)) return true;
  return can(user, ownPermission) && ownerId === user.id;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  technical_admin: 'Technical Admin',
  event_organizer: 'Event Manager',
  speaker: 'Speaker',
  sponsor: 'Sponsor',
  front_desk: 'Front Desk',
  attendee: 'Attendee',
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  technical_admin: 'Everything an Event Manager can do, plus user roles, integrations and the platform itself.',
  event_organizer: 'Runs every event — programme, rooms, dining, sponsors, signage, attendees and feedback. No role assignment or integrations.',
  speaker: 'Edits their own profile, bio and links, and attaches slides or materials to sessions they present.',
  sponsor: 'Attends on behalf of a sponsoring organisation. Books, networks and gives feedback like any attendee.',
  front_desk: 'Scans badges and checks people in at the door.',
  attendee: 'Registers, books sessions, chooses meals, posts, messages and leaves feedback.',
};

/** Roles a given user is allowed to assign to someone else. */
export function assignableRoles(user: UserProfile | null | undefined): UserRole[] {
  if (!can(user, 'users:manage_roles')) return [];
  return ['technical_admin', 'event_organizer', 'speaker', 'sponsor', 'front_desk', 'attendee'];
}

/**
 * Whether a person may see inside an event: its programme, its badge, its
 * people. Organisers and administrators always; everyone else only once an
 * organiser has put them on that event's list.
 */
export function canSeeEvent(user: UserProfile | null | undefined, eventId: string): boolean {
  if (!user) return false;
  if (can(user, 'events:create')) return true;
  return (user.eventAccess ?? []).includes(eventId);
}
