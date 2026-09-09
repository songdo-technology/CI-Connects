import React, { useMemo, useState } from 'react';
import { Eraser, AlertTriangle, Loader2, Check, ShieldAlert } from 'lucide-react';
import {
  EventConfig, Session, Track, Room, Sponsor, MealService, UserProfile, Invite,
  Prize, CostEntry, AttendanceRecord,
} from '../../types';
import { BatchOperation } from '../../lib/data/store';
import { CollectionKey } from '../../lib/data/schema';
import { BOOTSTRAP_ADMIN_EMAILS } from '../../lib/auth';
import { inputClass, Notice } from './formKit';

interface AdminResetProps {
  currentUser: UserProfile;
  events: EventConfig[];
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  sponsors: Sponsor[];
  mealServices: MealService[];
  users: UserProfile[];
  invites: Invite[];
  prizes: Prize[];
  costs: CostEntry[];
  attendance: AttendanceRecord[];
  communityTopics: { id: string }[];
  messages: { id: string }[];
  feedback: { id: string }[];
  announcements: { id: string }[];
  onCommit: (ops: BatchOperation[]) => Promise<void>;
}

/**
 * Clearing the sample catalogue.
 *
 * The platform ships populated so it can be understood before it is
 * configured. That is useful once and then it is in the way: an organiser
 * setting up a real conference should not be picking their event out of eleven
 * illustrative ones, and nobody should be able to reach a fake delegate in the
 * directory.
 *
 * Deletion is permanent and there is no undo, so the shape of this screen is
 * the shape of a serious question: nothing is selected by default, every group
 * shows exactly what it would remove, the counts are live, and the button will
 * not arm until the word is typed. The accounts that could lock the platform —
 * yours, and the bootstrap administrators — are excluded from selection
 * entirely rather than merely warned about.
 */
