import React, { useMemo, useState } from 'react';
import { CalendarDays, Pencil, X, Clock, MapPin, Star } from 'lucide-react';
import { EventConfig, Session, Track, Room, UserProfile } from '../../types';
import {
  Field, inputClass, Notice, SectionHeader, ConfirmDelete,
  toMinutes, toDisplayTime, toInputTime,
} from './formKit';

interface AdminProgrammeProps {
  events: EventConfig[];
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  profiles: UserProfile[];
  onSave: (session: Session, isNew: boolean) => Promise<void> | void;
  onDelete: (sessionId: string) => Promise<void> | void;
}

const blank = (eventId: string, tracks: Track[], rooms: Room[]): Session => ({
  id: `sess-${Date.now()}`,
  eventId,
  roomId: rooms[0]?.id ?? '',
  trackId: tracks[0]?.id ?? '',
  title: '',
  description: '',
  day: 1,
  dateStr: '',
  startTime: '09:00 AM',
  endTime: '10:15 AM',
  startMinutes: 540,
  endMinutes: 615,
  maxAttendees: rooms[0]?.capacity ?? 30,
  reservedUserIds: [],
  waitlistUserIds: [],
  speakerIds: [],
  tags: [],
});

/**
 * Agenda builder.
 *
 * Two checks run before a session can be saved, because both mistakes are
 * silent and both are discovered on the day: a room booked twice at the same
 * hour, and a session seating more people than the room holds. Neither is a
 * hypothetical — the seeded programme had three over-capacity sessions when
 * the real rooms were introduced.
 */
