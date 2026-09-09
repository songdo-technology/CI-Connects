import React, { useMemo, useState } from 'react';
import {
  X, ShieldCheck, ShieldAlert, DoorOpen, MapPin, UserCheck, Clock, Search,
  Building2, ScanLine, CheckCircle2,
} from 'lucide-react';
import { Session, UserProfile, Room, AttendanceRecord } from '../types';
import { CameraScanner } from './CameraScanner';
import { parseBadgePayload } from '../lib/badge';
import { ROLE_LABEL } from '../lib/permissions';

interface DoorScannerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  rooms: Room[];
  profiles: UserProfile[];
  attendance: AttendanceRecord[];
  currentUser: UserProfile;
  onRecordAttendance: (userId: string, sessionId: string) => AttendanceRecord;
  onCheckInToVenue: (userId: string) => void;
}

type Mode = 'venue' | 'session';

/**
 * The scanner used at both kinds of door.
 *
 * Venue entry is the main gate: security scans whatever a person shows — a
 * printed card or their phone — and they are admitted to the event. Session
 * doors are the second stage, where a scan is checked against what that person
 * actually booked.
 *
 * They are one component because they are one physical motion for the operator
 * and one queue for the attendee, and because a session scan should also admit
 * someone who slipped past the front desk rather than refusing them at the
 * classroom door.
 *
 * The result takes over the screen deliberately. A steward is holding a phone
 * at arm's length in a moving queue and needs to read the outcome in a glance,
 * not find a status line.
 */
