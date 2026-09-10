import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Clock, MapPin, Users, Check, AlertTriangle, Star, ExternalLink, Pencil } from 'lucide-react';
import { Event, Session, Room, Track, Feedback, Sponsor, SESSION_TYPE_LABEL } from '../lib/types';
import { useWatch } from '../lib/hooks';
import { store } from '../lib/store';
import { useAuth } from '../lib/auth';
import { isStaff } from '../lib/roles';
import { formatTime, todayYmd, nowIso, toMinutes } from '../lib/time';
import { seatState, toggleSeat, clashesFor, SeatState } from '../lib/schedule';
import { Button, Chip, Drawer, Textarea, Notice } from './ui';

/** Everything inside one event, live. */
export function useEventData(eventId: string | null) {
  const f = eventId ? [{ field: 'eventId', op: '==' as const, value: eventId }] : [];
  const on = Boolean(eventId);
  const sessions = useWatch('sessions', f, on);
  const rooms = useWatch('rooms', f, on);
  const tracks = useWatch('tracks', f, on);
  const sponsors = useWatch('sponsors', f, on);
  return useMemo(() => ({
    sessions: sessions.items, rooms: [...rooms.items].sort((a, b) => a.order - b.order),
    tracks: [...tracks.items].sort((a, b) => a.order - b.order),
    sponsors: [...sponsors.items].sort((a, b) => a.order - b.order),
    ready: sessions.ready && rooms.ready && tracks.ready && sponsors.ready,
  }), [sessions, rooms, tracks, sponsors]);
}

export const TrackDot: React.FC<{ track?: Track; className?: string }> = ({ track, className = '' }) =>
  track ? <span className={`inline-block w-2 h-2 rounded-full ${className}`} style={{ background: track.color }} title={track.name} /> : null;

const TYPE_TONE: Record<string, string> = {
  keynote: 'bg-blue-600 text-white', panel: 'bg-blue-100 text-blue-700', workshop: 'bg-emerald-100 text-emerald-800',
  talk: 'bg-sand-200 text-ink-700', break: 'bg-sand-100 text-ink-500 border border-sand-200', social: 'bg-amber-100 text-amber-900',
};

const seatLabel = (state: SeatState, s: Session): { label: string; tone: string; icon?: React.ElementType } => {
  switch (state) {
    case 'reserved': return { label: s.capacity ? 'Seat reserved' : 'On my day', tone: 'bg-emerald-600 text-white hover:bg-emerald-700', icon: Check };
    case 'waitlisted': return { label: `Waitlisted #${s.waitlistUserIds.length}`, tone: 'bg-amber-100 text-amber-900 hover:bg-amber-200', icon: Clock };
    case 'full': return { label: 'Full — join waitlist', tone: 'bg-white border border-sand-300 text-ink-700 hover:border-ink-300' };
    case 'unlimited': return { label: 'Add to my day', tone: 'bg-white border border-sand-300 text-ink-700 hover:border-ink-300' };
    default: return { label: 'Reserve a seat', tone: 'bg-blue-600 text-white hover:bg-blue-700' };
  }
};

export const SeatButton: React.FC<{ session: Session; size?: 'sm' | 'md'; className?: string }> = ({ session, size = 'sm', className = '' }) => {
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user || !profile || session.type === 'break' || session.type === 'social') return null;
  const state = seatState(session, user.uid);
  const { label, tone, icon: Icon } = seatLabel(state, session);
  const act = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setBusy(true);
    try { await store.update('sessions', session.id, toggleSeat(session, user.uid)); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={act} disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${tone} ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}{label}
    </button>
  );
};

