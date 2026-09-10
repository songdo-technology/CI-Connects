/** SHA-256 as lowercase hex, via Web Crypto. Used to name invitations so the
 *  security rules can find one from a token's email without a query. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const inviteId = async (eventId: string, email: string) =>
  `${eventId}__${await sha256Hex(email.trim().toLowerCase())}`;

/** A short code people can read aloud: no 0/O, 1/I. */
export function randomCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
