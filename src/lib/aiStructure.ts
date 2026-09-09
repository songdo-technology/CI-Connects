import { FieldSpec } from './csvImport';
import { firebaseAuth } from './firebase';

/**
 * Asks the server to shape pasted prose into importable rows.
 *
 * The call carries the caller's Firebase ID token, because the endpoint holds
 * the model's API key and would otherwise be an open proxy on the school's
 * domain, billed to the school.
 */

export interface StructureResult {
  csv: string;
  rows: number;
}

export class NotConfiguredError extends Error {}

export async function structureWithAi(
  label: string,
  fields: FieldSpec[],
  text: string,
): Promise<StructureResult> {
  const token = await firebaseAuth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in with your Chadwick account to use this.');

  const response = await fetch('/api/structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      label,
      // Only what the model needs to name columns. Nothing about the event,
      // and nothing about anyone already in the directory.
      fields: fields.map((f) => ({ key: f.key, label: f.label, hint: f.hint })),
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 501) {
    throw new NotConfiguredError(data.error ?? 'No AI provider configured.');
  }
  if (!response.ok) throw new Error(data.error ?? `The request failed (${response.status}).`);
  return data as StructureResult;
}
