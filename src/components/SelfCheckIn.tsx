import React, { useEffect, useState } from 'react';
import { Check, X, Clock, LogIn, Loader2, MapPin, Building2 } from 'lucide-react';
import { EventConfig, Session, Room, UserProfile, AttendanceRecord } from '../types';
import { readStationToken, isExpiredStationToken } from '../lib/stationCode';

interface SelfCheckInProps {
  token: string;
  currentUser: UserProfile | null;
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  attendance: AttendanceRecord[];
  onCheckInToVenue: (userId: string) => void;
  onRecordAttendance: (userId: string, sessionId: string) => void;
  onRecordDeparture: (recordId: string) => void;
  onSignIn: () => void;
  onDone: () => void;
}

/**
 * What happens when somebody scans a station's code with their own phone.
 *
 * One screen, one outcome, large enough to read while walking. The station is
 * a display and is trusted for nothing: the person's own signed-in session is
 * what records the attendance, so a screenshot forwarded to a colleague
 * records that colleague and not the sender — and only for the ninety seconds
 * the code is alive.
 */
export const SelfCheckIn: React.FC<SelfCheckInProps> = ({
  token, currentUser, events, sessions, rooms, attendance,
  onCheckInToVenue, onRecordAttendance, onRecordDeparture, onSignIn, onDone,
}) => {
  const [state, setState] = useState<'working' | 'in' | 'out' | 'repeat' | 'expired' | 'bad'>('working');

  const claim = readStationToken(token);
  const event = claim ? events.find((e) => e.id === claim.eventId) : undefined;
  const session = claim?.sessionId ? sessions.find((s) => s.id === claim.sessionId) : undefined;

  useEffect(() => {
    if (!currentUser) return;
    if (!claim) { setState(isExpiredStationToken(token) ? 'expired' : 'bad'); return; }
    if (!event) { setState('bad'); return; }
    if (state !== 'working') return;

    if (claim.sessionId) {
      const open = attendance.find(
        (a) => a.userId === currentUser.id && a.sessionId === claim.sessionId);
      if (open && !open.leftAt && event.requireScanOut) {
        onRecordDeparture(open.id); setState('out'); return;
      }
      if (open) { setState('repeat'); return; }
      onRecordAttendance(currentUser.id, claim.sessionId); setState('in'); return;
    }

    if (currentUser.checkedIn) { setState('repeat'); return; }
    onCheckInToVenue(currentUser.id); setState('in');
    // Runs once per arrival; re-running on every attendance change would
    // re-decide an outcome the person is already reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, token]);

  if (!currentUser) {
    return (
      <Frame tone="bg-blue-600">
        <LogIn className="w-16 h-16 mb-5" strokeWidth={2.5} />
        <div className="text-2xl font-bold mb-2">Sign in to check in</div>
        <p className="text-white/85 max-w-sm mb-7">
          {event ? `${event.name} — ` : ''}we need to know who you are before recording
          your attendance. It takes a moment and you will come straight back.
        </p>
        <button onClick={onSignIn}
                className="px-7 py-4 rounded-xl bg-white text-blue-700 font-bold cursor-pointer">
          Sign in
        </button>
      </Frame>
    );
  }

  if (state === 'working') {
    return <Frame tone="bg-slate-800"><Loader2 className="w-14 h-14 animate-spin" /></Frame>;
  }

  if (state === 'expired' || state === 'bad') {
    return (
      <Frame tone="bg-slate-700" onDismiss={onDone}>
        <X className="w-16 h-16 mb-5" strokeWidth={2.5} />
        <div className="text-2xl font-bold mb-2">
          {state === 'expired' ? 'That code has expired' : 'Code not recognised'}
        </div>
        <p className="text-white/85 max-w-sm">
          {state === 'expired'
            ? 'Codes change every ninety seconds so a photograph of one is no use later. '
              + 'Scan the screen again.'
            : 'Nothing here matches that code. Ask whoever is on the desk.'}
        </p>
      </Frame>
    );
  }

  const tone = state === 'out' ? 'bg-blue-600' : state === 'repeat' ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <Frame tone={tone} onDismiss={onDone}>
      {state === 'repeat'
        ? <Clock className="w-16 h-16 mb-5" strokeWidth={2.5} />
        : <Check className="w-20 h-20 mb-5" strokeWidth={3} />}
      <div className="text-3xl sm:text-4xl font-bold leading-tight mb-1">
        {state === 'out' ? 'Scanned out' : state === 'repeat' ? 'Already checked in' : "You're in"}
      </div>
      <div className="text-lg text-white/90">
        {currentUser.preferredName || currentUser.fullName}
      </div>
      {(session || event) && (
        <div className="mt-5 space-y-1 text-white/85">
          <div className="text-base font-semibold">{session?.title ?? event?.name}</div>
          {session && (
            <div className="flex items-center justify-center gap-1.5 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              {rooms.find((r) => r.id === session.roomId)?.name} · {session.startTime}
            </div>
          )}
        </div>
      )}
      {session && event?.requireScanOut && state === 'in' && (
        <div className="mt-6 px-4 py-2.5 rounded-full bg-white/20 text-sm font-semibold">
          Scan again on your way out
        </div>
      )}
      <button onClick={onDone}
              className="mt-9 px-6 py-3 rounded-xl bg-white/20 font-semibold cursor-pointer">
        Done
      </button>
    </Frame>
  );
};

const Frame: React.FC<{
  tone: string; onDismiss?: () => void; children: React.ReactNode;
}> = ({ tone, children }) => (
  <div className={`min-h-screen ${tone} text-white flex flex-col items-center justify-center p-8 text-center`}>
    <div className="flex items-center gap-2 text-white/70 text-sm absolute top-6">
      <Building2 className="w-4 h-4" />
      CI Connects
    </div>
    {children}
  </div>
);