export const AdminProgramme: React.FC<AdminProgrammeProps> = ({
  events, sessions, tracks, rooms, profiles, onSave, onDelete,
}) => {
  const withProgramme = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.eventId));
    return events.filter((e) => ids.has(e.id) || e.status !== 'published');
  }, [events, sessions]);

  const [eventId, setEventId] = useState(
    () => withProgramme.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '',
  );
  const [editing, setEditing] = useState<Session | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = useMemo(
    () => sessions
      .filter((s) => s.eventId === eventId)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [sessions, eventId],
  );

  const days = useMemo(() => {
    const seen: number[] = [];
    for (const s of mine) if (!seen.includes(s.day)) seen.push(s.day);
    return seen.sort((a, b) => a - b);
  }, [mine]);

  const roomOf = (id: string) => rooms.find((r) => r.id === id);
  const trackOf = (id: string) => tracks.find((t) => t.id === id);

  const set = <K extends keyof Session>(key: K, value: Session[K]) =>
    setEditing((s) => (s ? { ...s, [key]: value } : s));

  const validate = (s: Session): string | null => {
    if (!s.title.trim()) return 'The session needs a title.';
    if (!s.roomId) return 'Choose a room.';
    if (s.endMinutes <= s.startMinutes) return 'The end time must be after the start time.';

    const room = roomOf(s.roomId);
    if (room && s.maxAttendees > room.capacity) {
      return `${room.name} holds ${room.capacity}. Reduce the seat count, or choose a larger room.`;
    }

    const clash = sessions.find((o) =>
      o.id !== s.id &&
      o.eventId === s.eventId &&
      o.roomId === s.roomId &&
      o.day === s.day &&
      o.startMinutes < s.endMinutes &&
      s.startMinutes < o.endMinutes);
    if (clash) {
      return `${room?.name ?? 'That room'} is already booked on day ${s.day} — "${clash.title}" runs ${clash.startTime}–${clash.endTime}.`;
    }
    return null;
  };

  const save = async () => {
    if (!editing) return;
    const problem = validate(editing);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      // dateStr is display text on the badge and signage; derive it from the
      // parent event so a session cannot drift from its event's dates.
      const evt = events.find((e) => e.id === editing.eventId);
      const base = editing.day === 1 ? evt?.startDate : evt?.endDate;
      const dateStr = base
        ? new Date(`${base}T00:00:00`).toLocaleDateString('en-US',
            { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
        : editing.dateStr;
      await onSave({ ...editing, dateStr }, isNew);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ editor
  if (editing) {
    const room = roomOf(editing.roomId);
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New session' : `Editing: ${editing.title || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Field label="Title">
            <input className={inputClass} value={editing.title}
                   onChange={(e) => set('title', e.target.value)}
                   placeholder="Opening Keynote: Human at the Centre" />
          </Field>

          <Field label="Description">
            <textarea className={`${inputClass} resize-none`} rows={4} value={editing.description}
                      onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Day">
              <select className={inputClass} value={editing.day}
                      onChange={(e) => set('day', Number(e.target.value))}>
                <option value={1}>Day 1</option>
                <option value={2}>Day 2</option>
                <option value={3}>Day 3</option>
              </select>
            </Field>
            <Field label="Starts">
              <input type="time" className={inputClass} value={toInputTime(editing.startTime)}
                     onChange={(e) => {
                       const display = toDisplayTime(e.target.value);
                       setEditing((s) => s ? {
                         ...s, startTime: display, startMinutes: toMinutes(display),
                       } : s);
                     }} />
            </Field>
            <Field label="Ends">
              <input type="time" className={inputClass} value={toInputTime(editing.endTime)}
                     onChange={(e) => {
                       const display = toDisplayTime(e.target.value);
                       setEditing((s) => s ? {
                         ...s, endTime: display, endMinutes: toMinutes(display),
                       } : s);
                     }} />
            </Field>
            <Field label="Seats" hint={room ? `${room.name} holds ${room.capacity}.` : undefined}>
              <input type="number" min={1} className={inputClass} value={editing.maxAttendees}
                     onChange={(e) => set('maxAttendees', Number(e.target.value))} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Room">
              <select
                className={inputClass}
                value={editing.roomId}
                onChange={(e) => {
                  const next = roomOf(e.target.value);
                  setEditing((s) => s ? {
                    ...s,
                    roomId: e.target.value,
                    // Follow the room down, never silently up: moving to a
                    // smaller room must not leave the session oversubscribed.
                    maxAttendees: next ? Math.min(s.maxAttendees, next.capacity) : s.maxAttendees,
                  } : s);
                }}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} · {r.capacity} seats</option>
                ))}
              </select>
            </Field>
            <Field label="Mission strand">
              <select className={inputClass} value={editing.trackId}
                      onChange={(e) => set('trackId', e.target.value)}>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Speakers" hint="Anyone in the directory. Ctrl- or Cmd-click to select more than one.">
            <select
              multiple
              size={Math.min(6, Math.max(3, profiles.length))}
              className={`${inputClass} h-auto`}
              value={editing.speakerIds}
              onChange={(e) => set('speakerIds',
                Array.from(e.target.selectedOptions).map((o) => o.value))}
            >
              {profiles
                .slice()
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}{p.title ? ` — ${p.title}` : ''}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Tags" hint="Comma separated. Shown on the session card and used for filtering.">
            <input className={inputClass} value={editing.tags.join(', ')}
                   onChange={(e) => set('tags',
                     e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" className="accent-blue-600"
                   checked={Boolean(editing.isFeatured)}
                   onChange={(e) => set('isFeatured', e.target.checked)} />
            Feature this session on the agenda
          </label>

          {error && <Notice>{error}</Notice>}

          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy}
                    className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
              {busy ? 'Saving…' : isNew ? 'Add session' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)}
                    className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- list
  return (
    <div className="space-y-5">
      <SectionHeader
        icon={CalendarDays}
        title="Programme"
        subtitle={`${mine.length} session${mine.length === 1 ? '' : 's'}. Room clashes and over-capacity sessions are refused on save.`}
        action={rooms.length && tracks.length ? {
          label: 'New session',
          onClick: () => { setEditing(blank(eventId, tracks, rooms)); setIsNew(true); setError(null); },
        } : undefined}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <Field label="Event" hint="Sessions belong to one event. Choose which programme you are editing.">
          <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {(withProgramme.length ? withProgramme : events).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.status === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {(!rooms.length || !tracks.length) && (
        <Notice>
          Add at least one room and one mission strand before creating sessions —
          every session needs both.
        </Notice>
      )}

      {days.length === 0 ? (
        <p className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400 italic">
          No sessions yet for this event.
        </p>
      ) : days.map((day) => (
        <div key={day} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wide">
            Day {day}
          </div>
          <div className="divide-y divide-slate-100">
            {mine.filter((s) => s.day === day).map((s) => {
              const room = roomOf(s.roomId);
              const track = trackOf(s.trackId);
              const over = room ? s.maxAttendees > room.capacity : false;
              return (
                <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="sm:w-36 shrink-0">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {s.startTime}
                    </div>
                    <div className="text-[11px] text-slate-400 ml-5">to {s.endTime}</div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {track && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wide"
                              style={{ backgroundColor: track.colorHex }}>
                          {track.name}
                        </span>
                      )}
                      {s.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="text-sm font-bold text-slate-900 leading-snug">{s.title}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {room?.name ?? 'No room'}
                      </span>
                      <span className={over ? 'text-amber-700 font-semibold' : ''}>
                        {s.reservedUserIds.length}/{s.maxAttendees} seats
                        {over && ' — over room capacity'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditing({ ...s }); setIsNew(false); setError(null); }}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <ConfirmDelete onConfirm={() => onDelete(s.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
