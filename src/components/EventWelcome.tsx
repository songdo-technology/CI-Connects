import React, { useState } from 'react';
import {
  ArrowRight, ArrowLeft, CalendarDays, MapPin, KeyRound, Loader2, Mail, CheckCircle2, ShieldCheck, Lock,
} from 'lucide-react';
import { EventConfig, UserProfile } from '../types';

interface EventWelcomeProps {
  event: EventConfig;
  currentUser: UserProfile;
  /** Whether this person may see the programme: assigned by an organiser,
   *  or an organiser themselves. */
  hasAccess: boolean;
  isOrganiser: boolean;
  sessionCount: number;
  roomCount: number;
  reservedCount: number;
  onEnter: () => void;
  onBack: () => void;
  onRedeemCode: (code: string) => Promise<string | null>;
  onRequestPlace: (eventId: string) => void;
}

/** Remembered per person and event for the browser session, so the welcome
 *  is shown once on the way in and not on every visit to a tab. */
export const welcomeKey = (slug: string, userId: string) => `ci-connects:welcomed:${userId}:${slug}`;

export function hasBeenWelcomed(slug: string, userId: string): boolean {
  try { return window.sessionStorage.getItem(welcomeKey(slug, userId)) === '1'; } catch { return false; }
}

export function markWelcomed(slug: string, userId: string): void {
  try { window.sessionStorage.setItem(welcomeKey(slug, userId), '1'); } catch { /* private mode */ }
}

/**
 * The threshold of one event.
 *
 * Every event portal has the same chrome, and stepping from the dashboard
 * into one used to look like nothing had happened — same header, same tabs,
 * a different agenda. This is the full-screen moment that says which event
 * you are now inside, when and where it is, and whether you are on its list.
 *
 * It is also the door: a person an organiser has not assigned sees the
 * event, and the two ways in — a code, or asking — rather than a programme
 * that quietly fails to load.
 */
export const EventWelcome: React.FC<EventWelcomeProps> = ({
  event, currentUser, hasAccess, isOrganiser, sessionCount, roomCount, reservedCount,
  onEnter, onBack, onRedeemCode, onRequestPlace,
}) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true); setProblem(null);
    const p = await onRedeemCode(code.trim());
    setBusy(false);
    if (p) { setProblem(p); return; }
    setRedeemed(true);
  };

  const days = Math.max(1, Math.round(
    (new Date(`${event.endDate}T00:00:00`).getTime() - new Date(`${event.startDate}T00:00:00`).getTime())
    / 86_400_000) + 1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto">
      <img src={event.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/70 to-slate-950" />

      <div className="relative min-h-full flex flex-col">
        <div className="max-w-6xl mx-auto w-full px-6 pt-6 flex items-center justify-between text-xs">
          <button onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </button>
          <span className="text-white/50">Signed in as {currentUser.preferredName || currentUser.fullName}</span>
        </div>

        <div className="flex-1 flex items-center">
          <div className="max-w-6xl mx-auto w-full px-6 py-12 grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 items-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/90 mb-4">
                You are entering
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-balance">
                {event.name}
              </h1>
              {event.tagline && (
                <p className="mt-4 text-lg text-white/80 max-w-xl">{event.tagline}</p>
              )}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
                <span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-200" />{event.dateLabel}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-200" />{event.venueName}</span>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
                {[
                  [String(days), days === 1 ? 'day' : 'days'],
                  [String(sessionCount), sessionCount === 1 ? 'session' : 'sessions'],
                  [String(roomCount), roomCount === 1 ? 'room' : 'rooms'],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3">
                    <div className="text-2xl font-bold tabular-nums leading-none">{v}</div>
                    <div className="text-[11px] uppercase tracking-wider text-white/60 mt-1.5">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white text-slate-900 p-6 sm:p-7 shadow-2xl shadow-black/40">
              {hasAccess ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {isOrganiser ? <ShieldCheck className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isOrganiser ? 'You run this event' : 'You are on the list'}
                  </div>
                  <h2 className="text-xl font-bold mt-4">Everything for this event, in one place</h2>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                    <li>The full programme — reserve a seat, or join a waitlist.</li>
                    <li>Your badge and pass for the door, and your meals.</li>
                    <li>Who else is here, messages, and the community board.</li>
                    {reservedCount > 0 && (
                      <li className="text-slate-900 font-medium">
                        You already hold {reservedCount} {reservedCount === 1 ? 'seat' : 'seats'}.
                      </li>
                    )}
                  </ul>
                  <button onClick={onEnter}
                          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors cursor-pointer">
                    Enter {event.shortName}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                    <Lock className="w-3.5 h-3.5" /> Not on the list yet
                  </div>
                  <h2 className="text-xl font-bold mt-4">This programme is for invited participants</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    An organiser adds people to {event.shortName}. If you were sent an access code,
                    enter it here; otherwise ask for a place and we will be in touch.
                  </p>

                  {redeemed ? (
                    <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>You are in. Your place is confirmed — go on through.</span>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" /> Access code
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input value={code}
                               onChange={(e) => { setCode(e.target.value.toUpperCase()); setProblem(null); }}
                               onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
                               placeholder="A7K2M9" maxLength={8}
                               className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-300 font-mono tracking-widest uppercase text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                        <button onClick={() => void redeem()} disabled={busy || !code.trim()}
                                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer">
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Use code'}
                        </button>
                      </div>
                      {problem && <p className="mt-2 text-xs text-rose-700">{problem}</p>}
                    </div>
                  )}

                  {redeemed ? (
                    <button onClick={onEnter}
                            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors cursor-pointer">
                      Enter {event.shortName} <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => onRequestPlace(event.id)}
                            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
                      <Mail className="w-4 h-4" /> Ask for a place
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
