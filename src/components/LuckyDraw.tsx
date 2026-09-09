import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Gift, Play, Users, Trophy, RotateCcw, Volume2, VolumeX, Undo2, Sparkles, Timer,
} from 'lucide-react';
import { UserProfile, Prize, Sponsor, EventConfig } from '../types';
import { can } from '../lib/permissions';

interface LuckyDrawProps {
  profiles: UserProfile[];
  prizes: Prize[];
  sponsors: Sponsor[];
  events: EventConfig[];
  currentUser: UserProfile;
  /** Records a win against the prize. Undo passes the shortened list back. */
  onUpdatePrize: (prizeId: string, wonBy: NonNullable<Prize['wonBy']>) => Promise<void> | void;
}

type Phase = 'idle' | 'spinning' | 'revealed';

/**
 * The closing draw, built to be projected.
 *
 * Everyone checked in is entered automatically — there is no ticket to collect
 * and nothing for an organiser to type at the front of a room. Winners are
 * removed from the pool by default, because a second win for the same person
 * reads as rigged whatever the maths says, though that can be turned off for a
 * small event where it would otherwise exhaust the pool.
 *
 * Eligibility is attendance, not registration. Someone who registered and did
 * not come should not win the iPad, and the door scans are what make that
 * distinguishable.
 */
