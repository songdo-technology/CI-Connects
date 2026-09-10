/** SHA-256 as lowercase hex, via Web Crypto. Used to name invitations so the
 *  security rules can find one from a token's email without a query. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const inviteId = async (eventId: string, email: string) =>
  `${eventId}__${await sha256Hex(email.trim().toLowerCase())}`;
