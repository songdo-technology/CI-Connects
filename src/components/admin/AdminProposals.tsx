import React, { useMemo, useState } from 'react';
import {
  Inbox, Check, X, Wand2, CalendarClock, AlertTriangle, Loader2, MapPin, Clock,
  MessageSquare, Undo2,
} from 'lucide-react';
import { Session, Room, Track, UserProfile, EventConfig } from '../../types';
import { BatchOperation } from '../../lib/data/store';
import { scheduleProposals, inferSlots, ScheduleResult } from '../../lib/scheduler';
import { formatClock } from '../../lib/csvImport';
import { inputClass, Notice } from './formKit';

interface AdminProposalsProps {
  sessions: Session[];
  rooms: Room[];
  tracks: Track[];
  users: UserProfile[];
  events: EventConfig[];
  currentUser: UserProfile;
  onCommit: (ops: BatchOperation[]) => Promise<void>;
}

/**
 * Session proposals, and putting the accepted ones on the timetable.
 *
 * Speakers know their own session better than an organiser transcribing it
 * from an email, so they write it. The organiser's job narrows to a judgement
 * — yes or no — and the arithmetic that follows is done here rather than in a
 * spreadsheet at eleven at night.
 *
 * The timetable is proposed, never applied. Every suggestion carries the
 * reason it was made, so an organiser can disagree with a specific decision
 * instead of having to accept or reject the whole thing.
 */
