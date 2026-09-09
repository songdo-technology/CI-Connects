import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

/**
 * Firebase initialisation.
 *
 * The config values are read from the environment rather than hardcoded, so a
 * separate staging project can be pointed at later without touching code. They
 * are not secrets: a Firebase web config identifies a project, it does not
 * authenticate to it, and it ships inside the JavaScript bundle of every
 * Firebase web app. Access is controlled by `firestore.rules`.
 *
 * Initialisation is deliberately optional. If the environment is not
 * configured — a fresh clone, a preview build, a contributor without access —
 * `firebaseApp` is null and the application falls back to the in-memory store
 * rather than failing to boot. That keeps the demo runnable and makes a
 * missing Cloudflare environment variable a visible degradation instead of a
 * white screen.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

/**
 * Whether Firebase's OAuth handler is served from this same site.
 *
 * It usually is not: the handler lives at `<project>.firebaseapp.com/__/auth/`
 * while the app is served from somewhere else. That split is what breaks
 * signInWithRedirect in every current browser — the handler has to pass the
 * credential back across a site boundary, and Chrome 115+, Safari's ITP and
 * Firefox's ETP all partition the storage it used to do that through.
 * getRedirectResult() then resolves to null with no error at all, and the
 * visitor simply arrives back at the sign-in screen.
 *
 * Knowing this lets the app avoid a flow that cannot finish, instead of
 * sending people into it and watching them come back empty-handed.
 */
export const AUTH_HANDLER_IS_SAME_SITE: boolean =
  typeof window !== 'undefined'
  && Boolean(config.authDomain)
  && config.authDomain === window.location.hostname;

/** Google Workspace domain that may sign in with SSO. */
export const ALLOWED_EMAIL_DOMAIN: string =
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ?? 'chadwickschool.org';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  firestore = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export const firebaseApp = app;
export const db = firestore;
export const firebaseAuth = auth;
export const firebaseStorage = storage;
