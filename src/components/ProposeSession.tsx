import React, { useMemo, useState } from 'react';
import {
  Presentation, Plus, Loader2, Check, Clock, MessageSquare, X, MapPin,
} from 'lucide-react';
import { Session, Track, UserProfile, EventConfig } from '../types';
import { Field, inputClass, Notice } from './admin/formKit';

interface ProposeSessionProps {
  currentUser: UserProfile;
  sessions: Session[];
  tracks: Track[];
  events: EventConfig[];
  rooms: { id: string; name: string }[];
  onSubmit: (session: Session) => Promise<void>;
}

/**
 * A speaker writing their own session.
 *
 * The speaker knows what they are presenting; an organiser transcribing it
 * from an email does not, and every retyping is a chance to lose a subtitle or
 * mistake a capacity. Submitting here means the description that reaches the
 * public page is the one the presenter wrote.
 *
 * Room and time are deliberately absent. A speaker cannot know what else is on
 * at eleven on the Friday, so asking them to choose invites a clash they have
 * no way to see. They say how long they need and which days do not work; the
 * scheduler does the rest.
 */
export const ProposeSession: React.FC<ProposeSessionProps> = ({
  currentUser, sessions, tracks, events, rooms, onSubmit,
}) => {
  const openEvents = events.filter((e) => e.status !== 'draft');
  const [eventId, setEventId] = useState(
    () => openEvents.find((e) => e.isFeatured)?.id ?? openEvents[0]?.id ?? '');
  const [form, setForm] = useState({
    title: '', description: '', trackId: '', maxAttendees: 30,
    requestedMinutes: 75, unavailableDays: [] as number[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /** Everything this speaker has put forward, whatever became of it. */
  const mine = useMemo(
    () => sessions.filter((s) =>
      s.proposedBy === currentUser.id || s.speakerIds.includes(currentUser.id)),
    [sessions, currentUser.id]);

  const submit = async () => {
    if (!form.title.trim()) { setError('Give the session a title.'); return; }
    if (!form.description.trim()) { setError('Add a description — this is what attendees choose from.'); return; }
    setBusy(true); setError(null);
    try {
      await onSubmit({
        id: `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        eventId,
        // No room and no time yet: the scheduler assigns both once approved.
        roomId: '', trackId: form.trackId,
        title: form.title.trim(),
        description: form.description.trim(),
        day: 0, dateStr: '', startTime: '', endTime: '',
        startMinutes: 0, endMinutes: 0,
        maxAttendees: form.maxAttendees,
        reservedUserIds: [], waitlistUserIds: [],
        speakerIds: [currentUser.id],
        tags: [],
        status: 'proposed',
        proposedBy: currentUser.id,
        submittedAt: new Date().toISOString(),
        requestedMinutes: form.requestedMinutes,
        ...(form.unavailableDays.length ? { unavailableDays: form.unavailableDays } : {}),
      });
      setSent(true);
      setForm({ title: '', description: '', trackId: '', maxAttendees: 30,
                requestedMinutes: 75, unavailableDays: [] });
      setTimeout(() => setSent(false), 4000);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const StatusPill: React.FC<{ s: Session }> = ({ s }) => {
    const [label, cls] =
      s.status === 'proposed' ? ['With the organisers', 'bg-amber-50 text-amber-800 border-amber-300']
      : s.status === 'declined' ? ['Not this time', 'bg-slate-100 text-slate-500 border-slate-300']
      : s.roomId ? ['Scheduled', 'bg-emerald-50 text-emerald-800 border-emerald-300']
      : ['Approved — awaiting a slot', 'bg-blue-50 text-blue-700 border-blue-300'];
    return (
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {mine.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Your sessions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Where each one stands. You are told here rather than having to ask.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {mine.map((s) => (
              <div key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 leading-snug">{s.title}</div>
                    {s.roomId && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Day {s.day} · {s.startTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {rooms.find((r) => r.id === s.roomId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <StatusPill s={s} />
                </div>
                {s.reviewNote && (
                  <div className="flex items-start gap-1.5 mt-2 p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-600">
                    <MessageSquare className="w-3 h-3 shrink-0 mt-px text-slate-400" />
                    {s.reviewNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Presentation className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Propose a session</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          What you write here is what appears on the programme, so put it in your own
          words. An organiser reads it and comes back to you.
        </p>

        <div className="space-y-4">
          <Field label="Event">
            <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {openEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>

          <Field label="Title" hint="What an attendee sees first when choosing.">
            <input className={inputClass} value={form.title}
                   onChange={(e) => setForm({ ...form, title: e.target.value })}
                   placeholder="Argument in the Age of Autocomplete" />
          </Field>

          <Field label="Description" hint="Two or three sentences. What will someone leave able to do?">
            <textarea className={`${inputClass} resize-y`} rows={4} value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Strand">
              <select className={inputClass} value={form.trackId}
                      onChange={(e) => setForm({ ...form, trackId: e.target.value })}>
                <option value="">Not sure</option>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Room size needed" hint="How many people it works for.">
              <input type="number" min={5} className={inputClass} value={form.maxAttendees}
                     onChange={(e) => setForm({ ...form, maxAttendees: Number(e.target.value) })} />
            </Field>
            <Field label="Minutes needed">
              <select className={inputClass} value={form.requestedMinutes}
                      onChange={(e) => setForm({ ...form, requestedMinutes: Number(e.target.value) })}>
                {[45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </Field>
          </div>

          {/* Days, not times: a speaker cannot see what else is on at eleven,
              so asking them to pick a time invites a clash they cannot avoid. */}
          <Field label="Any day you cannot attend" hint="Left blank means either day works.">
            <div className="flex gap-2">
              {[1, 2].map((d) => {
                const on = form.unavailableDays.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => setForm({
                      ...form,
                      unavailableDays: on
                        ? form.unavailableDays.filter((x) => x !== d)
                        : [...form.unavailableDays, d],
                    })}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      on ? 'bg-amber-100 text-amber-900 border-amber-400'
                         : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                    }`}
                  >
                    {on && <X className="w-3 h-3 inline mr-1" />}
                    Day {d}
                  </button>
                );
              })}
            </div>
          </Field>

          {error && <Notice>{error}</Notice>}
          {sent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-300">
              <Check className="w-4 h-4 text-emerald-700" />
              <p className="text-xs font-semibold text-emerald-900">
                Submitted. You will see the decision above, with any note from the organisers.
              </p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Submit for review
          </button>
        </div>
      </div>
    </div>
  );
};