export const AdminProposals: React.FC<AdminProposalsProps> = ({
  sessions, rooms, tracks, users, events, currentUser, onCommit,
}) => {
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [plan, setPlan] = useState<ScheduleResult | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const forEvent = useMemo(
    () => sessions.filter((s) => s.eventId === eventId), [sessions, eventId]);

  const pending = forEvent.filter((s) => s.status === 'proposed');
  const declined = forEvent.filter((s) => s.status === 'declined');
  /** Approved but with nowhere and nowhen yet. */
  const awaiting = forEvent.filter((s) => s.status === 'approved' && !s.roomId);
  const scheduled = forEvent.filter((s) => s.status !== 'proposed' && s.status !== 'declined' && !!s.roomId);

  const speakerName = (s: Session) =>
    s.speakerIds.map((id) => users.find((u) => u.id === id)?.fullName).filter(Boolean).join(', ')
    || users.find((u) => u.id === s.proposedBy)?.fullName
    || 'Unknown';

  const review = async (session: Session, status: 'approved' | 'declined') => {
    setBusy(session.id); setError(null);
    try {
      await onCommit([{
        op: 'update', key: 'sessions', id: session.id,
        patch: {
          status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: currentUser.id,
          ...(note[session.id]?.trim() ? { reviewNote: note[session.id].trim() } : {}),
        },
      } as BatchOperation]);
      setPlan(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const suggest = () => {
    setError(null);
    const slots = inferSlots(scheduled);
    setPlan(scheduleProposals({
      scheduled, proposals: awaiting, rooms, tracks, slots,
    }));
  };

  const applyPlan = async () => {
    if (!plan || plan.placements.length === 0) return;
    setBusy('plan'); setError(null);
    try {
      await onCommit(plan.placements.map((p) => {
        const source = awaiting.find((s) => s.id === p.sessionId);
        return {
          op: 'update', key: 'sessions', id: p.sessionId,
          patch: {
            day: p.day,
            roomId: p.roomId,
            startMinutes: p.startMinutes,
            endMinutes: p.endMinutes,
            startTime: formatClock(p.startMinutes),
            endTime: formatClock(p.endMinutes),
            dateStr: scheduled.find((s) => s.day === p.day)?.dateStr ?? source?.dateStr ?? '',
          },
        } as BatchOperation;
      }));
      setPlan(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const Row: React.FC<{ s: Session; children?: React.ReactNode }> = ({ s, children }) => (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 leading-snug">{s.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {speakerName(s)}
            {s.trackId && ` · ${tracks.find((t) => t.id === s.trackId)?.name ?? ''}`}
            {s.maxAttendees ? ` · ${s.maxAttendees} seats` : ''}
          </div>
          {s.description && (
            <p className="text-xs text-slate-600 leading-relaxed mt-1.5 line-clamp-2">
              {s.description}
            </p>
          )}
          {s.reviewNote && (
            <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-500">
              <MessageSquare className="w-3 h-3 shrink-0 mt-px" />
              {s.reviewNote}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Inbox className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Session proposals</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          What speakers have submitted. Approving one makes it eligible for a slot;
          the timetable below is suggested, never applied on its own.
        </p>
        <select className={inputClass} value={eventId} onChange={(e) => { setEventId(e.target.value); setPlan(null); }}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {error && <Notice>{error}</Notice>}

      {/* ---------- Awaiting a decision ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Awaiting a decision
          </span>
          <span className="text-xs font-semibold text-slate-500">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 italic">
            Nothing waiting. Proposals appear here as speakers submit them.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map((s) => (
              <Row key={s.id} s={s}>
                <div className="shrink-0 w-48 space-y-2">
                  <input
                    value={note[s.id] ?? ''}
                    onChange={(e) => setNote({ ...note, [s.id]: e.target.value })}
                    placeholder="Note to the speaker…"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(s, 'approved')}
                      disabled={busy === s.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => review(s, 'declined')}
                      disabled={busy === s.id}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold hover:border-amber-500 hover:text-amber-700 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Row>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Approved, no slot ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Approved, awaiting a slot
          </span>
          <button
            onClick={suggest}
            disabled={awaiting.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Wand2 className="w-3 h-3" />
            Suggest a timetable
          </button>
        </div>
        {awaiting.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 italic">
            Nothing approved is waiting for a room.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {awaiting.map((s) => <Row key={s.id} s={s} />)}
          </div>
        )}
      </div>

      {/* ---------- The proposed timetable ---------- */}
      {plan && (
        <div className="bg-white rounded-2xl border-2 border-blue-600 overflow-hidden">
          <div className="px-5 py-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-2.5 mb-1">
              <CalendarClock className="w-4 h-4 text-blue-700" />
              <span className="text-sm font-bold text-blue-900">
                Suggested placements
              </span>
            </div>
            <p className="text-[11px] text-blue-900/80">
              {plan.placements.length} placed
              {plan.unplaced.length > 0 && `, ${plan.unplaced.length} could not be`}.
              Nothing is saved until you apply it.
            </p>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {plan.placements.map((p) => {
              const s = awaiting.find((x) => x.id === p.sessionId);
              return (
                <div key={p.sessionId} className="px-5 py-3">
                  <div className="text-sm font-semibold text-slate-800">{s?.title}</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Day {p.day} · {formatClock(p.startMinutes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {rooms.find((r) => r.id === p.roomId)?.name}
                    </span>
                  </div>
                  {/* The reason, so a specific decision can be disagreed with. */}
                  <div className="text-[10px] text-slate-400 mt-1">{p.rationale}</div>
                </div>
              );
            })}
            {plan.unplaced.map((u) => {
              const s = awaiting.find((x) => x.id === u.sessionId);
              return (
                <div key={u.sessionId} className="px-5 py-3 bg-amber-50/50">
                  <div className="text-sm font-semibold text-slate-800">{s?.title}</div>
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-800 mt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                    {u.reason}
                  </div>
                </div>
              );
            })}
          </div>

          {plan.warnings.length > 0 && (
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 space-y-1">
              {plan.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-[11px] text-amber-900">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              onClick={() => setPlan(null)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-xs font-semibold hover:border-slate-400 transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              onClick={applyPlan}
              disabled={busy === 'plan' || plan.placements.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {busy === 'plan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply {plan.placements.length} placement{plan.placements.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {declined.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Declined
            </span>
          </div>
          <div className="divide-y divide-slate-100 opacity-70">
            {declined.map((s) => (
              <Row key={s.id} s={s}>
                <button
                  onClick={() => review(s, 'approved')}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  Reconsider
                </button>
              </Row>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
