import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams, useSearchParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, CircleCheck, Clock, MapPin, RefreshCw, AlertTriangle, ScanLine, Camera, Maximize2, Users, Mic, IdCardLanyard, UserCheck, MonitorPlay,
} from 'lucide-react';
import { Attendance, Event, Profile, Room, Session, Sponsor, Track } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isStaff } from '../lib/roles';
import { randomCode } from '../lib/hash';
import { formatTime, nowIso, formatClock, todayYmd, toMinutes, formatDate } from '../lib/time';
import { Mark } from '../components/Mark';
import { OrbitDiagram } from '../components/Orbit';
import { Scanner } from '../components/Scanner';
import { Avatar, Button, Card, Spinner, Empty, Field, Select, Notice, Chip } from '../components/ui';
import { badgeUid } from '../components/Badge';
import { canSeeEvent } from '../lib/roles';
import { ROLE_LABEL } from '../lib/types';
import { roomLabel, roomWhere } from '../lib/rooms';

/** The address a door QR opens. */
export const hereUrl = (slug: string, sessionId: string, code: string) =>
  `${window.location.origin}/e/${slug}/here?s=${encodeURIComponent(sessionId)}&c=${encodeURIComponent(code)}`;

/** Which of a room's sessions its screen should show right now: the one
 *  running (from a quarter of an hour before it starts), else the next one
 *  today, else the next day's first, else the last one that ran. */
export function sessionForRoom(list: Session[], now: Date): { session: Session | null; state: 'now' | 'next' | 'later' | 'over' } {
  const today = todayYmd(); const mins = now.getHours() * 60 + now.getMinutes();
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start));
  const todays = sorted.filter((s) => s.date === today);
  const current = todays.find((s) => toMinutes(s.start) - 15 <= mins && mins <= toMinutes(s.end));
  if (current) return { session: current, state: 'now' };
  const next = todays.find((s) => toMinutes(s.start) > mins);
  if (next) return { session: next, state: 'next' };
  const later = sorted.find((s) => s.date > today);
  if (later) return { session: later, state: 'later' };
  return { session: sorted[sorted.length - 1] ?? null, state: 'over' };
}

interface Arrival { id: string; name: string; org?: string; photoUrl?: string; at: string }
const SPLASH_MS = 4200;

/**
 * The screen on a room's projector.
 *
 * It shows the session that is on (or next) in this room, a code people
 * scan with their phone to record themselves, and the count of who is in.
 * It also listens: a badge held to a handheld scanner, or to the laptop's
 * camera, is recorded here as staff — and either way, the moment a person
 * is in, their name fills the screen for a few seconds. Opened by staff,
 * for one session (`/door/<event>/<session>`) or for a room, where it
 * follows the room's programme through the day (`/door/<event>/room/<room>`).
 */
