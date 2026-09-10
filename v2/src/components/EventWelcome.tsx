import React, { useEffect, useMemo } from 'react';
import { CalendarDays, MapPin, ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react';
import { Event, Profile } from '../lib/types';
import { formatRange, eachDate, daysUntil, eventPhase } from '../lib/time';
import { Mark } from './Mark';
import { OrbitDiagram } from './Orbit';

const AUTO_MS = 6500;

/**
 * The threshold of one event — shown on every arrival from outside.
 *
 * The same chrome sits on top of every event, so stepping into one needs a
 * moment that says which. It builds itself in order — where you are, when,
 * whether you are on the list — and lets itself out after a few seconds, or
 * the moment you press Enter.
 */
export const EventWelcome: React.FC<{
  event: Event; profile: Profile; isStaff: boolean; sessionCount: number; roomCount: number; reservedCount: number; onDone: () => void;
}> = ({ event, profile, isStaff, sessionCount, roomCount, reservedCount, onDone }) => {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? 2500 : AUTO_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [onDone, reduced]);

  const days = eachDate(event.startDate, event.endDate).length;
  const phase = eventPhase(event.startDate, event.endDate);
  const first = profile.name.split(' ')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-blue-900 text-white" role="dialog" aria-label={`Entering ${event.name}`}>
      <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 scale-105 blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/70 to-blue-950/95" />
      <div className="absolute -right-24 -bottom-24 w-[34rem] h-[34rem] opacity-25 rise-slow d2 hidden md:block">
        <OrbitDiagram active={3} label={false} className="w-full h-full" />
      </div>

      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between px-6 sm:px-10 pt-6">
          <span className="flex items-center gap-2.5 rise"><Mark size={30} light /><span className="font-display font-bold tracking-tight">CI Connects</span></span>
          <button onClick={onDone} className="text-sm text-white/60 hover:text-white rise d1">Skip</button>
        </div>

        <div className="flex-1 flex items-center">
          <div className="max-w-5xl mx-auto w-full px-6 sm:px-10 py-8">
            <div className="eyebrow text-blue-200/80 rise d1">Welcome, {first} · you are entering</div>
            <h1 className="font-display font-extrabold tracking-[-0.03em] leading-[0.95] text-5xl sm:text-7xl lg:text-8xl mt-4 rise d2">{event.name}</h1>
            {event.tagline && <p className="text-lg sm:text-xl text-white/80 mt-5 max-w-2xl rise d3">{event.tagline}</p>}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-sm sm:text-base text-white/85 rise d3">
              <span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-200" />{formatRange(event.startDate, event.endDate)}</span>
              <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-200" />{event.venueName}</span>
              {phase === 'upcoming' && <span className="chip bg-white/10 border border-white/20 text-white">In {daysUntil(event.startDate)} days</span>}
              {phase === 'live' && <span className="chip bg-emerald-400 text-emerald-950">Happening now</span>}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mt-8 rise d4">
              {[[String(days), days === 1 ? 'day' : 'days'], [String(sessionCount), sessionCount === 1 ? 'session' : 'sessions'], [String(roomCount), roomCount === 1 ? 'room' : 'rooms']].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-display font-bold tabular-nums leading-none">{v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mt-1.5">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-8 rise d5">
              <button onClick={onDone} className="btn bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 text-base">
                Enter {event.name}<ArrowRight className="w-4 h-4" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/75">
                {isStaff ? <><ShieldCheck className="w-4 h-4 text-blue-200" />You run this event</> : <><CircleCheck className="w-4 h-4 text-emerald-300" />You are on the list{reservedCount > 0 ? ` · ${reservedCount} seat${reservedCount === 1 ? '' : 's'} held` : ''}</>}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-6 rise d6">
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-2"><span>Opening the programme</span><span>Enter ↵</span></div>
          <div className="h-0.5 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-blue-200 progress-run" style={{ animationDuration: `${reduced ? 2500 : AUTO_MS}ms` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
