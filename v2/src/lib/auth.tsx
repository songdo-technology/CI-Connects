import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { auth, isDemo, BOOTSTRAP_ADMINS } from './firebase';
import { store, DEMO_MEMBERS } from './store';
import { Profile, Role } from './types';
import { nowIso } from './time';

export interface AuthUser { uid: string; email: string; name: string; photoUrl?: string }

export interface AuthState {
  status: 'loading' | 'signed_out' | 'signed_in';
  user: AuthUser | null;
  /** The person's profile as the interface should render it — with "view
   *  as" applied for administrators. Writes still happen as the real one. */
  profile: Profile | null;
  realProfile: Profile | null;
  /** Events whose list this address is on by invitation, before or without
   *  an administrator ticking them on the profile. */
  invitedEventIds: string[];
  error: string | null;
  signIn: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  createAccount: (input: { email: string; password: string; name: string; org?: string; title?: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  viewAs: Role | null;
  setViewAs: (role: Role | null) => void;
  /** Demo build only. */
  personas: Profile[];
  signInAs: (id: string) => void;
}

const Ctx = createContext<AuthState | null>(null);

export const useAuth = (): AuthState => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};

const DEMO_KEY = 'ci-connects-v2:demo-persona';
export const isChadwick = (email: string) => email.trim().toLowerCase().endsWith('@chadwickschool.org');
/** What a new password account told us about itself, for the profile. */
let pendingExtras: { name?: string; org?: string; title?: string } | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [invitedEventIds, setInvited] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState<Role | null>(null);
  const [personas, setPersonas] = useState<Profile[]>([]);

  // ------------------------------------------------------------ demo
  useEffect(() => {
    if (!isDemo) return;
    const off = store.watch('users', [], (list) => setPersonas(list));
    const saved = (() => { try { return localStorage.getItem(DEMO_KEY); } catch { return null; } })();
    if (saved) {
      store.get('users', saved).then((p) => {
        if (p) { setUser({ uid: p.id, email: p.email, name: p.name }); setStatus('signed_in'); }
        else setStatus('signed_out');
      });
    } else setStatus('signed_out');
    return off;
  }, []);

