import { doc, getDoc } from 'firebase/firestore';
import { Invite } from '../types';
import { db } from './firebase';

/**
 * Checking an access code without publishing the guest list.
 *
 * External guests prove they were invited with the email they were invited at
 * plus the code they were sent. Checking that in the browser is the awkward
 * part: reading the invitations collection to compare would mean publishing
 * every guest's address and code to anyone who opened the network tab.
 *
 * So the pair is hashed and the hash is the document id. The client hashes
 * what was typed and reads that one document. A correct pair finds it; a wrong
 * one finds nothing; and the collection cannot be listed, so there is nothing
 * to harvest. The stored document holds no address and no code — only which
 * invitation it belongs to.
 *
 * What this is NOT: the credential. Passing this gate causes a one-tap link to
 * be sent to the invited address and nothing else. Someone who guessed a code
 * would only cause an email to arrive in the real guest's inbox. Possession of
 * the mailbox remains what actually admits anybody, which is what keeps the
 * attendance list worth trusting.
 */

export interface InviteCodeDoc {
  inviteId: string;
  eventId: string;
}

/** SHA-256 of the normalised pair, hex. Stable across devices and sessions. */
export async function inviteCodeHash(email: string, code: string): Promise<string> {
  const normalised = `${email.trim().toLowerCase()}:${code.trim().toUpperCase().replace(/\s+/g, '')}`;
  const bytes = new TextEncoder().encode(normalised);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The lookup document an invitation should have. */
export async function lookupDocFor(invite: Invite): Promise<{ id: string; data: InviteCodeDoc }> {
  return {
    id: await inviteCodeHash(invite.email, invite.accessCode),
    data: { inviteId: invite.id, eventId: invite.eventId },
  };
}

/**
 * Does this email and code name a real invitation?
 *
 * A single document read. Returns null for a wrong pair and for an offline or
 * denied read alike — from the guest's point of view those are the same
 * situation, and guessing which would only produce a misleading message.
 */
export async function checkInviteCode(
  email: string, code: string,
): Promise<InviteCodeDoc | null> {
  if (!db || !email.trim() || !code.trim()) return null;
  try {
    const id = await inviteCodeHash(email, code);
    const snapshot = await getDoc(doc(db, 'inviteCodes', id));
    return snapshot.exists() ? (snapshot.data() as InviteCodeDoc) : null;
  } catch {
    return null;
  }
}