export const LuckyDraw: React.FC<LuckyDrawProps> = ({
  profiles, prizes, sponsors, events, currentUser, onUpdatePrize,
}) => {
  const mayDraw = can(currentUser, 'luckydraw:manage');

  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [prizeId, setPrizeId] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayName, setDisplayName] = useState<string>('');
  const [winner, setWinner] = useState<UserProfile | null>(null);
  const [durationSec, setDurationSec] = useState(5);
  const [excludeWinners, setExcludeWinners] = useState(true);
  const [checkedInOnly, setCheckedInOnly] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const timers = useRef<number[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const eventPrizes = useMemo(
    () => prizes.filter((p) => p.eventId === eventId).sort((a, b) => a.orderIndex - b.orderIndex),
    [prizes, eventId]);

  const prize = eventPrizes.find((p) => p.id === prizeId) ?? eventPrizes[0];
  const drawn = prize?.wonBy?.length ?? 0;
  const remaining = prize ? prize.quantity - drawn : 0;

  /** Everyone who has already won anything, across every prize for this event. */
  const allWinnerIds = useMemo(
    () => new Set(eventPrizes.flatMap((p) => (p.wonBy ?? []).map((w) => w.userId))),
    [eventPrizes]);

  const pool = useMemo(
    () => profiles.filter((p) =>
      p.role !== 'front_desk' &&
      (!checkedInOnly || p.checkedIn) &&
      (!excludeWinners || !allWinnerIds.has(p.id))),
    [profiles, checkedInOnly, excludeWinners, allWinnerIds]);

  /** Every win so far, newest first, for the results board. */
  const results = useMemo(
    () => eventPrizes
      .flatMap((p) => (p.wonBy ?? []).map((w) => ({ prize: p, ...w })))
      .sort((a, b) => b.drawnAt.localeCompare(a.drawnAt)),
    [eventPrizes]);

  const celebrate = useCallback(() => {
    // Two bursts from the lower corners reads better on a wide projector than
    // a single centre burst, which mostly lands off-screen.
    const opts = { particleCount: 90, spread: 70, startVelocity: 45, ticks: 220 };
    confetti({ ...opts, origin: { x: 0.15, y: 0.75 }, angle: 60 });
    confetti({ ...opts, origin: { x: 0.85, y: 0.75 }, angle: 120 });
  }, []);

  const spin = () => {
    if (!prize || pool.length === 0 || remaining <= 0) return;
    clearTimers();
    setPhase('spinning');
    setWinner(null);

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const totalMs = durationSec * 1000;

    // Names cycle fast and then slow down, because a constant rate looks like
    // a loading spinner rather than a draw. Intervals grow geometrically until
    // they exceed the budget.
    let elapsed = 0;
    let gap = 45;
    while (elapsed < totalMs) {
      const at = elapsed;
      timers.current.push(window.setTimeout(() => {
        setDisplayName(pool[Math.floor(Math.random() * pool.length)]?.fullName ?? '');
      }, at));
      elapsed += gap;
      gap = Math.min(320, gap * 1.09);
    }

    timers.current.push(window.setTimeout(async () => {
      setDisplayName(chosen.fullName);
      setWinner(chosen);
      setPhase('revealed');
      celebrate();
      if (soundOn && 'vibrate' in navigator) navigator.vibrate?.([60, 40, 120]);
      await onUpdatePrize(prize.id, [
        ...(prize.wonBy ?? []),
        { userId: chosen.id, drawnAt: new Date().toISOString() },
      ]);
    }, totalMs));
  };

  const undoLast = async () => {
    const last = results[0];
    if (!last) return;
    const next = (last.prize.wonBy ?? []).filter(
      (w) => !(w.userId === last.userId && w.drawnAt === last.drawnAt));
    await onUpdatePrize(last.prize.id, next);
    setPhase('idle'); setWinner(null); setDisplayName('');
  };

  const sponsorOf = (p: Prize) => sponsors.find((s) => s.id === p.sponsorId);

  return (
    <div className="space-y-5">
      {/* ---------------- Stage ---------------- */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-lg font-bold leading-tight">Lucky Draw</h2>
              <p className="text-xs text-blue-200/70">
                {pool.length} eligible · {results.length} drawn so far
              </p>
            </div>
          </div>
          <button
            onClick={() => setSoundOn((v) => !v)}
            className="shrink-0 p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
            title={soundOn ? 'Haptics on' : 'Haptics off'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        <div className="px-6 py-12 sm:py-16 text-center min-h-[16rem] flex flex-col items-center justify-center">
          {prize && (
            <div className="mb-6">
              <div className="text-xs font-bold tracking-[0.25em] text-blue-200/70 uppercase mb-1.5">
                Drawing for
              </div>
              <div className="text-xl sm:text-2xl font-bold">{prize.name}</div>
              {sponsorOf(prize) && (
                <div className="text-xs text-blue-200/70 mt-1">
                  Donated by {sponsorOf(prize)!.name}
                </div>
              )}
              <div className="text-xs text-blue-200/60 mt-1">
                {remaining} of {prize.quantity} remaining
              </div>
            </div>
          )}

          {phase === 'idle' && !winner && (
            <p className="text-blue-200/60 text-sm">Ready when you are.</p>
          )}

          {phase === 'spinning' && (
            <div className="text-3xl sm:text-5xl font-bold tracking-tight tabular-nums animate-pulse">
              {displayName || '…'}
            </div>
          )}

          {phase === 'revealed' && winner && (
            <div>
              <div className="text-xs font-bold tracking-[0.25em] text-blue-200/70 uppercase mb-2">
                Winner
              </div>
              <div className="text-4xl sm:text-6xl font-bold tracking-tight mb-2">
                {winner.fullName}
              </div>
              <div className="text-sm text-blue-200/80">
                {[winner.title, winner.organization].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}
        </div>

        {mayDraw && (
          <div className="px-6 py-4 bg-black/25 flex flex-wrap items-center gap-3">
            <button
              onClick={spin}
              disabled={phase === 'spinning' || !prize || pool.length === 0 || remaining <= 0}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {phase === 'spinning' ? 'Drawing…'
                : remaining <= 0 ? 'All drawn'
                : results.length ? 'Draw again' : 'Start the draw'}
            </button>

            {phase === 'revealed' && (
              <button
                onClick={() => { setPhase('idle'); setWinner(null); setDisplayName(''); }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/20 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            )}

            {results.length > 0 && phase !== 'spinning' && (
              <button
                onClick={undoLast}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/20 transition-colors cursor-pointer"
                title="Removes the most recent win and returns that person to the pool"
              >
                <Undo2 className="w-4 h-4" />
                Undo last
              </button>
            )}
          </div>
        )}
      </div>

      {mayDraw && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Event</label>
              <select
                value={eventId}
                onChange={(e) => { setEventId(e.target.value); setPrizeId(''); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prize</label>
              <select
                value={prize?.id ?? ''}
                onChange={(e) => { setPrizeId(e.target.value); setPhase('idle'); setWinner(null); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {eventPrizes.length === 0 && <option value="">No prizes configured</option>}
                {eventPrizes.map((p) => {
                  const left = p.quantity - (p.wonBy?.length ?? 0);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} — {left} of {p.quantity} left
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Draw length
              </span>
              <span className="text-slate-500">{durationSec} seconds</span>
            </label>
            <input
              type="range" min={3} max={10} step={1} value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>3s — brisk</span><span>10s — build the tension</span>
            </div>
          </div>

          <div className="space-y-2">
            {([
              {
                on: checkedInOnly, set: setCheckedInOnly,
                title: 'Only people scanned in at the venue',
                body: 'Eligibility is attendance, not registration. Someone who signed up and did not come should not win.',
              },
              {
                on: excludeWinners, set: setExcludeWinners,
                title: 'Remove winners from the pool',
                body: 'A second win for the same person reads as rigged whatever the maths says. Turn this off only for a pool too small to sustain it.',
              },
            ]).map(({ on, set, title, body }) => (
              <button
                key={title}
                onClick={() => set(!on)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                  on ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800">{title}</div>
                  <div className="text-xs text-slate-500 leading-snug mt-0.5">{body}</div>
                </div>
                <span className={`shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative ${on ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {pool.length} in the pool
            {checkedInOnly && ` · ${profiles.length - pool.length} excluded`}
          </div>
        </div>
      )}

      {/* ---------------- Results board ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-slate-900">Winners</h3>
          <span className="text-xs text-slate-400">{results.length} so far</span>
        </div>
        {results.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 italic">Nothing drawn yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {results.map((r, i) => {
              const person = profiles.find((p) => p.id === r.userId);
              return (
                <div key={`${r.prize.id}-${r.userId}-${i}`} className="p-4 flex items-center gap-4">
                  <img src={person?.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {person?.fullName ?? 'Unknown'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {[person?.title, person?.organization].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 justify-end">
                      <Gift className="w-3.5 h-3.5 text-slate-400" />
                      {r.prize.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(r.drawnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
