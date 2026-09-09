import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseStorage } from './firebase';

/**
 * File uploads for session materials and event cover images.
 *
 * Everything is namespaced by the thing it belongs to — `sessions/<id>/…` —
 * so the storage rules can reason about who may write where without a lookup
 * table, and so deleting a session's files later is a prefix delete.
 */

/** Roughly what a slide deck runs to; anything larger is almost always a
 *  mistake, and an unbounded upload path is the easiest way to run up a bill. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  'image/png',
  'image/jpeg',
]);

export function describeUploadProblem(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB — link to it instead if it is a large deck.`;
  }
  if (!ALLOWED.has(file.type)) {
    return 'Upload a PDF, PowerPoint, Keynote export or image. For anything else, add a link.';
  }
  return null;
}

/** Uploads a session material and returns its public download URL. */
export async function uploadSessionMaterial(
  sessionId: string,
  file: File,
): Promise<{ url: string; sizeBytes: number }> {
  if (!firebaseStorage) throw new Error('File storage is not configured.');
  const problem = describeUploadProblem(file);
  if (problem) throw new Error(problem);

  // Prefix with a timestamp so re-uploading a file of the same name does not
  // silently replace the previous version.
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const path = `sessions/${sessionId}/${Date.now()}-${safeName}`;
  const handle = ref(firebaseStorage, path);
  await uploadBytes(handle, file, { contentType: file.type });
  return { url: await getDownloadURL(handle), sizeBytes: file.size };
}

export function materialKindFor(file: File): 'slides' | 'pdf' | 'file' {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'slides';
  return 'file';
}
