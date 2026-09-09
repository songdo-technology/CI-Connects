/**
 * Remembers that somebody was on their way into the portal.
 *
 * Sign-in does not always finish on the page it started on. `signInWithPopup`
 * returns to the same React tree with its state intact, but `signInWithRedirect`
 * — the fallback whenever a popup is blocked, and the only option inside the
 * iOS and Android webviews — navigates to Google and comes back to a COLD LOAD.
 * Every piece of component state is gone, including the fact that the visitor
 * was standing on the sign-in screen, so they land signed in but on the public
 * hub, wondering what happened.
 *
 * sessionStorage survives that round trip and nothing else: it is scoped to the
 * tab, cleared when the tab closes, and consumed the moment it is read, so an
 * abandoned attempt cannot capture a later visit.
 */

const KEY = 'ci:signin-intent';

export interface SignInIntent {
  /** The event the visitor was looking at, so the redirect does not silently
   *  move them to the featured one. */
  eventSlug?: string;
}

export function markSignInIntent(eventSlug?: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ eventSlug } satisfies SignInIntent));
  } catch {
    // Private mode, or storage disabled. The popup path still works; the
    // redirect path degrades to landing on the hub, which is what it did before.
  }
}

/** Reads the intent and clears it. Safe to call on every render pass. */
export function takeSignInIntent(): SignInIntent | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as SignInIntent;
  } catch {
    return null;
  }
}

/** True if an intent is stored, without consuming it. For deciding whether a
 *  cold load is the tail end of a sign-in rather than an ordinary visit. */
export function hasSignInIntent(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