export const DoorScanner: React.FC<DoorScannerProps> = ({
  isOpen, onClose, sessions, rooms, profiles, attendance, currentUser,
  onRecordAttendance, onCheckInToVenue,
}) => {
  const [mode, setMode] = useState<Mode>('venue');
  const [doorSessionId, setDoorSessionId] = useState<string>(sessions[0]?.id ?? '');
  const [input, setInput] = useState<'camera' | 'manual'>('camera');
  const [query, setQuery] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    user: UserProfile;
    kind: 'venue' | AttendanceRecord['status'];
    at: string;
    sessionTitle?: string;
  } | null>(null);

  const doorSession = useMemo(
    () => sessions.find((s) => s.id === doorSessionId),
    [sessions, doorSessionId]);
  const doorRoom = rooms.find((r) => r.id === doorSession?.roomId);

  const scansHere = attendance.filter((a) => a.sessionId === doorSessionId);
  const admittedCount = profiles.filter((p) => p.checkedIn).length;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => p.role !== 'front_desk')
      .filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 25);
  }, [profiles, query]);

  if (!isOpen) return null;

  const admit = (user: UserProfile) => {
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (mode === 'venue') {
      if (!user.checkedIn) onCheckInToVenue(user.id);
      setResult({ user, kind: 'venue', at });
    } else {
      const record = onRecordAttendance(user.id, doorSessionId);
      setResult({
        user, kind: record.status, at: record.scannedAt,
        sessionTitle: doorSession?.title,
      });
    }
    setScanError(null);
  };

  const handleDecoded = (raw: string) => {
    const payload = parseBadgePayload(raw);
    if (!payload) {
      setScanError('That code is not a CI Connects badge.');
      return;
    }
    const user = profiles.find((p) => p.id === payload.uid);
    if (!user) {
      setScanError('That badge does not match anyone registered for this event.');
      return;
    }
    // A live badge names the session its holder is in right now; trust it over
    // the door selector, which is what makes one phone work at any door.
    if (mode === 'session' && payload.sid && sessions.some((s) => s.id === payload.sid)) {
      const record = onRecordAttendance(user.id, payload.sid);
      setResult({
        user, kind: record.status, at: record.scannedAt,
        sessionTitle: sessions.find((s) => s.id === payload.sid)?.title,
      });
      setScanError(null);
      return;
    }
    admit(user);
  };

  const RESULT_STYLE = {
    venue:         { bg: 'bg-emerald-600', icon: CheckCircle2, head: 'Welcome', sub: 'Admitted to the event' },
    verified:      { bg: 'bg-emerald-600', icon: ShieldCheck,  head: 'Verified', sub: 'Booked into this session' },
    walk_in:       { bg: 'bg-blue-600',    icon: UserCheck,    head: 'Walk-in',  sub: 'Admitted — no booking held' },
    wrong_session: { bg: 'bg-amber-600',   icon: ShieldAlert,  head: 'Wrong room', sub: 'Booked into a different session now' },
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <DoorOpen className="w-5 h-5 text-blue-200 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-base leading-tight">Door Scanner</h3>
              <p className="text-xs text-blue-100/80 truncate">
                {mode === 'venue'
                  ? `${admittedCount} admitted to the venue`
                  : `${scansHere.length} scanned into this session`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------- Result takeover ---------------- */}
        {result ? (
          (() => {
            const style = RESULT_STYLE[result.kind];
            const Icon = style.icon;
            return (
              <div className={`${style.bg} text-white flex-1 flex flex-col items-center justify-center p-8 text-center animate-[fadeIn_180ms_ease-out]`}>
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
                  <Icon className="w-14 h-14" strokeWidth={2.5} />
                </div>
                <div className="text-sm font-bold tracking-[0.25em] uppercase opacity-80 mb-2">
                  {style.head}
                </div>
                <div className="text-4xl sm:text-5xl font-bold leading-tight mb-3">
                  {result.user.fullName}
                </div>
                <div className="text-base opacity-90 mb-1">
                  {[result.user.title, result.user.organization].filter(Boolean).join(' · ')}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider mb-4">
                  {ROLE_LABEL[result.user.role]}
                </div>
                <div className="text-sm opacity-80">{style.sub}</div>
                {result.sessionTitle && (
                  <div className="text-sm opacity-70 mt-1 max-w-md">{result.sessionTitle}</div>
                )}
                <div className="text-xs opacity-60 mt-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {result.at}
                </div>

                <button
                  onClick={() => setResult(null)}
                  className="mt-8 px-8 py-4 rounded-xl bg-white text-slate-900 font-bold text-lg hover:bg-white/90 transition-colors cursor-pointer"
                >
                  Next person
                </button>
              </div>
            );
          })()
        ) : (
          <div className="overflow-y-auto p-5 space-y-4">
            {/* Which door */}
            <div className="grid grid-cols-2 gap-2">
              {([
                ['venue', 'Main entrance', Building2, 'Admit to the event'],
                ['session', 'Session door', DoorOpen, 'Check into a session'],
              ] as const).map(([m, label, Icon, hint]) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setScanError(null); }}
                  className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                    mode === m ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${mode === m ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold text-slate-900">{label}</span>
                  <span className="text-[11px] text-slate-500">{hint}</span>
                </button>
              ))}
            </div>

            {mode === 'session' && (
              <div>
                <label htmlFor="door-session" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  This device is at
                </label>
                <select
                  id="door-session"
                  value={doorSessionId}
                  onChange={(e) => setDoorSessionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>Day {s.day} · {s.startTime} — {s.title}</option>
                  ))}
                </select>
                {doorRoom && (
                  <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {doorRoom.name} · {doorSession?.reservedUserIds.length ?? 0} booked · {scansHere.length} in
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  A phone badge names its own session, so this only applies to printed cards.
                </p>
              </div>
            )}

            {/* Camera or manual */}
            <div className="flex items-center gap-1.5">
              {([['camera', 'Scan a code'], ['manual', 'No code — find by name']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setInput(v)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    input === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scanError && (
              <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {scanError}
              </div>
            )}

            {input === 'camera' ? (
              <CameraScanner onScan={handleDecoded} paused={Boolean(result)} />
            ) : (
              <div>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type a name or email…"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
                  <ScanLine className="w-3 h-3" />
                  For anyone who has lost their badge or cannot show a code.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                  {matches.map((p) => {
                    const already = mode === 'venue'
                      ? p.checkedIn
                      : scansHere.some((a) => a.userId === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => admit(p)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-600 transition-colors text-left cursor-pointer"
                      >
                        <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</div>
                          <div className="text-[11px] text-slate-500 truncate">{p.organization}</div>
                        </div>
                        {already && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                            IN
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {matches.length === 0 && (
                    <p className="text-sm text-slate-400 italic p-4">No one matches that.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
