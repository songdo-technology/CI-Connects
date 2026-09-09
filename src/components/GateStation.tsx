import React, { useEffect, useMemo, useState } from 'react';
import {
  ScanLine, Search, Check, X, LogOut, ArrowLeft, Users, UserCheck,
  AlertTriangle, CalendarDays, Utensils, Building2, Tablet, QrCode,
} from 'lucide-react';
import {
  EventConfig, Session, Room, UserProfile, Invite, AttendanceRecord, MealService,
} from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { CameraScanner } from './CameraScanner';
import { stationUrl } from '../lib/stationCode';
import { parseBadgePayload } from '../lib/badge';
import { ROLE_LABEL } from '../lib/permissions';

interface GateStationProps {
  currentUser: UserProfile;
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  profiles: UserProfile[];
  invites: Invite[];
  attendance: AttendanceRecord[];
  mealServices: MealService[];
  onCheckInToVenue: (userId: string) => void;
  onRecordAttendance: (userId: string, sessionId: string) => void;
  /** Records that somebody left, on events that ask people to scan out. */
  onRecordDeparture: (recordId: string) => void;
  onSignOut: () => void;
}

/**
 * The gate.
 *
 * Written for somebody standing outside in the cold holding an iPad, with a
 * queue in front of them and no training. Everything is one tap from the last
 * thing: choose what you are on, scan, done. There is no navigation to get
 * lost in, nothing to configure, and the result of a scan is a full screen of
 * colour readable at arm's length in daylight.
 *
 * Search by name is equal to scanning rather than a fallback buried in a
 * menu — people forget their badge, phones die, and the queue does not care.
 *
 * Every check-in writes the same attendance record the reports read, so the
 * gate is the source of the numbers rather than a thing that has to be
 * reconciled with them afterwards.
 */

type Result =
  | { kind: 'ok' | 'repeat' | 'out'; person: UserProfile; note?: string }
  | { kind: 'unknown'; detail: string };

