import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, MapPin, ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react';
import { Event, Profile } from '../lib/types';
import { formatRange, eachDate, daysUntil, eventPhase } from '../lib/time';
import { Mark } from './Mark';
import { OrbitDiagram } from './Orbit';

/** How long the threshold takes to let go once Enter is pressed. */
const LEAVE_MS = 750;

const seenKey = (eventId: string, uid: string) => `ci2:welcome:${eventId}:${uid}`;
/** Whether this person has already come through this event's threshold in
 *  this browser session. Once through, moving around the event — or coming
 *  back to it from the dashboard — does not raise it again. */
export const seenWelcome = (eventId: string, uid: string): boolean => {
  try { return sessionStorage.getItem(seenKey(eventId, uid)) === '1'; } catch { return false; }
};
const markSeen = (eventId: string, uid: string) => { try { sessionStorage.setItem(seenKey(eventId, uid), '1'); } catch { /* private mode */ } };

/**
 * The threshold of one event — every event has one, and it is raised the
 * first time a person enters that event in a session.
 *
 * It fills the screen (a portal, so no ancestor's transform can shrink it
 * to a column), turns the orbit in the centre, and stays until the person
 * presses Enter — the button or the key. It does not let itself out. When
 * it goes it goes gently: the words lift, the orbit blooms outward, and the
 * programme underneath comes through the fade.
 */
export const EventWelcome: React.FC<{
  event: Event; profile: Profile; isStaff: boolean; ready: boolean;
  sessionCount: number; roomCount: number; reservedCount: number; onDone: () => void;
}> = ({ event, profile, isStaff, ready, sessionCount, roomCount, reservedCount, onDone }) => {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  // The parent may hand over a new onDone on every render; the exit uses the latest.
  const done = useRef(onDone); done.current = onDone;

  const enter = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true; setLeaving(true);
    markSeen(event.id, profile.id);
    window.setTimeout(() => done.current(), reduced ? 200 : LEAVE_MS);
  }, [event.id, profile.id, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); enter(); } };
    window.addEventListener('keydown', onKey);
    // Nothing behind the threshold scrolls while it is up.
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prev; };
  }, [enter]);

  const days = eachDate(event.startDate, event.endDate).length;
  const phase = eventPhase(event.startDate, event.endDate);
  const first = profile.name.split(' ')[0];
  const stat = (n: number) => (ready ? String(n) : '–');

  return createPortal(
    <div className={`fixed inset-0 z-[100] overflow-hidden bg-blue-950 text-white ${leaving ? 'welcome-leave' : 'welcome-arrive'}`}
      data-lenis-prevent role="dialog" aria-label={`Entering ${event.name}`}>
      <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105 blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,43,84,.55)_0%,rgba(2,14,36,.94)_72%)]" />

      {/* The orbit: centred, turning, the size of the screen. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className={leaving ? 'welcome-bloom-leave' : 'welcome-bloom'} style={{ width: 'min(96vh, 96vw)', height: 'min(96vh, 96vw)' }}>
          <div className="welcome-ring text-blue-200 w-full h-full">
            <OrbitDiagram active={3} label={false} className="w-full h-full opacity-30" />
          </div>
        </div>
      </div>

      <div className={`relative h-full flex flex-col ${leaving ? 'welcome-lift' : ''}`}>
        <header className="flex items-center px-5 sm:px-8 pt-5 sm:pt-6 shrink-0">
          <span className="flex items-center gap-2.5 rise"><Mark size={28} light /><span className="font-display font-bold tracking-tight">CI Connects</span></span>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center px-5 sm:px-8 py-4">
          <div className="text-center max-w-3xl">
            <div className="eyebrow text-blue-200/80 rise d1">Welcome, {first} · you are entering</div>
            <h1 className="font-display font-extrabold tracking-[-0.03em] leading-[0.95] text-[clamp(2.75rem,9vw,7rem)] mt-3 rise d2 [text-wrap:balance]">{event.name}</h1>
            {event.tagline && <p className="text-base sm:text-xl text-white/80 mt-4 mx-auto max-w-xl rise d3 [text-wrap:balance]">{event.tagline}</p>}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-sm sm:text-base text-white/85 rise d3">
              <span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-200" />{formatRange(event.startDate, event.endDate)}</span>
              <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-200" />{event.venueName}</span>
              {phase === 'upcoming' && <span className="chip bg-white/10 border border-white/20 text-white">In {daysUntil(event.startDate)} days</span>}
              {phase === 'live' && <span className="chip bg-emerald-400 text-emerald-950">Happening now</span>}
              {phase === 'past' && <span className="chip bg-white/10 border border-white/20 text-white/80">Past event</span>}
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto mt-7 rise d4">
              {[[stat(days), days === 1 ? 'day' : 'days'], [stat(sessionCount), sessionCount === 1 ? 'session' : 'sessions'], [stat(roomCount), roomCount === 1 ? 'room' : 'rooms']].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/10 border border-white/15 px-3 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-display font-bold tabular-nums leading-none">{v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mt-1.5">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-7 rise d5">
              <button onClick={enter} disabled={leaving} className="btn bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 text-base transition-transform duration-300 hover:scale-[1.03]">
                Enter {event.name}<ArrowRight className="w-4 h-4" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/75">
                {isStaff ? <><ShieldCheck className="w-4 h-4 text-blue-200" />You run this event</> : <><CircleCheck className="w-4 h-4 text-emerald-300" />You are on the list{reservedCount > 0 ? ` · ${reservedCount} seat${reservedCount === 1 ? '' : 's'} held` : ''}</>}
              </span>
            </div>
          </div>
        </main>

        <footer className="px-5 sm:px-8 pb-5 sm:pb-6 shrink-0 rise d6">
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
            <span className="transition-opacity duration-500">{ready ? `Programme ready · ${sessionCount} session${sessionCount === 1 ? '' : 's'}` : 'Loading the programme…'}</span>
            <span>Enter ↵</span>
          </div>
          <div className="h-px bg-white/15 rounded-full overflow-hidden">
            <div className={`h-full bg-blue-200 transition-[width] duration-700 ease-out ${ready ? 'w-full' : 'w-1/4 breathe'}`} />
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
