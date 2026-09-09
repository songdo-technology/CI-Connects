/**
 * Turns a shared video link into one that can be embedded.
 *
 * Organisers paste whatever the address bar gave them — a YouTube watch page,
 * a Drive "share" link, a live URL. None of those render in an iframe; each
 * platform has a separate embed address that nobody has memorised. Asking for
 * the embed URL instead would be asking people to do this conversion by hand,
 * so the platform does it.
 *
 * Returns null for anything unrecognised, which the caller renders as a plain
 * link. A visible link is a fair outcome; a blank iframe is not.
 */

export interface VideoEmbed {
  /** The src for the iframe. */
  src: string;
  /** Which service it came from, for the label and the fallback text. */
  provider: 'YouTube' | 'Google Drive' | 'Vimeo';
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function resolveVideoEmbed(raw?: string): VideoEmbed | null {
  if (!raw?.trim()) return null;

  let url: URL;
  try {
    url = new URL(raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');

  // YouTube: watch pages, short links, /live/, /shorts/ and already-embed URLs
  // all carry the same eleven-character id in different positions.
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v');
    const fromPath = url.pathname.match(/^\/(?:embed|live|shorts|v)\/([A-Za-z0-9_-]{11})/)?.[1];
    const id = fromQuery ?? fromPath;
    if (id && YOUTUBE_ID.test(id)) {
      // The privacy-preserving host, since this plays on a school's public site.
      const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
      // Honour a ?t= start time if the organiser linked to a moment.
      const start = url.searchParams.get('t') ?? url.searchParams.get('start');
      if (start) embed.searchParams.set('start', String(parseInt(start, 10) || 0));
      embed.searchParams.set('rel', '0');
      return { src: embed.toString(), provider: 'YouTube' };
    }
    return null;
  }

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (YOUTUBE_ID.test(id)) {
      const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
      const start = url.searchParams.get('t');
      if (start) embed.searchParams.set('start', String(parseInt(start, 10) || 0));
      embed.searchParams.set('rel', '0');
      return { src: embed.toString(), provider: 'YouTube' };
    }
    return null;
  }

  // Google Drive: /file/d/<id>/view — the same id previews at /preview.
  if (host === 'drive.google.com') {
    const id = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1]
      ?? url.searchParams.get('id');
    if (id) {
      return { src: `https://drive.google.com/file/d/${id}/preview`, provider: 'Google Drive' };
    }
    return null;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    if (id) return { src: `https://player.vimeo.com/video/${id}`, provider: 'Vimeo' };
    return null;
  }

  return null;
}

/**
 * Whether a Drive link is likely to play for the public.
 *
 * Drive defaults new files to "restricted", and a restricted file embeds as a
 * sign-in wall that looks identical to a broken player. There is no way to
 * test this from the browser — the iframe is cross-origin — so the honest move
 * is to warn the organiser at the point they paste it.
 */
export function needsSharingReminder(embed: VideoEmbed | null): boolean {
  return embed?.provider === 'Google Drive';
}