  // ------------------------------------------------------------ firebase
  useEffect(() => {
    if (isDemo || !auth) { if (!isDemo) setStatus('signed_out'); return; }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setRealProfile(null); setInvited([]); setStatus('signed_out'); return; }
      const me: AuthUser = {
        uid: u.uid, email: (u.email ?? '').toLowerCase(),
        name: u.displayName ?? (u.email ?? '').split('@')[0], photoUrl: u.photoURL ?? undefined,
      };
      setUser(me);
      try {
        await ensureProfile(me);
        setStatus('signed_in');
      } catch (e) {
        setError(`Signed in, but your profile could not be set up: ${(e as Error).message}`);
        setStatus('signed_out');
      }
    });
  }, []);

  // The profile itself, live, and the invitations for this address.
  useEffect(() => {
    if (!user) return;
    const offProfile = store.watch('users', [{ field: 'id', op: '==', value: user.uid }], (list) => setRealProfile(list[0] ?? null));
    const offInvites = store.watch('invites', [{ field: 'email', op: '==', value: user.email }], (list) => setInvited(list.map((i) => i.eventId)));
    return () => { offProfile(); offInvites(); };
  }, [user]);

  const signIn = async () => {
    setError(null);
    if (isDemo || !auth) return;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setError(describe(code, (e as Error).message));
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setError(null);
    const em = email.trim().toLowerCase();
    if (isDemo) {
      const p = personas.find((x) => x.email === em);
      if (!p) { setError('No demo persona has that address.'); throw new Error('demo'); }
      signInAs(p.id); return;
    }
    if (!auth) return;
    if (isChadwick(em)) { setError('Chadwick accounts sign in with Google — use the button below.'); throw new Error('chadwick'); }
    try { await signInWithEmailAndPassword(auth, em, password); }
    catch (e) { const code = (e as { code?: string }).code ?? ''; setError(describe(code, (e as Error).message)); throw e; }
  };

  const createAccount = async ({ email, password, name, org, title }: { email: string; password: string; name: string; org?: string; title?: string }) => {
    setError(null);
    const em = email.trim().toLowerCase();
    if (isChadwick(em)) { setError('Chadwick accounts sign in with Google — no account to create.'); throw new Error('chadwick'); }
    if (isDemo) {
      const id = `demo-${Date.now().toString(36)}`;
      await store.set('users', id, { id, email: em, name: name.trim(), org: org?.trim() || undefined, title: title?.trim() || undefined, role: 'user', eventAccess: [], createdAt: nowIso() });
      try { localStorage.setItem(DEMO_KEY, id); } catch { /* ignore */ }
      setUser({ uid: id, email: em, name: name.trim() }); setStatus('signed_in'); return;
    }
    if (!auth) return;
    try {
      pendingExtras = { name: name.trim(), org: org?.trim() || undefined, title: title?.trim() || undefined };
      const cred = await createUserWithEmailAndPassword(auth, em, password);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
      // The profile may already have been provisioned by the auth listener
      // before the display name landed; say who this is either way.
      await store.update('users', cred.user.uid, { name: name.trim(), org: org?.trim() || undefined, title: title?.trim() || undefined }).catch(() => undefined);
    } catch (e) { const code = (e as { code?: string }).code ?? ''; setError(describe(code, (e as Error).message)); throw e; }
    finally { pendingExtras = null; }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    if (isDemo || !auth) return;
    try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); }
    catch (e) { const code = (e as { code?: string }).code ?? ''; setError(describe(code, (e as Error).message)); throw e; }
  };

  const signOut = async () => {
    setViewAs(null);
    if (isDemo) { try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } setUser(null); setRealProfile(null); setStatus('signed_out'); return; }
    if (auth) await fbSignOut(auth);
  };

  const signInAs = (id: string) => {
    if (!isDemo) return;
    const p = personas.find((x) => x.id === id);
    if (!p) return;
    try { localStorage.setItem(DEMO_KEY, id); } catch { /* ignore */ }
    setUser({ uid: p.id, email: p.email, name: p.name });
    setStatus('signed_in');
  };

  const profile = useMemo<Profile | null>(
    () => (realProfile && viewAs && realProfile.role === 'admin' ? { ...realProfile, role: viewAs } : realProfile),
    [realProfile, viewAs],
  );

  const value: AuthState = {
    status, user, profile, realProfile, invitedEventIds, error, signIn, signInWithPassword, createAccount, resetPassword, signOut,
    viewAs, setViewAs, personas: isDemo ? personas : [], signInAs,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** Creates the profile on first sign-in; leaves an existing one alone. */
async function ensureProfile(me: AuthUser): Promise<void> {
  const existing = await store.get('users', me.uid);
  if (existing) return;
  const role: Role = BOOTSTRAP_ADMINS.includes(me.email) ? 'admin' : 'user';
  const profile: Profile = {
    id: me.uid, email: me.email, name: pendingExtras?.name || me.name, photoUrl: me.photoUrl,
    org: pendingExtras?.org, title: pendingExtras?.title,
    role, eventAccess: [], createdAt: nowIso(),
  };
  await store.set('users', me.uid, profile);
}

function describe(code: string, message: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This address is not on the Firebase authorised-domains list yet — add it under Authentication → Settings.';
    case 'auth/popup-blocked':
      return 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check the network and try again.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': case 'auth/invalid-login-credentials':
      return 'That email and password do not match.';
    case 'auth/email-already-in-use':
      return 'There is already an account with that address — sign in instead.';
    case 'auth/weak-password':
      return 'Use a password of at least eight characters.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Password sign-in is not switched on for this project (Firebase → Authentication → Sign-in method).';
    default:
      return message || 'Sign-in did not complete.';
  }
}

export { DEMO_MEMBERS };
