import { Profile, Role } from './types';

export const isAdmin = (p: Profile | null | undefined) => p?.role === 'admin';
export const isStaff = (p: Profile | null | undefined) => p?.role === 'admin' || p?.role === 'schedule_admin';

/** Whether a person may see inside an event. Administrators and schedule
 *  administrators always; a member when an administrator listed them, or
 *  invited their address. */
export function canSeeEvent(p: Profile | null | undefined, eventId: string, invitedEventIds: string[] = []): boolean {
  if (!p) return false;
  if (isStaff(p)) return true;
  return p.eventAccess.includes(eventId) || invitedEventIds.includes(eventId);
}

/** Staff, or someone named as an organiser of this event. */
export const runsEvent = (p: Profile | null | undefined, event: { organizers?: string[] } | null | undefined) =>
  Boolean(p) && (isStaff(p) || (event?.organizers ?? []).includes(p!.email));

export const ROLES: Role[] = ['admin', 'schedule_admin', 'user'];
