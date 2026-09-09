import {
  GoogleAuthProvider, User, getRedirectResult, isSignInWithEmailLink,
  onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink,
  signInWithPopup, signInWithRedirect, signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { Invite } from '../types';
import { ALLOWED_EMAIL_DOMAIN, db, firebaseAuth } from './firebase';
import { UserProfile, UserRole } from '../types';
import { initialsAvatar } from './avatar';

/**
 * Google Workspace sign-in.
 *
 * The domain is restricted twice, on purpose. The `hd` parameter tells Google
 * which Workspace to prefer, and the check after sign-in rejects anything that
 * came back from a different domain — `hd` is a hint to the account chooser,
 * not an enforcement mechanism, and a user can still pick a personal account
 * from it. Neither is the real boundary: `firestore.rules` is, because anything
 * checked in the browser can be bypassed.
 */

/**
 * Accounts permitted to provision themselves with an elevated role on first
 * sign-in, and which role each may take.
 *
 * This exists to solve a bootstrap problem: assigning a role requires an
 * administrator, so the first ones cannot be assigned by one. Everyone else
 * lands as an attendee and is promoted from the admin panel.
 *
 * Keep it short and keep it in step with bootstrapRole() in firestore.rules,
 * which is what actually enforces this. A name here with no matching entry
 * there grants nothing.
 */
export const BOOTSTRAP_ROLES: Record<string, UserRole> = {
  'songdo-technology@chadwickschool.org': 'technical_admin',
  'dnorman@chadwickschool.org': 'technical_admin',
  'wpaetzold@chadwickschool.org': 'event_organizer',
};

/** Retained for existing call sites that only ask "is this a bootstrap account". */
export const BOOTSTRAP_ADMIN_EMAILS = Object.keys(BOOTSTRAP_ROLES);

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

export function isAllowedDomain(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`));
}

export function watchAuth(onChange: (state: AuthState) => void): () => void {
  if (!firebaseAuth) {
    onChange({ status: 'signed_out', user: null, error: null });
    return () => {};
  }
  return onAuthStateChanged(
    firebaseAuth,
    (user) => onChange(
      user
        ? { status: 'signed_in', user, error: null }
        : { status: 'signed_out', user: null, error: null },
    ),
    (error) => onChange({ status: 'error', user: null, error: error.message }),
  );
}

/** Popup failures that mean "this environment cannot do popups", as opposed to
 *  "the user closed it". Only the former should silently fall back. */
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/cancelled-popup-request',
]);

export async function signInWithGoogle(): Promise<void> {
  if (!firebaseAuth) throw new Error('Firebase is not configured.');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN, prompt: 'select_account' });

  let result;
  try {
    result = await signInWithPopup(firebaseAuth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';

    // A blocked popup is not a failed sign-in, it is an environment that
    // cannot show one — a popup blocker, or the webview a native app runs in.
    // Redirect works everywhere popups do not, which matters because the iOS
    // and Android builds will never have a popup available. Control leaves the
    // page here; getRedirectResult() picks it up on the way back.
    if (POPUP_UNAVAILABLE.has(code)) {
      await signInWithRedirect(firebaseAuth, provider);
      return;
    }

    // Closing the chooser is a deliberate choice, not an error worth shouting
    // about.
    if (code === 'auth/popup-closed-by-user') return;

    throw e;
  }

  if (!isAllowedDomain(result.user.email)) {
    // Sign straight back out. Leaving the session open would let a personal
    // Google account sit signed in against a school platform, even though the
    // rules would refuse it every read.
    await signOut(firebaseAuth);
    throw new Error(
      `Sign-in is limited to @${ALLOWED_EMAIL_DOMAIN} accounts. ` +
      `You signed in as ${result.user.email ?? 'an unknown account'}.`,
    );
  }
}

/**
 * Completes a redirect sign-in after the browser returns to the page, and
 * applies the same domain check the popup path does — a redirect that came
 * back with a personal account must be rejected just as firmly.
 */
export async function completeRedirectSignIn(): Promise<void> {
  if (!firebaseAuth) return;
  const result = await getRedirectResult(firebaseAuth);
  if (result && !isAllowedDomain(result.user.email)) {
    await signOut(firebaseAuth);
    throw new Error(
      `Sign-in is limited to @${ALLOWED_EMAIL_DOMAIN} accounts. ` +
      `You signed in as ${result.user.email ?? 'an unknown account'}.`,
    );
  }
}

/* ------------------------------------------------------------ guest access */

/** Where the pending guest email is parked between requesting a link and
 *  returning from it. The link may be opened in a different tab. */
const PENDING_EMAIL_KEY = 'ci-connects:pending-email';

/**
 * Emails a one-tap sign-in link.
 *
 * Firebase sends and verifies the link itself, so guests need no password and
 * we need no backend. The short access code an organiser gives them is a human
 * confirmation, not the security — a six-character code cannot be checked in a
 * browser without publishing every code to it.
 */
export async function sendGuestSignInLink(email: string): Promise<void> {
  if (!firebaseAuth) throw new Error('Firebase is not configured.');
  const normalised = email.trim().toLowerCase();

  await sendSignInLinkToEmail(firebaseAuth, normalised, {
    // Returning to the current origin keeps this working on localhost, the
    // Cloudflare preview URLs and the production domain without a rebuild.
    url: `${window.location.origin}/?guest=1`,
    handleCodeInApp: true,
  });

  try { window.localStorage.setItem(PENDING_EMAIL_KEY, normalised); } catch { /* private mode */ }
}

export function isGuestLinkInUrl(): boolean {
  return Boolean(firebaseAuth) && isSignInWithEmailLink(firebaseAuth!, window.location.href);
}

export function pendingGuestEmail(): string | null {
  try { return window.localStorage.getItem(PENDING_EMAIL_KEY); } catch { return null; }
}

/**
 * Completes a guest sign-in from the emailed link.
 *
 * `email` is only needed when the link is opened on a different device from
 * the one that requested it, where localStorage cannot help.
 */
export async function completeGuestSignIn(email?: string): Promise<void> {
  if (!firebaseAuth) throw new Error('Firebase is not configured.');
  const address = (email ?? pendingGuestEmail() ?? '').trim().toLowerCase();
  if (!address) {
    throw new Error('Confirm the email address this link was sent to.');
  }
  await signInWithEmailLink(firebaseAuth, address, window.location.href);
  try { window.localStorage.removeItem(PENDING_EMAIL_KEY); } catch { /* ignore */ }
  // Strip the link parameters so a refresh does not try to redeem a used link.
  window.history.replaceState({}, '', window.location.pathname);
}

/** The invitation recorded for an email, if an organiser created one. */
async function findInvite(email: string): Promise<Invite | null> {
  if (!db) return null;
  const snap = await getDocs(query(collection(db, 'invites'), where('email', '==', email)));
  const first = snap.docs[0];
  return first ? ({ ...first.data(), id: first.id } as Invite) : null;
}

export async function signOutUser(): Promise<void> {
  if (firebaseAuth) await signOut(firebaseAuth);
}

/**
 * Creates the Firestore profile for a newly signed-in account, if it is
 * missing. Returns the role the document ended up with.
 *
 * Existing documents are never overwritten: a returning user keeps whatever
 * role an administrator gave them, and this must not quietly demote them back
 * to attendee on their next sign-in.
 */
export async function ensureUserDocument(user: User): Promise<UserRole> {
  if (!db) throw new Error('Firestore is not configured.');

  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return (existing.data().role as UserRole) ?? 'attendee';
  }

  const email = (user.email ?? '').toLowerCase();

  // An invited guest arrives with a name, organisation and role an organiser
  // already recorded. Adopting it here is the difference between a guest
  // landing as a usable profile and landing as an anonymous attendee somebody
  // then has to go and fix.
  const invite = isAllowedDomain(email) ? null : await findInvite(email);

  const role: UserRole = BOOTSTRAP_ROLES[email] ?? invite?.role ?? 'attendee';
  const fullName = invite?.fullName ?? user.displayName ?? email.split('@')[0] ?? 'New member';

  const profile: UserProfile = {
    id: user.uid,
    email,
    fullName,
    title: invite?.title ?? '',
    department: '',
    organization: invite?.organization ?? 'Chadwick International',
    userType: isAllowedDomain(email) ? 'internal_staff' : 'external_guest',
    role,
    // Photos are placeholders throughout; a Google avatar would be the only
    // real face on the page and would look like an inconsistency.
    avatarUrl: initialsAvatar(fullName),
    bio: '',
    isDirectoryVisible: true,
    checkedIn: false,
    shareContactOnScan: false,
    ...(invite ? { accessCode: invite.accessCode } : {}),
  };

  await setDoc(ref, profile);

  // Mark the invitation used, so an organiser can see who has actually
  // arrived rather than only who was invited.
  if (invite && db) {
    await updateDoc(doc(db, 'invites', invite.id), {
      claimedAt: new Date().toISOString(),
      claimedByUid: user.uid,
    });
  }

  return role;
}
