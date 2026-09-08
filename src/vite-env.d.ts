/// <reference types="vite/client" />

/** Typed so a missing or misspelled variable is a compile error, not a
 *  runtime undefined that only shows up in the deployed build. */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAIN?: string;
  /** Set to 'true' to run against Firestore instead of the in-memory store. */
  readonly VITE_USE_FIRESTORE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
