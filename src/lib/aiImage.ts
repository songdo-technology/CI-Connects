import { firebaseAuth } from './firebase';
import { NotConfiguredError } from './aiStructure';

/**
 * Asks the server for a cover image and hands back the bytes.
 *
 * A Blob rather than a data URI, because the caller's next move is to put it
 * in Firebase Storage and keep a URL — the same path an uploaded file takes,
 * so the event record never holds image data.
 */
export async function generateEventImage(brief: string): Promise<Blob> {
  const token = await firebaseAuth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with your Chadwick account to use this.');

  const response = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: brief }),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 501) throw new NotConfiguredError(data.error ?? 'Not configured.');
  if (!response.ok) throw new Error(data.error ?? `The request failed (${response.status}).`);

  // atob gives a binary string; Uint8Array.from maps it to bytes. Done here
  // rather than server-side so the response stays JSON and small enough to log.
  const binary = atob(data.base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: data.mimeType ?? 'image/png' });
}
