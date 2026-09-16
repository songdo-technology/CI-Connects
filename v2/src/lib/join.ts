import { Profile } from './types';
import { store } from './store';

/**
 * Puts the person on an event's list with the code they were given. The
 * event and the code travel on the profile for the one write the rules
 * check, then are cleared. A wrong code is refused by the rules.
 */
export async function joinEvent(profile: Profile, eventId: string, code: string): Promise<void> {
  if (profile.eventAccess.includes(eventId)) return;
  const c = code.trim().toUpperCase().replace(/[\s-]/g, '');
  await store.update('users', profile.id, { eventAccess: [...profile.eventAccess, eventId], joining: { event: eventId, code: c } });
  await store.update('users', profile.id, { joining: null }).catch(() => undefined);
}

export function describeJoin(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'permission-denied') return 'That code is not right for this event. Check it with the organisers — a new code may have been issued.';
  return (e as Error).message || 'That did not go through. Try again.';
}