export const GateStation: React.FC<GateStationProps> = ({
  currentUser, events, sessions, rooms, profiles, invites, attendance,
  mealServices, onCheckInToVenue, onRecordAttendance, onRecordDeparture, onSignOut,
}) => {
  const [eventId, setEventId] = useState<string | null>(null);
  /** null means the venue gate; otherwise a specific session's door. */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<{ person: UserProfile; at: number }[]>([]);
  /**
   * Unattended on a table, scanning people in on their own.
   *
   * Hides everything that is not the job — no navigation, no sign-out, no
   * search — so a device can be left at a registration desk or beside a
   * session door without anybody being able to wander into the rest of the
   * platform. On an iPad, pair it with Guided Access; this hides the controls,
   * the operating system is what actually locks the device.
   */
  const [kiosk, setKiosk] = useState(false);
  /** Which way the scanning goes. Both are first-class: a device with a poor
   *  rear camera is better at showing a code than reading one. */
  const [direction, setDirection] = useState<'read' | 'show'>('read');
  /** Forces the displayed code to be regenerated as its window rolls over. */
  const [, setTick] = useState(0);
  const [exiting, setExiting] = useState(false);

  const event = events.find((e) => e.id === eventId);
  const eventSessions = useMemo(
    () => sessions.filter((s) => s.eventId === eventId)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [sessions, eventId]);
  const session = eventSessions.find((s) => s.id === sessionId);

  // The shown code rotates, so the screen has to keep up with it.
  useEffect(() => {
    if (direction !== 'show') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [direction]);

  const admit = (person: UserProfile) => {
    const open = sessionId
      ? attendance.find((a) => a.userId === person.id && a.sessionId === sessionId)
      : undefined;

    // Scanning again at a session that asks people to scan out is not a
    // mistake — it is the second half of the transaction.
    if (open && !open.leftAt && event?.requireScanOut && sessionId) {
      onRecordDeparture(open.id);
      const minutes = Math.max(0,
        Math.round((Date.now() - new Date(open.scannedAt).getTime()) / 60000));
      setResult({
        kind: 'out',
        person,
        note: minutes > 0 ? `${minutes} minutes in the room` : undefined,
      });
      setDone((d) => [{ person, at: Date.now() }, ...d].slice(0, 12));
      setQuery('');
      return;
    }

    const already = sessionId ? Boolean(open) : person.checkedIn;
    if (already) { setResult({ kind: 'repeat', person }); return; }

    if (sessionId) onRecordAttendance(person.id, sessionId);
    else onCheckInToVenue(person.id);

    const meal = mealServices
      .map((m) => ({ m, option: m.options.find((o) => o.id === m.selections[person.id]) }))
      .find((x) => x.option);

    setResult({
      kind: 'ok',
      person,
      note: !sessionId && meal?.option ? `Meal: ${meal.option.label}` : undefined,
    });
    setDone((d) => [{ person, at: Date.now() }, ...d].slice(0, 12));
    setQuery('');
  };

  const onScan = (raw: string) => {
    const payload = parseBadgePayload(raw);
    if (!payload) { setResult({ kind: 'unknown', detail: 'That is not a CI Connects badge.' }); return; }

    // A badge carries either an account or, for a card printed before its
    // holder ever signed in, the invitation it stands for.
    const person = payload.uid
      ? profiles.find((p) => p.id === payload.uid)
      : undefined;
    if (person) { admit(person); return; }

    // An invitation printed before the account existed. Whoever is holding it
    // was invited; turning them away at the gate over a database detail would
    // be absurd, so the card is honoured and the mismatch explained.
    const invite = invites.find((i) => i.id === payload.inv);
    if (invite) {
      const claimed = profiles.find(
        (p) => p.email.toLowerCase() === invite.email.toLowerCase());
      if (claimed) { admit(claimed); return; }
    }
    setResult({
      kind: 'unknown',
      detail: invite
        ? `${invite.fullName} of ${invite.organization || 'an invited organisation'} is on `
          + 'the guest list but has never signed in. Admit them, and ask them to sign in '
          + 'so their sessions and meals are recorded.'
        : 'No record for this badge. Check the name against the guest list.',
    });
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return profiles
      .filter((p) => p.fullName.toLowerCase().includes(q)
        || p.email.toLowerCase().includes(q)
        || (p.organization ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [profiles, query]);

  const admittedCount = sessionId
    ? attendance.filter((a) => a.sessionId === sessionId).length
    : profiles.filter((p) => p.checkedIn).length;

  /* ---------------------------------------------------------- choose event */
  if (!event) {
    return (
      <Shell currentUser={currentUser} onSignOut={onSignOut} title="Which event?">
        <div className="space-y-3">
          {events.length === 0 && (
            <p className="text-slate-400 text-center py-10">No events to staff.</p>
          )}
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => setEventId(e.id)}
              className="w-full text-left p-5 rounded-2xl bg-slate-800 border-2 border-slate-700 hover:border-blue-500 transition-colors cursor-pointer"
            >
              <div className="text-lg font-bold text-white">{e.name}</div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                <CalendarDays className="w-4 h-4" />
                {e.dateLabel}
              </div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  /* ------------------------------------------------------------ the result */
  if (result) {
    const tone =
      result.kind === 'ok' ? 'bg-emerald-600'
      : result.kind === 'out' ? 'bg-blue-600'
      : result.kind === 'repeat' ? 'bg-amber-500' : 'bg-slate-700';
    return (
      <button
        onClick={() => setResult(null)}
        className={`fixed inset-0 z-50 ${tone} text-white flex flex-col items-center justify-center p-8 text-center cursor-pointer`}
      >
        {result.kind === 'ok' && <Check className="w-24 h-24 mb-4" strokeWidth={3} />}
        {result.kind === 'out' && <LogOut className="w-20 h-20 mb-4" strokeWidth={2.5} />}
        {result.kind === 'repeat' && <AlertTriangle className="w-20 h-20 mb-4" strokeWidth={2.5} />}
        {result.kind === 'unknown' && <X className="w-20 h-20 mb-4" strokeWidth={2.5} />}

        {result.kind === 'unknown' ? (
          <>
            <div className="text-2xl font-bold mb-2">Not recognised</div>
            <p className="text-white/85 max-w-md">{result.detail}</p>
          </>
        ) : (
          <>
            <img src={result.person.avatarUrl} alt=""
                 className="w-24 h-24 rounded-2xl object-cover border-4 border-white/40 mb-5" />
            <div className="text-4xl sm:text-5xl font-bold leading-tight">
              {result.person.preferredName || result.person.fullName.split(' ')[0]}
            </div>
            <div className="text-xl text-white/90 mt-1">{result.person.fullName}</div>
            <div className="text-base text-white/75 mt-2">
              {ROLE_LABEL[result.person.role]}
              {result.person.organization && ` · ${result.person.organization}`}
            </div>
            {result.kind === 'repeat' && (
              <div className="mt-5 text-lg font-semibold">Already checked in</div>
            )}
            {result.kind === 'out' && (
              <div className="mt-5 text-lg font-semibold">Scanned out — thank you</div>
            )}
            {result.note && (
              <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-base font-semibold">
                <Utensils className="w-4 h-4" />
                {result.note}
              </div>
            )}
          </>
        )}
        <div className="mt-10 text-sm text-white/70">Tap anywhere for the next person</div>
      </button>
    );
  }

  /* -------------------------------------------------------------- the gate */
  if (kiosk) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full">
          <div className="text-center mb-6">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300 mb-2">
              {session ? 'Session check-in' : 'Welcome to'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              {session ? session.title : event.name}
            </h1>
            <p className="text-slate-400 mt-2">
              {session
                ? `${rooms.find((r) => r.id === session.roomId)?.name ?? ''} · ${session.startTime}`
                : `${event.dateLabel} · ${event.venueName}`}
            </p>
          </div>

          {direction === 'read' ? (
            <>
              <div className="w-full max-w-md rounded-3xl overflow-hidden border-4 border-slate-700 bg-black">
                <CameraScanner onScan={onScan} />
              </div>
              <p className="text-xl sm:text-2xl font-semibold mt-6 text-center">
                Hold your badge up to the camera
              </p>
            </>
          ) : (
            <>
              <div className="bg-white p-6 rounded-3xl">
                <QRCodeSVG value={stationUrl(event.id, sessionId ?? undefined)}
                           size={260} level="M" bgColor="#ffffff" fgColor="#002b54" />
              </div>
              <p className="text-xl sm:text-2xl font-semibold mt-6 text-center">
                Scan this with your phone camera
              </p>
            </>
          )}
          <p className="text-slate-400 mt-1.5 text-center">
            {direction === 'read'
              ? 'On your phone or printed — either works'
              : 'It opens CI Connects and checks you in'}
            {event.requireScanOut && session && '. Scan again on your way out.'}
          </p>

          <div className="mt-8 text-center">
            <div className="text-4xl font-bold tabular-nums">{admittedCount}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">checked in</div>
          </div>
        </div>

        {/* Deliberately small and confirmed. Guided Access on the iPad is what
            actually locks the device; this stops an idle tap wandering off. */}
        <div className="p-4 text-center">
          {exiting ? (
            <div className="inline-flex items-center gap-2">
              <button onClick={() => { setKiosk(false); setExiting(false); }}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-sm font-semibold cursor-pointer">
                Leave kiosk mode
              </button>
              <button onClick={() => setExiting(false)}
                      className="px-4 py-2 rounded-lg text-sm text-slate-400 cursor-pointer">
                Stay
              </button>
            </div>
          ) : (
            <button onClick={() => setExiting(true)}
                    className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer">
              CI Connects
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Shell
      currentUser={currentUser}
      onSignOut={onSignOut}
      title={session ? session.title : event.name}
      subtitle={session
        ? `${rooms.find((r) => r.id === session.roomId)?.name ?? ''} · Day ${session.day} ${session.startTime}`
        : 'Venue entry'}
      onBack={() => (sessionId ? setSessionId(null) : setEventId(null))}
      count={admittedCount}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([['read', 'Scan their badge', ScanLine], ['show', 'They scan us', QrCode]] as const)
            .map(([mode, label, Icon]) => (
              <button
                key={mode}
                onClick={() => setDirection(mode)}
                className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border-2 text-sm font-bold transition-colors cursor-pointer ${
                  direction === mode
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
        </div>

        {direction === 'read' ? (
          <div className="rounded-2xl overflow-hidden border-2 border-slate-700 bg-black">
            <CameraScanner onScan={onScan} />
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-slate-700 bg-white p-6 flex flex-col items-center">
            <QRCodeSVG value={stationUrl(event.id, sessionId ?? undefined)}
                       size={200} level="M" bgColor="#ffffff" fgColor="#002b54" />
            <p className="text-slate-600 text-sm font-semibold mt-4 text-center">
              People scan this with their own phone camera
            </p>
            <p className="text-slate-400 text-[11px] mt-1 text-center max-w-xs leading-relaxed">
              The code changes every ninety seconds, so a photograph of it is no use to
              somebody who did not come.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <ScanLine className="w-4 h-4" />
            Point at the QR on a badge or phone
          </div>
          <button
            onClick={() => setKiosk(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Tablet className="w-4 h-4" />
            Kiosk mode
          </button>
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">
          Kiosk mode fills the screen and hides everything else, so a device can be left
          on a table for people to scan themselves in.
        </p>

        {/* Equal to scanning, not hidden behind it: badges get forgotten and
            phones run out of battery, and the queue keeps arriving. */}
        <div>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Or type a name"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-800 border-2 border-slate-700 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          {matches.length > 0 && (
            <div className="mt-2 space-y-2">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => admit(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 transition-colors text-left cursor-pointer"
                >
                  <img src={p.avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-semibold truncate">{p.fullName}</div>
                    <div className="text-slate-400 text-sm truncate">
                      {p.organization || ROLE_LABEL[p.role]}
                    </div>
                  </div>
                  <UserCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Session doors, for staff standing at a room rather than the gate. */}
        {!sessionId && eventSessions.length > 0 && (
          <details className="rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden">
            <summary className="px-4 py-3.5 text-slate-300 font-semibold cursor-pointer">
              Scanning a session door instead?
            </summary>
            <div className="max-h-64 overflow-y-auto border-t border-slate-700">
              {eventSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSessionId(s.id)}
                  className="w-full text-left px-4 py-3 border-b border-slate-700/60 hover:bg-slate-700/50 transition-colors cursor-pointer"
                >
                  <div className="text-white text-sm font-semibold">{s.title}</div>
                  <div className="text-slate-400 text-xs">
                    Day {s.day} · {s.startTime} · {rooms.find((r) => r.id === s.roomId)?.name}
                  </div>
                </button>
              ))}
            </div>
          </details>
        )}

        {done.length > 0 && (
          <div className="rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-700">
              Just admitted
            </div>
            {done.map(({ person, at }) => (
              <div key={`${person.id}-${at}`} className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-700/60 last:border-0">
                <img src={person.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                <span className="text-white text-sm truncate flex-1">{person.fullName}</span>
                <span className="text-slate-500 text-xs shrink-0">
                  {new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
};

/** Dark, large, and free of anything that is not the job. */
const Shell: React.FC<{
  currentUser: UserProfile;
  title: string;
  subtitle?: string;
  count?: number;
  onBack?: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}> = ({ currentUser, title, subtitle, count, onBack, onSignOut, children }) => (
  <div className="min-h-screen bg-slate-900 text-white">
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-700">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack}
                  className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-blue-200" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate">{title}</div>
          <div className="text-xs text-slate-400 truncate">
            {subtitle ?? `${currentUser.preferredName || currentUser.fullName} · ${ROLE_LABEL[currentUser.role]}`}
          </div>
        </div>
        {count !== undefined && (
          <div className="text-right shrink-0 px-3">
            <div className="text-2xl font-bold leading-none tabular-nums">{count}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">in</div>
          </div>
        )}
        <button onClick={onSignOut} title="Sign out"
                className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
    <main className="max-w-2xl mx-auto px-4 py-5">{children}</main>
  </div>
);