export const AdminReset: React.FC<AdminResetProps> = ({
  currentUser, events, sessions, tracks, rooms, sponsors, mealServices, users,
  invites, prizes, costs, attendance, communityTopics, messages, feedback,
  announcements, onCommit,
}) => {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Accounts that must survive, whatever is ticked. */
  const protectedIds = useMemo(() => {
    const keep = new Set<string>([currentUser.id]);
    for (const u of users) {
      if (BOOTSTRAP_ADMIN_EMAILS.includes(u.email.toLowerCase())) keep.add(u.id);
    }
    return keep;
  }, [users, currentUser.id]);

  const sampleEvents = events.filter((e) => e.isTemplate);
  const sampleEventIds = new Set(sampleEvents.map((e) => e.id));
  const sampleSessions = sessions.filter((s) => sampleEventIds.has(s.eventId));
  const sampleSessionIds = new Set(sampleSessions.map((s) => s.id));

  const groups = useMemo(() => ([
    {
      key: 'events',
      label: 'Sample events and their programmes',
      detail: `${sampleEvents.length} events, ${sampleSessions.length} sessions, `
        + `${invites.filter((i) => sampleEventIds.has(i.eventId)).length} invitations`,
      note: 'Everything marked as a sample catalogue entry, and everything attached to it.',
      ops: (): BatchOperation[] => [
        ...sampleEvents.map((e) => ({ op: 'remove' as const, key: 'events' as CollectionKey, id: e.id })),
        ...sampleSessions.map((s) => ({ op: 'remove' as const, key: 'sessions' as CollectionKey, id: s.id })),
        ...invites.filter((i) => sampleEventIds.has(i.eventId))
          .map((i) => ({ op: 'remove' as const, key: 'invites' as CollectionKey, id: i.id })),
        ...prizes.filter((p) => sampleEventIds.has((p as { eventId?: string }).eventId ?? ''))
          .map((p) => ({ op: 'remove' as const, key: 'prizes' as CollectionKey, id: p.id })),
        ...costs.filter((c) => sampleEventIds.has((c as { eventId?: string }).eventId ?? ''))
          .map((c) => ({ op: 'remove' as const, key: 'costs' as CollectionKey, id: c.id })),
        ...attendance.filter((a) => sampleSessionIds.has(a.sessionId))
          .map((a) => ({ op: 'remove' as const, key: 'attendance' as CollectionKey, id: a.id })),
      ],
    },
    {
      key: 'people',
      label: 'Demo people in the directory',
      detail: `${users.filter((u) => !protectedIds.has(u.id)).length} profiles`,
      note: 'Everyone except you and the bootstrap administrators. Real colleagues '
        + 'are recreated automatically the next time they sign in.',
      ops: (): BatchOperation[] => users.filter((u) => !protectedIds.has(u.id))
        .map((u) => ({ op: 'remove' as const, key: 'users' as CollectionKey, id: u.id })),
    },
    {
      key: 'noise',
      label: 'Demo activity',
      detail: `${communityTopics.length} community posts, ${messages.length} messages, `
        + `${feedback.length} feedback entries, ${announcements.length} announcements`,
      note: 'Conversation and feedback generated to illustrate the features.',
      ops: (): BatchOperation[] => [
        ...communityTopics.map((x) => ({ op: 'remove' as const, key: 'communityTopics' as CollectionKey, id: x.id })),
        ...messages.map((x) => ({ op: 'remove' as const, key: 'messages' as CollectionKey, id: x.id })),
        ...feedback.map((x) => ({ op: 'remove' as const, key: 'feedback' as CollectionKey, id: x.id })),
        ...announcements.map((x) => ({ op: 'remove' as const, key: 'announcements' as CollectionKey, id: x.id })),
      ],
    },
    {
      key: 'dining',
      label: 'Dining services',
      detail: `${mealServices.length} sittings`,
      note: 'Menus and meal choices. Not tied to an event, so they go as a set.',
      ops: (): BatchOperation[] => mealServices.map(
        (m) => ({ op: 'remove' as const, key: 'mealServices' as CollectionKey, id: m.id })),
    },
    {
      key: 'sponsors',
      label: 'Sponsors',
      detail: `${sponsors.length} organisations`,
      note: 'These are real partners and shared across every event. Usually worth keeping.',
      ops: (): BatchOperation[] => sponsors.map(
        (s) => ({ op: 'remove' as const, key: 'sponsors' as CollectionKey, id: s.id })),
    },
    {
      key: 'rooms',
      label: 'Rooms and strands',
      detail: `${rooms.length} rooms, ${tracks.length} strands`,
      note: 'Rooms are the school’s actual spaces. Almost always worth keeping.',
      ops: (): BatchOperation[] => [
        ...rooms.map((r) => ({ op: 'remove' as const, key: 'rooms' as CollectionKey, id: r.id })),
        ...tracks.map((t) => ({ op: 'remove' as const, key: 'tracks' as CollectionKey, id: t.id })),
      ],
    },
  ]), [sampleEvents, sampleSessions, sampleEventIds, sampleSessionIds, invites, prizes,
       costs, attendance, users, protectedIds, communityTopics, messages, feedback,
       announcements, mealServices, sponsors, rooms, tracks]);

  const selected = groups.filter((g) => chosen.has(g.key));
  const ops = selected.flatMap((g) => g.ops());
  const armed = typed.trim().toUpperCase() === 'DELETE' && ops.length > 0;

  const run = async () => {
    if (!armed) return;
    setBusy(true); setError(null);
    try {
      await onCommit(ops);
      setDone(`${ops.length} record${ops.length === 1 ? '' : 's'} deleted.`);
      setChosen(new Set()); setTyped('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Eraser className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Clear sample content</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The platform ships populated so it can be understood before it is configured.
          Once you are setting up a real event, that catalogue is in the way. Choose what
          to remove — nothing is selected, and there is no undo.
        </p>
      </div>

      <div className="space-y-2.5">
        {groups.map((g) => {
          const on = chosen.has(g.key);
          const count = g.ops().length;
          return (
            <button
              key={g.key}
              onClick={() => {
                const next = new Set(chosen);
                if (on) next.delete(g.key); else next.add(g.key);
                setChosen(next); setTyped('');
              }}
              disabled={count === 0}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                on ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  on ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                }`}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">
                    {g.label}
                    <span className="ml-2 font-normal text-slate-400">
                      {count === 0 ? 'nothing to remove' : `${count} record${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{g.detail}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{g.note}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Your own account and the bootstrap administrators are never deleted, whatever
          is selected — losing every administrator would lock the platform with no way
          back in. Colleagues who sign in again get a fresh profile automatically.
        </p>
      </div>

      {error && <Notice>{error}</Notice>}
      {done && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-300">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-sm font-semibold text-emerald-900">
            {done} You can now build the real programme from Events and Import.
          </p>
        </div>
      )}

      {ops.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-400 p-5">
          <div className="flex items-start gap-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              This deletes <strong>{ops.length} record{ops.length === 1 ? '' : 's'}</strong> permanently.
              There is no undo and no export. Type <strong>DELETE</strong> to confirm.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className={`${inputClass} max-w-[10rem] font-mono tracking-widest`}
            />
            <button
              onClick={run}
              disabled={!armed || busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
              Delete {ops.length} record{ops.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
