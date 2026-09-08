import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {DataProvider} from './lib/data/DataProvider';
import {AuthProvider} from './lib/AuthProvider';
import {createSeededMemoryStore} from './lib/data/seed';
import {FirestoreStore} from './lib/data/firestoreStore';
import {db, isFirebaseConfigured} from './lib/firebase';
import type {DataStore} from './lib/data/store';

/**
 * The one place the storage implementation is chosen.
 *
 * Firestore is opt-in rather than automatic. An empty Firestore looks exactly
 * like a loading one to the rest of the app, so flipping over before the
 * database is seeded would hang the loading gate with no clue why. The switch
 * is thrown by setting VITE_USE_FIRESTORE=true once `npm run seed` has run.
 */
const useFirestore =
  import.meta.env.VITE_USE_FIRESTORE === 'true' && isFirebaseConfigured && db !== null;

const store: DataStore = useFirestore
  ? new FirestoreStore(db!)
  : createSeededMemoryStore();

if (import.meta.env.DEV) {
  console.info(
    `[ci-connects] data store: ${useFirestore ? 'Firestore' : 'in-memory'}` +
    (isFirebaseConfigured ? '' : ' (Firebase not configured)'),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider useFirestore={useFirestore}>
      <DataProvider store={store} isRemote={useFirestore}>
        <App />
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
);