/** One session in a list: time, what, where, who, and the seat. */
export const SessionCard: React.FC<{
  session: Session; room?: Room; track?: Track; sponsor?: Sponsor; to: string; compact?: boolean; mineIds?: Set<string>;
}> = ({ session: s, room, track, sponsor, to, compact, mineIds }) => {
  const { user } = useAuth();
  const mine = user ? seatState(s, user.uid) === 'reserved' : false;
  const quiet = s.type === 'break' || s.type === 'social';
  const clash = mineIds && !mine && user && [...mineIds].length > 0 ? false : false;
  void clash;
  return (
    <Link to={to} className={`block card p-4 hover:border-blue-300 transition-colors ${quiet ? 'bg-sand-50' : ''} ${mine ? 'ring-1 ring-emerald-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`chip ${TYPE_TONE[s.type] ?? TYPE_TONE.talk}`}>{SESSION_TYPE_LABEL[s.type]}</span>
            {track && <span className="chip bg-white border border-sand-200 text-ink-700"><TrackDot track={track} />{track.name}</span>}
            {s.featured && <span className="chip bg-amber-100 text-amber-900"><Star className="w-3 h-3" />Featured</span>}
            {compact && <span className="text-[11px] text-ink-500 tabular-nums">{formatTime(s.start)}–{formatTime(s.end)}</span>}
          </div>
          <h3 className={`font-semibold text-ink-900 leading-snug ${compact ? 'text-sm' : 'text-base'}`}>{s.title}</h3>
          {!compact && s.abstract && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{s.abstract}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
            {room && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{room.name}</span>}
            {s.speakers.length > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.speakers.map((sp) => sp.name).join(', ')}</span>}
            {s.capacity > 0 && <span className="tabular-nums">{s.reservedUserIds.length}/{s.capacity} seats{s.waitlistUserIds.length > 0 ? ` · ${s.waitlistUserIds.length} waiting` : ''}</span>}
            {sponsor && <span className="text-blue-700">with {sponsor.name}</span>}
          </div>
        </div>
        {!quiet && <div className="shrink-0"><SeatButton session={s} /></div>}
      </div>
    </Link>
  );
};

/** The programme as a grid: rooms across, time down. */
export const RoomGrid: React.FC<{ sessions: Session[]; rooms: Room[]; tracks: Track[]; basePath: string }> = ({ sessions, rooms, tracks, basePath }) => {
  const usedRooms = rooms.filter((r) => sessions.some((s) => s.roomId === r.id));
  const times = [...new Set(sessions.map((s) => s.start))].sort((a, b) => toMinutes(a) - toMinutes(b));
  return (
    <div className="overflow-x-auto -mx-5 px-5 pb-2">
      <div className="min-w-[56rem] grid gap-2" style={{ gridTemplateColumns: `5.5rem repeat(${usedRooms.length}, minmax(13rem, 1fr))` }}>
        <div />
        {usedRooms.map((r) => (
          <div key={r.id} className="eyebrow px-1 pb-1 border-b border-sand-300 truncate" title={r.location}>{r.name}</div>
        ))}
        {times.map((t) => (
          <React.Fragment key={t}>
            <div className="text-xs font-semibold text-ink-700 tabular-nums pt-2">{formatTime(t)}</div>
            {usedRooms.map((r) => {
              const here = sessions.filter((s) => s.start === t && s.roomId === r.id);
              return (
                <div key={r.id} className="space-y-2">
                  {here.map((s) => <SessionCard key={s.id} session={s} room={r} track={tracks.find((x) => x.id === s.trackId)} to={`${basePath}/${s.id}`} compact />)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** The full detail of one session, with the seat, the clash warning, and
 *  feedback once it has happened. */
export const SessionDrawer: React.FC<{
  event: Event; session: Session | null; rooms: Room[]; tracks: Track[]; sponsors?: Sponsor[]; mine: Session[]; onClose: () => void;
}> = ({ event, session: s, rooms, tracks, sponsors = [], mine, onClose }) => {
  const { user, profile } = useAuth();
  const room = rooms.find((r) => r.id === s?.roomId);
  const track = tracks.find((t) => t.id === s?.trackId);
  const sponsor = sponsors.find((x) => x.id === s?.sponsorId);
  const clashes = s ? clashesFor(s, mine) : [];
  const over = s ? (s.date < todayYmd() || (s.date === todayYmd() && toMinutes(s.end) < new Date().getHours() * 60 + new Date().getMinutes())) : false;
  return (
    <Drawer open={Boolean(s)} onClose={onClose} title={s ? SESSION_TYPE_LABEL[s.type] : ''}>
      {s && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {track && <span className="chip bg-white border border-sand-200 text-ink-700"><TrackDot track={track} />{track.name}</span>}
              {s.featured && <span className="chip bg-amber-100 text-amber-900"><Star className="w-3 h-3" />Featured</span>}
            </div>
            <h2 className="text-xl font-bold text-ink-900 leading-snug">{s.title}</h2>
            <div className="mt-3 space-y-1.5 text-sm text-ink-700">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-ink-300" /><span className="tabular-nums">{formatTime(s.start)} – {formatTime(s.end)}</span></div>
              {room && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-ink-300" />{room.name}{room.location ? <span className="text-ink-500"> · {room.location}</span> : null}</div>}
              {s.capacity > 0 && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-ink-300" /><span className="tabular-nums">{s.reservedUserIds.length} of {s.capacity} seats taken{s.waitlistUserIds.length > 0 ? `, ${s.waitlistUserIds.length} waiting` : ''}</span></div>}
            </div>
          </div>

          {s.capacity > 0 && (
            <div className="h-1.5 rounded-full bg-sand-200 overflow-hidden">
              <div className={`h-full rounded-full ${s.reservedUserIds.length >= s.capacity ? 'bg-rose-500' : 'bg-blue-400'}`} style={{ width: `${Math.min(100, (s.reservedUserIds.length / s.capacity) * 100)}%` }} />
            </div>
          )}

          {clashes.length > 0 && (
            <Notice tone="warn"><span className="inline-flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>Overlaps with <strong>{clashes.map((c) => c.title).join(', ')}</strong>, which you already hold.</span></span></Notice>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SeatButton session={s} size="md" />
            {isStaff(profile) && (
              <Link to={`/admin/events/${event.id}/schedule?session=${s.id}`} className="btn-secondary"><Pencil className="w-4 h-4" />Edit</Link>
            )}
          </div>

          {s.abstract && <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{s.abstract}</p>}

          {sponsor && (
            <div className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3">
              {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt="" className="h-8 max-w-[7rem] object-contain" /> : null}
              <div className="min-w-0"><div className="eyebrow">Session partner</div><div className="text-sm font-semibold text-ink-900 truncate">{sponsor.name}</div></div>
            </div>
          )}

          {s.speakers.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Speakers</div>
              <ul className="space-y-2">
                {s.speakers.map((sp, i) => (
                  <li key={i} className="text-sm"><span className="font-semibold text-ink-900">{sp.name}</span>{(sp.title || sp.org) && <span className="text-ink-500"> · {[sp.title, sp.org].filter(Boolean).join(', ')}</span>}</li>
                ))}
              </ul>
            </div>
          )}

          {s.materials && s.materials.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Materials</div>
              <ul className="space-y-1.5">
                {s.materials.map((m, i) => <li key={i}><a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">{m.label}<ExternalLink className="w-3 h-3" /></a></li>)}
              </ul>
            </div>
          )}

          {over && user && s.type !== 'break' && s.type !== 'social' && <FeedbackForm session={s} userId={user.uid} />}
        </div>
      )}
    </Drawer>
  );
};

const FeedbackForm: React.FC<{ session: Session; userId: string }> = ({ session, userId }) => {
  const existing = useWatch('feedback', [{ field: 'userId', op: '==', value: userId }, { field: 'sessionId', op: '==', value: session.id }]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const done = existing.items[0];
  useEffect(() => { if (done) { setRating(done.rating); setComment(done.comment ?? ''); } }, [done]);
  const submit = async () => {
    if (!rating) return;
    setBusy(true);
    const fb: Feedback = { id: done?.id ?? `${session.id}__${userId}`, eventId: session.eventId, sessionId: session.id, userId, rating, comment: comment.trim() || undefined, at: nowIso() };
    await store.set('feedback', fb.id, fb);
    setBusy(false);
  };
  return (
    <div className="card p-4 bg-sand-50">
      <div className="eyebrow mb-2">{done ? 'Your feedback' : 'How was it?'}</div>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} of 5`} className="p-0.5">
            <Star className={`w-6 h-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-sand-300'}`} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="One thing that landed, one thing to change (optional)" className="min-h-20" />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={!rating} busy={busy}>{done ? 'Update' : 'Send'}</Button>
        {done && <Chip tone="green"><Check className="w-3 h-3" />Sent</Chip>}
      </div>
    </div>
  );
};
