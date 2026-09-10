import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, MapPin, ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react';
import { Event, Profile } from '../lib/types';
import { formatRange, eachDate, daysUntil, eventPhase } from '../lib/time';
import { Mark } from './Mark';
import { OrbitDiagram } from './Orbit';

/** How long the threshold holds once the programme is here. */
const HOLD_MS = 2200;
/** And never longer than this, however slow the programme is. */
const MAX_MS = 8000;

/**
 * The threshold of one event — shown on every arrival from outside.
 *
 * The same chrome sits on top of every event, so stepping into one needs a
 * moment that says which. It fills the screen (a portal, so no ancestor's
 * transform can shrink it to a column), turns the orbit in the centre, and
 * doubles as the loading screen: it lets go when the programme has arrived
 * and the moment has had its two seconds — or the instant you press Enter.
 */
export const EventWelcome: React.FC<{
  event: Event; profile: Profile; isStaff: boolean; ready: boolean;
  sessionCount: number; roomCount: number; reservedCount: number; onDone: () => void;
}> = ({ event, profile, isStaff, ready, sessionCount, roomCount, reservedCount, onDone }) => {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const hold = reduced ? 1200 : HOLD_MS;
  const [held, setHeld] = useState(false);
  // The parent may hand over a new onDone on every render; the timers are set once.
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const t = window.setTimeout(() => setHeld(true), hold);
    const cap = window.setTimeout(() => done.current(), MAX_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') done.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); window.clearTimeout(cap); window.removeEventListener('keydown', onKey); };
  }, [hold]);
  useEffect(() => { if (held && ready) done.current(); }, [held, ready]);

  const days = eachDate(event.startDate, event.endDate).length;
  const phase = eventPhase(event.startDate, event.endDate);
  const first = profile.name.split(' ')[0];
  const stat = (n: number) => (ready ? String(n) : '–');

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-blue-950 text-white" role="dialog" aria-label={`Entering ${event.name}`}>
      <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105 blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,43,84,.55)_0%,rgba(2,14,36,.94)_72%)]" />

      {/* The orbit: centred, turning, the size of the screen. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div className="welcome-ring text-blue-200" style={{ width: 'min(96vh, 96vw)', height: 'min(96vh, 96vw)' }}>
          <OrbitDiagram active={3} label={false} className="w-full h-full opacity-30" />
        </div>
      </div>

      <div className="relative h-full flex flex-col">
        <header className="flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-6 shrink-0">
          <span className="flex items-center gap-2.5 rise"><Mark size={28} light /><span className="font-display font-bold tracking-tight">CI Connects</span></span>
          <button onClick={onDone} className="text-sm text-white/60 hover:text-white rise">Skip</button>
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
              <button onClick={onDone} className="btn bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 text-base">
                Enter {event.name}<ArrowRight className="w-4 h-4" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/75">
                {isStaff ? <><ShieldCheck className="w-4 h-4 text-blue-200" />You run this event</> : <><CircleCheck className="w-4 h-4 text-emerald-300" />You are on the list{reservedCount > 0 ? ` · ${reservedCount} seat${reservedCount === 1 ? '' : 's'} held` : ''}</>}
              </span>
            </div>
          </div>
        </main>

        <footer className="px-5 sm:px-8 pb-5 sm:pb-6 shrink-0 rise d5">
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
            <span>{held && !ready ? 'Loading the programme…' : 'Opening the programme'}</span><span>Enter ↵</span>
          </div>
          <div className="h-0.5 bg-white/15 rounded-full overflow-hidden">
            <div className={`h-full bg-blue-200 ${held && !ready ? 'breathe' : 'progress-run'}`} style={{ animationDuration: `${hold}ms` }} />
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
