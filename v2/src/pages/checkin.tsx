import React, { useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, CircleCheck, Clock, MapPin, RefreshCw, AlertTriangle, ScanLine } from 'lucide-react';
import { Attendance, Event, Room, Session, Sponsor, Track } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isStaff } from '../lib/roles';
import { randomCode } from '../lib/hash';
import { formatTime, nowIso, formatClock } from '../lib/time';
import { Mark } from '../components/Mark';
import { Button, Card, Spinner, Empty } from '../components/ui';

/** The address a door QR opens. */
export const hereUrl = (slug: string, sessionId: string, code: string) =>
  `${window.location.origin}/e/${slug}/here?s=${encodeURIComponent(sessionId)}&c=${encodeURIComponent(code)}`;

/**
 * The QR on a session's door — shown on a tablet or printed.
 *
 * Whoever scans it with their own phone records their own attendance at
 * this session, and the rules only accept the code printed here. A new
 * code makes every earlier print worthless.
 */
export const DoorQr: React.FC = () => {
  const { eventId, sessionId } = useParams();
  const { profile } = useAuth();
  const { doc: event, ready: eReady } = useDoc('events', eventId ?? null);
  const { doc: session, ready: sReady } = useDoc('sessions', sessionId ?? null);
  const rooms = useWatch('rooms', eventId ? [{ field: 'eventId', op: '==', value: eventId }] : [], Boolean(eventId));
  const arrivals = useWatch('attendance', sessionId ? [{ field: 'eventId', op: '==', value: eventId }, { field: 'sessionId', op: '==', value: sessionId }] : [], Boolean(sessionId));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session && !session.checkinCode && sessionId) void store.update('sessions', sessionId, { checkinCode: randomCode() });
  }, [session, sessionId]);
  if (!isStaff(profile)) return <Navigate to="/dashboard" replace />;
  if (!eReady || !sReady) return <Spinner />;
  if (!event || !session) return <div className="p-10"><Empty icon={ScanLine} title="No such session" action={<Button to="/admin/events">Events</Button>} /></div>;
  const room = rooms.items.find((r) => r.id === session.roomId);
  const rotate = async () => { setBusy(true); await store.update('sessions', session.id, { checkinCode: randomCode() }); setBusy(false); };
  return (
    <div className="min-h-screen bg-blue-900 text-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <Link to={`/admin/events/${event.id}/checkin`} className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"><ArrowLeft className="w-4 h-4" />Check-in</Link>
        <span className="flex items-center gap-2"><Mark size={26} light /><span className="font-display font-bold">CI Connects</span></span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center max-w-5xl w-full">
          <div className="rise">
            <div className="eyebrow text-blue-200/80">{event.name} · scan to confirm you are here</div>
            <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl mt-3 leading-tight">{session.title}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-white/80">
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-200" />{formatTime(session.start)} – {formatTime(session.end)}</span>
              {room && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-blue-200" />{room.name}</span>}
            </div>
            <div className="mt-8 flex items-center gap-6">
              <div><div className="text-4xl font-display font-bold tabular-nums">{arrivals.items.length}</div><div className="text-[11px] uppercase tracking-wider text-white/50 mt-1">confirmed here</div></div>
              <div><div className="text-4xl font-display font-bold tabular-nums">{session.checkinCode ?? '——'}</div><div className="text-[11px] uppercase tracking-wider text-white/50 mt-1">door code</div></div>
            </div>
            <div className="mt-8 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void rotate()} busy={busy}><RefreshCw className="w-3.5 h-3.5" />New code</Button>
            </div>
            <p className="text-xs text-white/50 mt-4 max-w-sm">Point a phone camera at the code. It opens CI Connects, signs the person in if they are not already, and records them at this session. A new code retires every copy of the old one.</p>
          </div>
          <div className="rise d2 flex justify-center">
            <div className="bg-white rounded-3xl p-6 shadow-[var(--shadow-pop)]">
              {session.checkinCode
                ? <QRCodeSVG value={hereUrl(event.slug, session.id, session.checkinCode)} size={320} level="M" />
                : <div className="w-[320px] h-[320px] flex items-center justify-center text-ink-500 text-sm">Making a code…</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface Ctx { event: Event; sessions: Session[]; rooms: Room[]; tracks: Track[]; sponsors: Sponsor[]; mine: Session[]; base: string }

/** What a door QR opens on the person's own phone. */
export const HerePage: React.FC = () => {
  const { event, sessions, rooms, base } = useOutletContext<Ctx>();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get('s') ?? '';
  const code = params.get('c') ?? '';
  const session = sessions.find((s) => s.id === sessionId);
  const mine = useWatch('attendance', user ? [{ field: 'eventId', op: '==', value: event.id }, { field: 'userId', op: '==', value: user.uid }] : [], Boolean(user));
  const already = mine.items.find((a) => a.sessionId === sessionId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!user) return null;
  if (!session) return <Empty icon={ScanLine} title="That session is not on this programme" action={<Button to={`${base}/schedule`}>Programme</Button>} />;
  const room = rooms.find((r) => r.id === session.roomId);
  const valid = Boolean(code) && session.checkinCode === code;
  const confirm = async () => {
    setBusy(true); setProblem(null);
    const rec: Attendance = { id: `${event.id}__${session.id}__${user.uid}`, eventId: event.id, sessionId: session.id, userId: user.uid, at: nowIso(), by: user.uid, code };
    try { await store.set('attendance', rec.id, rec); setDone(true); }
    catch { setProblem('That did not go through. The door code may have changed — ask at the door.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="max-w-md mx-auto">
      <Card className="p-6 text-center">
        <div className="eyebrow mb-2">{event.name}</div>
        <h2 className="text-xl font-bold text-ink-900">{session.title}</h2>
        <div className="text-sm text-ink-500 mt-1">{formatTime(session.start)} – {formatTime(session.end)}{room ? ` · ${room.name}` : ''}</div>
        <div className="mt-6">
          {already || done ? (
            <div className="inline-flex flex-col items-center gap-2 text-emerald-800"><CircleCheck className="w-10 h-10 text-emerald-600" /><span className="font-semibold">You are in.</span><span className="text-xs text-ink-500">Recorded {formatClock(already?.at ?? nowIso())}</span></div>
          ) : !valid ? (
            <div className="inline-flex flex-col items-center gap-2 text-amber-900"><AlertTriangle className="w-8 h-8 text-amber-600" /><span className="font-semibold">This door code is no longer valid.</span><span className="text-xs text-ink-500">Ask at the door for the current one.</span></div>
          ) : (
            <Button onClick={() => void confirm()} busy={busy} className="w-full py-3.5 text-base">Confirm I am here</Button>
          )}
          {problem && <p className="text-xs text-rose-700 mt-3">{problem}</p>}
        </div>
      </Card>
      <div className="text-center mt-4"><Link to={`${base}/schedule`} className="text-sm text-blue-700 hover:underline">Back to the programme</Link></div>
    </div>
  );
};
