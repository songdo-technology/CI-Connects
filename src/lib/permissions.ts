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

  speaker: [
    ...BASE,
    'sessions:edit_own',
  ],

  // Runs events end to end, and needs to see who is coming and what they said
  // about it — but not to change anyone's role or touch integrations.
  event_organizer: [
    ...BASE,
    'events:create',
    'events:edit_own',
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
    'data:export',
  ],

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
  event_organizer: 'Event Organiser',
  speaker: 'Speaker',
  front_desk: 'Front Desk',
  attendee: 'Attendee',
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  technical_admin: 'Full access, including user roles and integrations.',
  event_organizer: 'Creates and runs events; sees attendees and feedback.',
  speaker: 'Edits their own sessions and profile.',
  front_desk: 'Scans badges and checks people in at the door.',
  attendee: 'Books sessions, chooses meals, posts, messages and gives feedback.',
};

/** Roles a given user is allowed to assign to someone else. */
export function assignableRoles(user: UserProfile | null | undefined): UserRole[] {
  if (!can(user, 'users:manage_roles')) return [];
  return ['technical_admin', 'event_organizer', 'speaker', 'front_desk', 'attendee'];
}
