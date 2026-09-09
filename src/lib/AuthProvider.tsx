import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AuthState, completeGuestSignIn, completeRedirectSignIn, ensureUserDocument,
  isGuestLinkInUrl, pendingGuestEmail, sendGuestSignInLink, signInWithGoogle,
  describeAuthProblem,
  signOutUser, watchAuth,
} from './auth';
import { isFirebaseConfigured } from './firebase';

interface AuthContextValue {
  /** True when a real identity provider is behind sign-in. When false the app
   *  is running on seeded data and the persona picker stands in for it. */
  live: boolean;
  status: AuthState['status'];
  firebaseUser: User | null;
  error: string | null;
  /** Set once the signed-in account has a Firestore profile. */
  profileReady: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  /** Emails a one-tap sign-in link to a guest. */
  sendGuestLink: (email: string) => Promise<void>;
  /** True when the page was opened from one of those links. */
  guestLinkPending: boolean;
  /** The address the link was sent to, when this browser requested it. */
  guestEmailHint: string | null;
  /** Finishes a guest sign-in; email is needed only across devices. */
  completeGuestLink: (email?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the Firebase session and guarantees that a signed-in account has a
 * Firestore profile before the rest of the app treats them as a user.
 *
 * The two are separate facts. Firebase Auth knows an account exists; the
 * application needs a /users document to know their role. Provisioning happens
 * here rather than in a component so it runs exactly once per sign-in, no
 * matter which screen the user landed on.
 */
export const AuthProvider: React.FC<{
  useFirestore: boolean;
  children: React.ReactNode;
}> = ({ useFirestore, children }) => {
  const live = useFirestore && isFirebaseConfigured;

  const [state, setState] = useState<AuthState>({
    status: live ? 'loading' : 'signed_out',
    user: null,
    error: null,
  });
  const [profileReady, setProfileReady] = useState(false);
  const [guestLinkPending, setGuestLinkPending] = useState(false);

  /**
   * Why the last attempt failed, held outside the auth state.
   *
   * Every rejection path signs the user back out first, which makes
   * onAuthStateChanged fire with null, which used to overwrite the whole state
   * — reason included. The visitor was returned to a blank sign-in form with
   * nothing on it, so a refusal was indistinguishable from a page that had
   * simply reloaded. That is the "it just loops back" bug: the app knew
   * exactly what was wrong and threw the explanation away.
   */
  const failure = useRef<string | null>(null);

  const fail = (message: string) => {
    failure.current = message;
    setState((s) => ({ ...s, status: 'error', error: message }));
  };

  /** Called when the visitor starts a fresh attempt. */
  const clearFailure = () => { failure.current = null; };

  // A sign-in link lands as a fresh page load carrying credentials in the URL,
  // so this has to be detected before anything renders a sign-in form.
  useEffect(() => {
    if (!live) return;
    setGuestLinkPending(isGuestLinkInUrl());
  }, [live]);

  // A redirect sign-in finishes on the next page load, not in the click that
  // started it, so the result has to be claimed here before anything else.
  useEffect(() => {
    if (!live) return;
    completeRedirectSignIn().catch((e: Error) => fail(e.message));
  }, [live]);

  useEffect(() => {
    if (!live) return;
    return watchAuth((next) => {
      // A sign-out this app triggered to enforce a rule must not erase the
      // reason it did so.
      setState(next.status === 'signed_out' && failure.current
        ? { ...next, status: 'error', error: failure.current }
        : next);
      if (next.status !== 'signed_in') setProfileReady(false);
      if (next.status === 'signed_in') failure.current = null;
    });
  }, [live]);

  // Provision the profile after sign-in. Kept out of the sign-in call itself
  // so a returning user with an existing session is handled the same way as a
  // fresh one.
  //
  // Keyed on the uid rather than the User object: Firebase hands out a fresh
  // object on every token refresh, and depending on the reference would
  // re-provision on a timer for as long as somebody stayed signed in.
  const uid = state.user?.uid;
  useEffect(() => {
    if (!live || state.status !== 'signed_in' || !state.user) return;
    let cancelled = false;
    ensureUserDocument(state.user)
      .then(() => { if (!cancelled) setProfileReady(true); })
      .catch((e: Error) => {
        if (cancelled) return;
        // ensureUserDocument has already retried through the token race, so
        // reaching here means something is actually wrong. Say what, rather
        // than returning the visitor to a sign-in form that looks like their
        // attempt was simply ignored.
        fail(`Signed in, but your profile could not be set up: ${e.message} `
          + 'Try again, and tell songdo-technology@chadwickschool.org if it persists.');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, state.status, uid]);

  const value: AuthContextValue = {
    live,
    status: state.status,
    firebaseUser: state.user,
    error: state.error,
    profileReady,
    signIn: async () => {
      clearFailure();
      try {
        await signInWithGoogle();
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: describeAuthProblem(e) }));
      }
    },
    signOut: async () => {
      await signOutUser();
      setProfileReady(false);
    },
    sendGuestLink: async (email: string) => {
      clearFailure();
      try {
        await sendGuestSignInLink(email);
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: describeAuthProblem(e) }));
        throw e;
      }
    },
    guestLinkPending,
    guestEmailHint: pendingGuestEmail(),
    completeGuestLink: async (email?: string) => {
      try {
        await completeGuestSignIn(email);
        setGuestLinkPending(false);
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: describeAuthProblem(e) }));
        throw e;
      }
    },
    clearError: () => {
      clearFailure();
      setState((s) => ({
        ...s,
        error: null,
        status: s.user ? 'signed_in' : 'signed_out',
      }));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Returns null outside an AuthProvider rather than throwing, for consumers
 *  that merely want to react to identity changes. */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>');
  return ctx;
}
