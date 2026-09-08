import React, { useState } from 'react';
import { Building2, Database, Check, AlertCircle, LogIn, Loader2 } from 'lucide-react';
import { DataStore } from '../lib/data/store';
import { CollectionKey } from '../lib/data/schema';
import { useAuth } from '../lib/AuthProvider';
import { BOOTSTRAP_ADMIN_EMAILS } from '../lib/auth';
import {
  INITIAL_PROFILES, INITIAL_SESSIONS, INITIAL_TRACKS, INITIAL_ROOMS,
  INITIAL_SPONSORS, INITIAL_MEAL_SERVICES, INITIAL_ANNOUNCEMENTS,
  INITIAL_COMMUNITY_TOPICS, INITIAL_ATTENDANCE, INITIAL_MESSAGES,
  INITIAL_FEEDBACK, EVENTS,
} from '../data/initialData';

interface FirstRunSetupProps {
  store: DataStore;
  onDone: () => void;
}

/**
 * First-run screen, shown when the app is pointed at an empty Firestore.
 *
 * Seeding runs in the browser as the signed-in administrator rather than from
 * a script. A server-side seed would need a service-account key, which is a
 * real secret and should not be handed around or committed; the client SDK
 * already has an authenticated session with exactly the permissions the
 * security rules grant, which is the right amount of authority for this.
 *
 * It writes collection by collection so a rules rejection names the collection
 * that failed instead of failing the whole batch anonymously.
 */

const SEED: { key: CollectionKey; items: unknown[]; label: string }[] = [
  { key: 'users', items: INITIAL_PROFILES, label: 'People' },
  { key: 'events', items: EVENTS, label: 'Events' },
  { key: 'tracks', items: INITIAL_TRACKS, label: 'Mission strands' },
  { key: 'rooms', items: INITIAL_ROOMS, label: 'Rooms' },
  { key: 'sessions', items: INITIAL_SESSIONS, label: 'Sessions' },
  { key: 'sponsors', items: INITIAL_SPONSORS, label: 'Sponsors' },
  { key: 'mealServices', items: INITIAL_MEAL_SERVICES, label: 'Dining' },
  { key: 'announcements', items: INITIAL_ANNOUNCEMENTS, label: 'Announcements' },
  { key: 'communityTopics', items: INITIAL_COMMUNITY_TOPICS, label: 'Community' },
  { key: 'attendance', items: INITIAL_ATTENDANCE, label: 'Attendance' },
  { key: 'messages', items: INITIAL_MESSAGES, label: 'Messages' },
  { key: 'feedback', items: INITIAL_FEEDBACK, label: 'Feedback' },
];

export const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ store, onDone }) => {
  const auth = useAuth();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const email = auth.firebaseUser?.email?.toLowerCase() ?? '';
  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(email);

  const run = async () => {
    setRunning(true);
    setError(null);
    const uid = auth.firebaseUser?.uid;
    try {
      for (const { key, items, label } of SEED) {
        // Events are stamped with the seeding administrator as owner. The
        // rules gate every edit on ownerId, so an unstamped event would be one
        // that no organiser could ever modify — and the create rule refuses it
        // outright.
        const prepared = key === 'events' && uid
          ? items.map((e) => ({ ...(e as object), ownerId: uid, status: 'published' }))
          : items;
        await store.batch(prepared.map((item) => ({ op: 'create' as const, key, item })));
        setDone((d) => [...d, label]);
      }
      onDone();
    } catch (e) {
      setError(
        `${(e as Error).message}\n\n` +
        'The most likely cause is that the security rules have not been deployed yet. ' +
        'Run: npx firebase deploy --only firestore:rules',
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">CI Connects setup</h1>
            <p className="text-xs text-slate-500">Connected to Firestore · database is empty</p>
          </div>
        </div>

        {auth.status !== 'signed_in' ? (
          <>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Sign in with your Chadwick account to set up the database. Seeding
              writes as you, so it only succeeds if your account has permission —
              which is the point.
            </p>
            <button
              onClick={() => auth.signIn()}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Continue with Chadwick Google
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-5">
              <div className="text-xs text-slate-500">Signed in as</div>
              <div className="text-sm font-semibold text-slate-800">{email}</div>
              <div className={`text-xs mt-1 ${isBootstrapAdmin ? 'text-emerald-800' : 'text-amber-800'}`}>
                {isBootstrapAdmin
                  ? 'Bootstrap administrator — may seed the database.'
                  : 'Not on the bootstrap list; the rules will refuse these writes.'}
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              This writes the current sample catalogue into Firestore: eleven
              events, the Chadwick Connects programme, people, dining, sponsors
              and feedback. Existing documents are not touched.
            </p>

            {done.length > 0 && (
              <div className="mb-5 space-y-1.5">
                {done.map((label) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-emerald-800">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    {label}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-line">{error}</p>
              </div>
            )}

            <button
              onClick={run}
              disabled={running}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeding {done.length}/{SEED.length}…</>
                : <><Database className="w-4 h-4" /> Seed the database</>}
            </button>

            <button
              onClick={() => auth.signOut()}
              className="w-full mt-2 text-xs font-semibold text-slate-400 hover:text-blue-700 py-2 cursor-pointer"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
};
