/**
 * Initials-based placeholder avatars, returned as inline SVG data URIs.
 *
 * Returning a data URI rather than a component means every existing
 * `<img src={profile.avatarUrl}>` keeps working untouched — there are more
 * than twenty of them across the app — while no longer depending on stock
 * photography standing in for real people.
 *
 * Colors come from the deepened Chadwick secondaries already verified for
 * white text, and are chosen deterministically from the name so a person keeps
 * the same avatar everywhere they appear.
 */

/** Deepened Chadwick secondaries; all clear WCAG AA behind white text. */
const PALETTE = ['#002b54', '#2a6791', '#5e6513', '#6b605a', '#b04318'];

const HONORIFICS =
  /^(Dr|Prof|Mr|Mrs|Ms|Mx|Rev|Fr|Sr|Capt|Sgt|Lt|Officer|Coach|Principal|Director|Chief)\.?\s+/i;

/** Two initials from a person's name, ignoring any leading title. */
export function initialsOf(fullName: string): string {
  let cleaned = fullName.trim();
  while (HONORIFICS.test(cleaned)) cleaned = cleaned.replace(HONORIFICS, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable index into the palette, so the same name always gets the same color. */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsAvatar(fullName: string): string {
  const initials = initialsOf(fullName);
  const bg = colorFor(fullName);
  // encodeURIComponent rather than btoa: the SVG may contain non-Latin-1
  // characters once real names are entered, which would make btoa throw.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${bg}"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" ` +
    `font-family="Gill Sans MT, Gill Sans, Helvetica, Arial, sans-serif" ` +
    `font-size="38" font-weight="600" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
