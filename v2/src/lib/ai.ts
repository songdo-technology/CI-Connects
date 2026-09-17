import { auth } from './firebase';

/** The columns the reader is asked for — ours and nothing else, so whatever
 *  the source holds that has no place in a programme never comes back. */
const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'abstract', label: 'Abstract', hint: 'what the session is about, in the source\'s words' },
  { key: 'type', label: 'Type', hint: 'keynote, talk, workshop, panel, break or social' },
  { key: 'date', label: 'Date', hint: 'YYYY-MM-DD, only if the source says' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'room', label: 'Room', hint: 'room number or name as written' },
  { key: 'track', label: 'Track', hint: 'strand or theme, if the source groups sessions' },
  { key: 'speakers', label: 'Speakers', hint: 'Name (Title, Organisation); Name (Title, Organisation)' },
  { key: 'capacity', label: 'Capacity' },
];

/**
 * Hands loose text — a programme pasted from a document, a sheet laid out
 * for people rather than machines — to the site's reader (functions/api/
 * structure.js, Gemini behind it) and gets back a table with our columns.
 * It is a transcriber: the table lands in the same review as any upload,
 * and nothing is written until the person importing says so.
 */
export async function structureWithAi(text: string): Promise<string> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again and retry.');
  const r = await fetch('/api/structure', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ label: 'conference sessions', fields: FIELDS, text: text.slice(0, 24000) }),
  });
  const j = await r.json().catch(() => ({})) as { csv?: string; error?: string };
  if (!r.ok || !j.csv) throw new Error(j.error || `The reader answered ${r.status}.`);
  return j.csv;
}
