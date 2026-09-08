/**
 * Cross-window transport for signage takeovers.
 *
 * An organizer composes a message in the portal; every open signage display
 * picks it up and takes over its screen until the message expires or is
 * cleared.
 *
 * Two mechanisms, deliberately:
 *   - BroadcastChannel delivers instantly to windows that are already open.
 *   - localStorage persists the current takeover, so a display that is opened
 *     late — or reloads mid-event — still picks up whatever is active. It also
 *     fires a `storage` event in other windows, which covers browsers where
 *     BroadcastChannel is unavailable.
 *
 * SCOPE LIMIT — this matters for real deployment: both mechanisms are
 * same-origin *and same-browser*. A takeover reaches every tab and window on
 * one machine, which is enough to drive several displays from one player and
 * enough to test the whole flow. It does NOT reach a screen in another room on
 * another device. Genuine multi-room casting needs a shared backend; when
 * Firebase lands, swap the two functions below for a Firestore document
 * subscription and everything above this layer keeps working unchanged.
 */

export type SignageBroadcastKind = 'info' | 'urgent' | 'schedule' | 'welcome';

export interface SignageBroadcast {
  id: string;
  kind: SignageBroadcastKind;
  title: string;
  message: string;
  createdAt: number;
  /** Epoch ms after which displays drop it; null means until cleared. */
  expiresAt: number | null;
  /** Room ids to target, or null for every display. */
  targetRoomIds: string[] | null;
}

const STORAGE_KEY = 'ci-connects:signage:takeover';
const CHANNEL_NAME = 'ci-connects-signage';

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

/** Reads the active takeover, discarding one that has already expired. */
export function readBroadcast(): SignageBroadcast | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignageBroadcast;
    if (parsed.expiresAt !== null && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    // Private browsing, cleared site data, or malformed JSON — a display
    // with no takeover is the correct fallback, so fail quiet.
    return null;
  }
}

export function publishBroadcast(b: SignageBroadcast | null): void {
  try {
    if (b === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* Storage may be unavailable; the channel post below still reaches
       already-open displays, so a takeover is not lost outright. */
  }
  channel?.postMessage(b);
}

/**
 * Subscribes to takeover changes. Returns an unsubscribe function.
 * Fires immediately with the current value so a display renders correctly on
 * first paint rather than flashing empty.
 */
export function subscribeBroadcast(
  onChange: (b: SignageBroadcast | null) => void,
): () => void {
  onChange(readBroadcast());

  const onMessage = (e: MessageEvent) => onChange(e.data ?? null);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange(readBroadcast());
  };

  channel?.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  // Expiry is time-based, so poll slowly to retire a lapsed takeover even
  // when no new message arrives.
  const tick = setInterval(() => onChange(readBroadcast()), 10_000);

  return () => {
    channel?.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    clearInterval(tick);
  };
}

/** True when a takeover applies to the given room. */
export function appliesToRoom(b: SignageBroadcast | null, roomId: string): boolean {
  if (!b) return false;
  if (b.targetRoomIds === null) return true;
  return b.targetRoomIds.includes(roomId);
}

export const BROADCAST_KIND_META: Record<
  SignageBroadcastKind,
  { label: string; bg: string; fg: string; accent: string }
> = {
  welcome:  { label: 'Welcome',   bg: '#002b54', fg: '#ffffff', accent: '#acd4f1' },
  info:     { label: 'Notice',    bg: '#2a6791', fg: '#ffffff', accent: '#acd4f1' },
  schedule: { label: 'Schedule',  bg: '#5e6513', fg: '#ffffff', accent: '#d9da55' },
  urgent:   { label: 'Urgent',    bg: '#b04318', fg: '#ffffff', accent: '#f2e18b' },
};
