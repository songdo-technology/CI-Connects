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