export const DoorScreen: React.FC = () => {
  const { eventId, sessionId: sessionParam, roomId } = useParams();
  const { profile } = useAuth();
  const staff = isStaff(profile);
  const { doc: event, ready: eReady } = useDoc('events', eventId ?? null);
  const filter = eventId ? [{ field: 'eventId', op: '==' as const, value: eventId }] : [];
  const sessions = useWatch('sessions', filter, Boolean(eventId));
  const rooms = useWatch('rooms', filter, Boolean(eventId));
  const invites = useWatch('invites', filter, Boolean(eventId) && staff);
  const users = useWatch('users', [], staff);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 10_000); return () => window.clearInterval(t); }, []);

  const picked = useMemo(() => {
    if (sessionParam) return { session: sessions.items.find((s) => s.id === sessionParam) ?? null, state: 'now' as const };
    return sessionForRoom(sessions.items.filter((s) => s.roomId === roomId), now);
  }, [sessions.items, sessionParam, roomId, now]);
  const session = picked.session;
  const arrivals = useWatch('attendance', session && eventId ? [{ field: 'eventId', op: '==', value: eventId }, { field: 'sessionId', op: '==', value: session.id }] : [], Boolean(session));

  // A session without a door code gets one the first time its screen opens.
  const mayRun = staff || Boolean(profile && session && (session.hostIds ?? []).includes(profile.id));
  useEffect(() => {
    if (mayRun && session && !session.checkinCode) void store.update('sessions', session.id, { checkinCode: randomCode() });
  }, [mayRun, session]);

  const byUser = useMemo(() => new Map(users.items.map((u) => [u.id, u])), [users.items]);
  const invited = useMemo(() => new Set(invites.items.map((i) => i.email)), [invites.items]);
  const people = useMemo(() => users.items.filter((u) => u.role !== 'user' || (eventId ? u.eventAccess.includes(eventId) : false) || invited.has(u.email.toLowerCase())), [users.items, invited, eventId]);
  const toArrival = useCallback((a: Attendance): Arrival => {
    const u = byUser.get(a.userId);
    return { id: a.id, name: u?.name ?? a.name ?? 'Someone', org: u?.org ?? a.org, photoUrl: u?.photoUrl, at: a.at };
  }, [byUser]);

  // ---- the welcome: every arrival after the screen opened, one at a time.
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<Arrival[]>([]);
  const [splash, setSplash] = useState<Arrival | null>(null);
  useEffect(() => { seen.current = null; setQueue([]); setSplash(null); }, [session?.id]);
  useEffect(() => {
    if (!arrivals.ready) return;
    const ids = new Set(arrivals.items.map((a) => a.id));
    if (seen.current === null) { seen.current = ids; return; }
    const fresh = arrivals.items.filter((a) => !seen.current!.has(a.id)).sort((a, b) => a.at.localeCompare(b.at));
    seen.current = ids;
    if (fresh.length) setQueue((q) => [...q, ...fresh.map(toArrival)]);
  }, [arrivals.items, arrivals.ready, toArrival]);
  useEffect(() => {
    if (splash || queue.length === 0) return;
    setSplash(queue[0]); setQueue((q) => q.slice(1));
  }, [queue, splash]);
  useEffect(() => {
    if (!splash) return;
    const t = window.setTimeout(() => setSplash(null), SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [splash]);

  // ---- scanning: a handheld scanner types the code and presses Enter; the camera reads it.
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(t); }, [toast]);
  const handleCode = useCallback(async (text: string) => {
    if (!session || !profile || !eventId) return;
    const uid = badgeUid(text) ?? text.trim();
    // Staff know everyone on the event; a host looks the person up as they scan.
    let u: Profile | undefined = people.find((p) => p.id === uid);
    if (!u && !staff) {
      try { const d = await store.get('users', uid); if (d && (d.role !== 'user' || d.eventAccess.includes(eventId))) u = d; } catch { /* not readable */ }
    }
    if (!u) { setToast({ text: 'That badge is not on this event', tone: 'warn' }); return; }
    const existing = arrivals.items.find((a) => a.userId === uid);
    if (existing) { setToast({ text: `${u.name} is already in · ${formatClock(existing.at)}`, tone: 'ok' }); return; }
    const rec: Attendance = { id: `${eventId}__${session.id}__${uid}`, eventId, sessionId: session.id, userId: uid, at: nowIso(), by: profile.id, name: u.name, org: u.org };
    try { await store.set('attendance', rec.id, rec); }
    catch { setToast({ text: 'That did not record — check the connection', tone: 'warn' }); }
  }, [session, profile, eventId, people, arrivals.items, staff]);
  useEffect(() => {
    let buf = ''; let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const at = Date.now(); if (at - last > 800) buf = ''; last = at;
      if (e.key === 'Enter') { const code = buf; buf = ''; if (code.length >= 4) void handleCode(code); }
      else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCode]);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!eReady || !sessions.ready || !rooms.ready) return <div className="min-h-screen bg-blue-950"><Spinner /></div>;
  // Staff open any door; a session's host opens their own.
  const host = Boolean(profile && session && (session.hostIds ?? []).includes(profile.id));
  if (!staff && !host) return <Navigate to={profile ? '/badge' : '/dashboard'} replace />;
  if (!event || !eventId) return <div className="p-10"><Empty icon={ScanLine} title="No such event" action={<Button to="/admin/events">Events</Button>} /></div>;
  const room = rooms.items.find((r) => r.id === (session?.roomId ?? roomId));
  const roomName = room ? roomLabel(room) : undefined;
  if (!session) {
    return (
      <div className="min-h-screen bg-blue-950 text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Mark size={40} light />
        <div className="font-display font-bold text-2xl mt-2">{roomName ?? event.name}</div>
        <p className="text-white/60 max-w-sm">Nothing is scheduled in this room yet. Add sessions to the programme and this screen picks them up on its own.</p>
        <Link to={`/admin/events/${event.id}/live`} className="btn-secondary btn-sm mt-3"><ArrowLeft className="w-4 h-4" />Live attendance</Link>
      </div>
    );
  }
  const latest = [...arrivals.items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 14).map(toArrival);
  const heading = picked.state === 'now' ? `Now in ${roomName ?? 'this room'}`
    : picked.state === 'next' ? `Next in ${roomName ?? 'this room'} · ${formatTime(session.start)}`
    : picked.state === 'later' ? `${formatDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })} in ${roomName ?? 'this room'}`
    : `Last in ${roomName ?? 'this room'}`;
  const rotate = async () => { setBusy(true); await store.update('sessions', session.id, { checkinCode: randomCode() }); setBusy(false); };
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };

  return (
    <div className="min-h-screen bg-blue-950 text-white relative overflow-hidden flex flex-col select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(0,43,84,.7)_0%,rgba(2,14,36,1)_70%)]" aria-hidden="true" />
      <div className="absolute -right-[14vw] top-1/2 -translate-y-1/2 w-[70vh] h-[70vh] opacity-15 text-blue-200 welcome-ring" aria-hidden="true"><OrbitDiagram active={2} label={false} className="w-full h-full" /></div>

      <header className="relative flex items-center justify-between px-6 lg:px-10 py-5">
        <div className="flex items-center gap-3">
          <Mark size={30} light />
          <div><div className="font-display font-bold leading-tight">{event.name}</div>{room && <div className="text-xs text-blue-200/70">{roomLabel(room)}{roomWhere(room) ? ` · ${roomWhere(room)}` : ''}</div>}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-white/80"><ScanLine className="w-3.5 h-3.5 text-emerald-300" />Scanner ready</span>
          <span className="font-mono tabular-nums text-xl">{formatClock(now.toISOString())}</span>
        </div>
      </header>

      <main className="relative flex-1 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center px-6 lg:px-14 pb-10">
        <div className="min-w-0">
          <div className="eyebrow text-blue-200/80">{heading}</div>
          <h1 className="font-display font-bold tracking-tight text-[clamp(1.9rem,4vw,4rem)] leading-[1.05] mt-3 [text-wrap:balance]">{session.title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-white/80 text-base lg:text-lg">
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-200" />{formatTime(session.start)} – {formatTime(session.end)}</span>
            {room && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-blue-200" />{roomLabel(room)}</span>}
            {session.speakers.length > 0 && <span className="inline-flex items-center gap-1.5"><Mic className="w-4 h-4 text-blue-200" />{session.speakers.map((p) => p.name).join(', ')}</span>}
          </div>

          <div className="mt-10 flex items-end gap-10">
            <div>
              <div className="font-display font-extrabold tabular-nums text-[clamp(4.5rem,9vw,8.5rem)] leading-none">{arrivals.items.length}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/60 mt-3 inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />in the room{session.capacity ? ` · of ${session.capacity} seats` : ''}</div>
            </div>
            <div className="pb-4 text-sm text-white/60">door code <span className="font-mono text-white text-lg ml-1">{session.checkinCode ?? '——'}</span></div>
          </div>

          <div className="mt-8">
            <div className="eyebrow text-blue-200/70 mb-3">Arrivals</div>
            {latest.length === 0
              ? <p className="text-sm text-white/50">Nobody yet — the first name appears here the moment a badge is scanned.</p>
              : <ul className="flex flex-wrap gap-2">
                  {latest.map((a) => (
                    <li key={a.id} className="arrival-in inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 pl-1 pr-3 py-1">
                      <Avatar name={a.name} photoUrl={a.photoUrl} size={26} /><span className="text-sm font-semibold">{a.name}</span><span className="text-[11px] text-white/50 tabular-nums">{formatClock(a.at)}</span>
                    </li>
                  ))}
                </ul>}
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]">
            {session.checkinCode
              ? <QRCodeSVG value={hereUrl(event.slug, session.id, session.checkinCode)} size={360} level="M" style={{ width: 'min(360px, 70vw, 42vh)', height: 'auto' }} />
              : <div className="w-[min(360px,70vw)] aspect-square flex items-center justify-center text-ink-500 text-sm">Making a code…</div>}
          </div>
          <div className="text-center max-w-xs">
            <div className="font-display font-bold text-lg">Scan to check in</div>
            <p className="text-sm text-white/65 mt-1">Point your phone's camera at the code. It opens CI Connects, signs you in if you are not already, and records you here.</p>
          </div>
        </div>
      </main>

      <footer className="relative flex flex-wrap items-center justify-between gap-3 px-6 lg:px-10 pb-5 text-xs text-white/50">
        {staff
          ? <Link to={`/admin/events/${event.id}/live`} className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" />Live attendance</Link>
          : <Link to="/badge" className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" />Your badge</Link>}
        <div className="flex items-center gap-2">
          <button onClick={() => setCamera((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${camera ? 'bg-white text-blue-900 border-white' : 'border-white/20 hover:border-white/50 hover:text-white'}`}><Camera className="w-3.5 h-3.5" />{camera ? 'Stop camera' : 'Scan with camera'}</button>
          <button onClick={() => void rotate()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 hover:border-white/50 hover:text-white"><RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />New code</button>
          <button onClick={fullscreen} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 hover:border-white/50 hover:text-white"><Maximize2 className="w-3.5 h-3.5" />Full screen</button>
        </div>
      </footer>

      {camera && (
        <div className="absolute bottom-16 right-6 w-72 z-20 rise">
          <Scanner onCode={handleCode} className="shadow-2xl border border-white/15" />
          <p className="text-[11px] text-white/60 mt-2 text-center">Hold a badge up to the camera.</p>
        </div>
      )}

      {toast && (
        <div className={`absolute bottom-16 left-6 z-20 rise rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${toast.tone === 'ok' ? 'bg-white text-blue-900' : 'bg-amber-400 text-amber-950'}`}>
          {toast.tone === 'ok' ? <CircleCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" /> : <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5" />}{toast.text}
        </div>
      )}

      {splash && (
        <div key={splash.id} className="absolute inset-0 z-30 flex items-center justify-center welcome-splash pointer-events-none" aria-live="polite">
          <div className="absolute inset-0 bg-blue-950/90 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center opacity-25 text-blue-200" aria-hidden="true"><div className="w-[90vh] h-[90vh] welcome-ring"><OrbitDiagram active={3} label={false} className="w-full h-full" /></div></div>
          <div className="relative text-center px-8">
            <div className="eyebrow text-blue-200/80">Welcome</div>
            <Avatar name={splash.name} photoUrl={splash.photoUrl} size={120} className="mx-auto mt-6 ring-4 ring-white/30 shadow-2xl text-4xl" />
            <div className="font-display font-extrabold tracking-[-0.03em] text-[clamp(3rem,8vw,7.5rem)] leading-none mt-6 [text-wrap:balance]">{splash.name}</div>
            {splash.org && <div className="text-xl lg:text-2xl text-white/75 mt-4">{splash.org}</div>}
            <div className="mt-7 inline-flex items-center gap-2 text-emerald-300 text-lg"><CircleCheck className="w-6 h-6" />You are in</div>
          </div>
        </div>
      )}
    </div>
  );
};

interface Ctx { event: Event; sessions: Session[]; rooms: Room[]; tracks: Track[]; sponsors: Sponsor[]; mine: Session[]; base: string }

/**
 * What a door QR opens on the person's own phone. Signed in with a valid
 * code, it records them at once — no button to find — and says so.
 */
export const HerePage: React.FC = () => {
  const { event, sessions, rooms, base } = useOutletContext<Ctx>();
  const { user, profile } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get('s') ?? '';
  const code = params.get('c') ?? '';
  const session = sessions.find((s) => s.id === sessionId);
  const mine = useWatch('attendance', user ? [{ field: 'eventId', op: '==', value: event.id }, { field: 'userId', op: '==', value: user.uid }] : [], Boolean(user));
  const already = mine.items.find((a) => a.sessionId === sessionId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const tried = useRef(false);
  const valid = Boolean(session) && Boolean(code) && session?.checkinCode === code;
  const confirm = useCallback(async () => {
    if (!user || !session) return;
    setBusy(true); setProblem(null);
    const rec: Attendance = { id: `${event.id}__${session.id}__${user.uid}`, eventId: event.id, sessionId: session.id, userId: user.uid, at: nowIso(), by: user.uid, code, name: profile?.name ?? user.name, org: profile?.org };
    try { await store.set('attendance', rec.id, rec); setDone(true); }
    catch { setProblem('That did not go through. The door code may have changed — ask at the door, or try again.'); }
    finally { setBusy(false); }
  }, [user, session, event.id, code, profile]);
  useEffect(() => {
    if (!mine.ready || tried.current || !valid || already || done) return;
    tried.current = true; void confirm();
  }, [mine.ready, valid, already, done, confirm]);
  if (!user) return null;
  if (!session) return <Empty icon={ScanLine} title="That session is not on this programme" action={<Button to={`${base}/schedule`}>Programme</Button>} />;
  const room = rooms.find((r) => r.id === session.roomId);
  const first = (profile?.name ?? user.name).split(' ')[0];
  const isIn = Boolean(already) || done;
  return (
    <div className="max-w-md mx-auto">
      <Card className={`p-7 text-center overflow-hidden relative ${isIn ? 'here-in' : ''}`}>
        <div className="eyebrow mb-2">{event.name}</div>
        <h2 className="text-xl font-bold text-ink-900 [text-wrap:balance]">{session.title}</h2>
        <div className="text-sm text-ink-500 mt-1">{formatTime(session.start)} – {formatTime(session.end)}{room ? ` · ${roomLabel(room)}` : ''}</div>
        <div className="mt-7">
          {isIn ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center here-check"><CircleCheck className="w-11 h-11" /></div>
              <div className="font-display font-bold text-2xl text-ink-900">Welcome, {first}</div>
              <div className="text-sm text-ink-500">You are in · {formatClock(already?.at ?? nowIso())}</div>
            </div>
          ) : busy ? (
            <div className="flex flex-col items-center gap-3 text-ink-500"><Spinner /><span className="text-sm">Checking you in…</span></div>
          ) : !valid ? (
            <div className="inline-flex flex-col items-center gap-2 text-amber-900"><AlertTriangle className="w-8 h-8 text-amber-600" /><span className="font-semibold">This door code is no longer valid.</span><span className="text-xs text-ink-500">Scan the code on the room's screen again.</span></div>
          ) : (
            <Button onClick={() => void confirm()} className="w-full py-3.5 text-base">I am here</Button>
          )}
          {problem && <p className="text-xs text-rose-700 mt-3">{problem}</p>}
        </div>
      </Card>
      <div className="text-center mt-4"><Link to={`${base}/schedule`} className="text-sm text-blue-700 hover:underline">Back to the programme</Link></div>
    </div>
  );
};

/**
 * What a badge's code opens on a phone. The person's own phone lands on
 * their badges. An organiser's phone gets a check-in card for whoever the
 * badge belongs to — event, venue or session, one tap — so a member of
 * staff can walk the room with nothing but their phone. Anyone else sees
 * that badges are for the door.
 */
export const BadgeLinkPage: React.FC = () => {
  const { uid } = useParams();
  const { profile } = useAuth();
  const staff = isStaff(profile);
  const hostOf = profile?.hostOf ?? [];
  // A single read, which the rules allow staff and hosts; a list would not be.
  const [person, setPerson] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    if (!uid || !profile) return;
    let on = true;
    store.get('users', uid).then((d) => { if (on) setPerson(d); }).catch(() => { if (on) setPerson(null); });
    return () => { on = false; };
  }, [uid, profile]);
  const ready = person !== undefined;
  const events = useWatch('events', [], staff || hostOf.length > 0);
  const [eventId, setEventId] = useState('');
  const eventFilter = eventId ? [{ field: 'eventId', op: '==' as const, value: eventId }] : [];
  const allSessions = useWatch('sessions', eventFilter, Boolean(eventId));
  // Staff may record at any session; a host only at their own.
  const sessions = useMemo(() => ({ items: staff ? allSessions.items : allSessions.items.filter((s) => hostOf.includes(s.id)), ready: allSessions.ready }), [allSessions, staff, hostOf]);
  const invites = useWatch('invites', eventFilter, Boolean(eventId) && staff);
  const attendance = useWatch('attendance', eventId && uid ? [...eventFilter, { field: 'userId', op: '==', value: uid }] : [], Boolean(eventId && uid));
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // The event that is on today, else the next one, else the last one.
  useEffect(() => {
    if (eventId || events.items.length === 0) return;
    const today = todayYmd();
    const live = events.items.find((e) => e.startDate <= today && today <= e.endDate);
    const next = [...events.items].filter((e) => e.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const last = [...events.items].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    setEventId((live ?? next ?? last)?.id ?? '');
  }, [events.items, eventId]);
  // The session that is on right now, if one is.
  useEffect(() => {
    const now = new Date(); const today = todayYmd(); const mins = now.getHours() * 60 + now.getMinutes();
    const on = sessions.items.find((s) => s.date === today && toMinutes(s.start) - 15 <= mins && mins <= toMinutes(s.end));
    setSessionId(on?.id ?? '');
  }, [sessions.items]);

  if (profile && uid === profile.id) return <Navigate to="/badge" replace />;
  if (!ready) return <Spinner />;
  const runs = staff || hostOf.length > 0;
  if (!person) {
    return (
      <div className="max-w-md mx-auto">
        <Empty icon={IdCardLanyard} title={runs ? 'No such badge' : 'Badges are read at the door'}
          body={runs ? 'This code does not belong to anyone on CI Connects.' : 'An organiser, or whoever runs the session, scans a badge to check its owner in. Your own badge is under Badge.'}
          action={<Button to="/badge">Your badge</Button>} />
      </div>
    );
  }
  const event = events.items.find((e) => e.id === eventId) ?? null;
  const target = sessionId || null;
  const existing = attendance.items.find((a) => a.sessionId === target);
  const invited = invites.items.some((i) => i.email === person.email.toLowerCase());
  const listed = event ? canSeeEvent(person, event.id) || invited : false;
  const session = sessions.items.find((s) => s.id === sessionId);
  const checkIn = async () => {
    if (!profile || !event) return;
    setBusy(true); setNote(null);
    const rec: Attendance = { id: `${event.id}__${target ?? 'venue'}__${person.id}`, eventId: event.id, sessionId: target, userId: person.id, at: nowIso(), by: profile.id, name: person.name, org: person.org };
    try { await store.set('attendance', rec.id, rec); setNote({ tone: 'success', text: `${person.name} is in${session ? ` · ${session.title}` : ' · at the venue'}` }); }
    catch { setNote({ tone: 'error', text: 'That did not record — check the connection and try again.' }); }
    finally { setBusy(false); }
  };
  const first = person.name.split(' ')[0];
  return (
    <div className="max-w-md mx-auto">
      <Card className="p-5 flex items-center gap-4">
        <Avatar name={person.name} photoUrl={person.photoUrl} size={56} className="ring-2 ring-white shadow-md" />
        <div className="min-w-0">
          <div className="font-display font-bold text-xl text-ink-900 leading-tight truncate">{person.name}</div>
          {(person.title || person.org) && <div className="text-sm text-ink-500 truncate">{[person.title, person.org].filter(Boolean).join(' · ')}</div>}
          <div className="mt-1.5"><Chip tone={person.role === 'user' ? undefined : 'blue'}>{person.role === 'user' ? 'Participant' : ROLE_LABEL[person.role]}</Chip></div>
        </div>
      </Card>
      {runs ? (
        <Card className="p-5 mt-4 space-y-4">
          <div className="eyebrow">Check in</div>
          <Field label="Event">
            <Select value={eventId} onChange={(e) => { setEventId(e.target.value); setNote(null); }}>
              {[...events.items].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Where">
            <Select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setNote(null); }}>
              {staff && <option value="">Arrival at the venue</option>}
              {!staff && sessions.items.length === 0 && <option value="">None of your sessions is on this event</option>}
              {[...sessions.items].sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start)).map((s) => <option key={s.id} value={s.id}>{formatTime(s.start)} · {s.title}</option>)}
            </Select>
          </Field>
          {event && !listed && <Notice tone="warn">{first} is not on this event's list. You can still check them in.</Notice>}
          {note && <Notice tone={note.tone}>{note.text}</Notice>}
          {existing && !note
            ? <Notice tone="success"><CircleCheck className="w-4 h-4 inline mr-1 -mt-0.5" />Already in · {formatClock(existing.at)}</Notice>
            : !note && <Button onClick={() => void checkIn()} busy={busy} disabled={!event || (!staff && !sessionId)} className="w-full py-3.5 text-base"><UserCheck className="w-4 h-4" />Check in {first}</Button>}
          {attendance.items.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500 mb-1.5">Seen at {event?.name}</div>
              <ul className="space-y-1">
                {[...attendance.items].sort((a, b) => a.at.localeCompare(b.at)).map((a) => {
                  const s = sessions.items.find((x) => x.id === a.sessionId);
                  return <li key={a.id} className="text-sm flex items-center gap-2"><CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /><span className="text-ink-900 truncate">{s?.title ?? (a.sessionId ? a.sessionId : 'Arrived at the venue')}</span><span className="text-xs text-ink-500 ml-auto tabular-nums">{formatClock(a.at)}</span></li>;
                })}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <p className="text-sm text-ink-500 text-center mt-4">An organiser scans this from their own phone to check {first} in.</p>
      )}
    </div>
  );
};

/**
 * A host's view of their room while their session is on: the count, who
 * has arrived, and the way to put the door screen on the projector. Shown
 * on the badge page only to the people named as running the session, and
 * only while it is on — nobody else needs it there.
 */
export const HostPanel: React.FC<{ event: Event; session: Session; room?: Room }> = ({ event, session, room }) => {
  const arrivals = useWatch('attendance', [{ field: 'eventId', op: '==', value: event.id }, { field: 'sessionId', op: '==', value: session.id }]);
  const latest = [...arrivals.items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card className="p-5 border-blue-200 bg-blue-50/50 rise">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="eyebrow text-blue-700">Your session is on</div>
          <div className="font-display font-bold text-lg text-ink-900 mt-1 [text-wrap:balance]">{session.title}</div>
          <div className="text-sm text-ink-500">{formatTime(session.start)} – {formatTime(session.end)}{room ? ` · ${roomLabel(room)}` : ''}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display font-extrabold text-4xl tabular-nums text-ink-900 leading-none">{arrivals.items.length}</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 mt-1">in the room{session.capacity ? ` · of ${session.capacity}` : ''}</div>
        </div>
      </div>
      {latest.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {latest.slice(0, 24).map((a) => <li key={a.id} className="text-xs rounded-full bg-white border border-sand-200 px-2.5 py-1 text-ink-700">{a.name ?? 'Someone'} <span className="text-ink-300 tabular-nums">{formatClock(a.at)}</span></li>)}
          {latest.length > 24 && <li className="text-xs text-ink-500 px-1 py-1">+{latest.length - 24} more</li>}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <a href={`/door/${event.id}/${session.id}`} target="_blank" rel="noreferrer" className="btn-primary btn-sm"><MonitorPlay className="w-3.5 h-3.5" />Open the door screen</a>
        <span className="text-xs text-ink-500">Put it on the room's projector: it shows the code people scan, greets each arrival by name and counts the room.</span>
      </div>
    </Card>
  );
};
