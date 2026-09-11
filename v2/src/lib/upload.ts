import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/** What an image is for, which decides how small it is made. */
export type ImageKind = 'photo' | 'logo';
const MAX_EDGE: Record<ImageKind, number> = { photo: 2000, logo: 800 };

/**
 * Decodes an image and, when it is bigger than any page will show it,
 * redraws it smaller before it goes anywhere: a phone photograph is 4–12 MB
 * and a cover is shown at 1600px at most. Photos become JPEG; a PNG logo
 * keeps its transparency; SVG and GIF pass through untouched.
 */
export async function shrinkImage(file: File, kind: ImageKind): Promise<Blob> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('That file could not be read as an image — use a JPG or PNG.'); }
  const scale = Math.min(1, MAX_EDGE[kind] / Math.max(bitmap.width, bitmap.height));
  const keepPng = kind === 'logo' && file.type === 'image/png';
  if (scale === 1 && (keepPng || file.type === 'image/jpeg') && file.size < 1.5 * 1024 * 1024) { bitmap.close(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, keepPng ? 'image/png' : 'image/jpeg', 0.86));
  if (!blob) throw new Error('The image could not be processed.');
  return blob;
}

/** Uploads an image into a folder of the site's storage and returns the
 *  address to show it from. The folder decides who may write (storage.rules). */
export async function uploadImage(folder: string, file: File, kind: ImageKind, onProgress?: (pct: number) => void): Promise<string> {
  if (!storage) throw new Error('Storage is not configured.');
  const blob = await shrinkImage(file, kind);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/gif' ? 'gif' : 'jpg';
  const task = uploadBytesResumable(ref(storage, `${folder}/${Date.now().toString(36)}.${ext}`), blob, {
    contentType: blob.type, cacheControl: 'public, max-age=31536000, immutable',
  });
  await new Promise<void>((resolve, reject) => task.on('state_changed', (s) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), reject, () => resolve()));
  return getDownloadURL(task.snapshot.ref);
}

export function describeUpload(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'storage/unauthorized') return 'You are not allowed to upload here — administrators and schedule administrators can.';
  if (code === 'storage/canceled') return 'The upload was cancelled.';
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') return 'The upload did not finish. Check the connection and try again.';
  return (e as Error).message || 'The upload failed.';
}
