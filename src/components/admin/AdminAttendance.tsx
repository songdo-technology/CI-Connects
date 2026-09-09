import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Search, Download, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react';
import { AttendanceRecord, Session, UserProfile, EventConfig, Room } from '../../types';
import { Field, inputClass } from './formKit';

interface AdminAttendanceProps {
  attendance: AttendanceRecord[];
  sessions: Session[];
  rooms: Room[];
  profiles: UserProfile[];
  events: EventConfig[];
}

/**
 * Who came, and to what.
 *
 * Two views because organisers ask two different questions. "Did this session
 * fill?" is answered per session; "did this person turn up?" is answered per
 * person, and after an event it is the one that matters for professional-growth
 * reporting.
 *
 * Booked and attended are shown side by side throughout. A session with forty
 * bookings and twelve arrivals is a finding; a headcount alone hides it.
 */
export const AdminAttendance: React.FC<AdminAttendanceProps> = ({
  attendance, sessions, rooms, profiles, events,
}) => {
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [view, setView] = useState<'sessions' | 'people'>('sessions');
  const [query, setQuery] = useState('');

  const eventSessions = useMemo(
    () => sessions.filter((s) => s.eventId === eventId)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [sessions, eventId]);

  const sessionIds = useMemo(() => new Set(eventSessions.map((s) => s.id)), [eventSessions]);
  const records = useMemo(
    () => attendance.filter((a) => sessionIds.has(a.sessionId)),
    [attendance, sessionIds]);

  const admitted = profiles.filter((p) => p.checkedIn);

  const bySession = useMemo(() => eventSessions.map((s) => {
    const rows = records.filter((a) => a.sessionId === s.id);
    const booked = s.reservedUserIds.length;
    return {
      session: s,
      room: rooms.find((r) => r.id === s.roomId),
      booked,
      attended: rows.length,
      verified: rows.filter((a) => a.status === 'verified').length,
      walkIn: rows.filter((a) => a.status === 'walk_in').length,
      wrong: rows.filter((a) => a.status === 'wrong_session').length,
      // Of the people who booked, how many actually came.
      showRate: booked ? Math.round((rows.filter((a) => a.status === 'verified').length / booked) * 100) : null,
    };
  }), [eventSessions, records, rooms]);

  const byPerson = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .map((p) => {
        const rows = records.filter((a) => a.userId === p.id);
        const booked = eventSessions.filter((s) => s.reservedUserIds.includes(p.id));
        return {
          person: p,
          booked: booked.length,
          attended: rows.length,
          // Sessions they booked and did not scan into.
          missed: booked.filter((s) => !rows.some((a) => a.sessionId === s.id)).length,
          records: rows,
        };
      })
      .filter((r) => r.booked > 0 || r.attended > 0 || r.person.checkedIn)
      .sort((a, b) => b.attended - a.attended || a.person.fullName.localeCompare(b.person.fullName));
  }, [profiles, records, eventSessions, query]);

  /** CSV so the record can leave the platform — professional-growth reporting
   *  happens in whatever the school already uses, not here. */
  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Organisation', 'Session', 'Day', 'Start', 'Room', 'Status', 'Scanned at'],
      ...records.map((a) => {
        const p = profiles.find((x) => x.id === a.userId);
        const s = eventSessions.find((x) => x.id === a.sessionId);
        return [
          p?.fullName ?? 'Unknown', p?.email ?? '', p?.organization ?? '',
          s?.title ?? '', String(s?.day ?? ''), s?.startTime ?? '',
          rooms.find((r) => r.id === s?.roomId)?.name ?? '',
          a.status, a.scannedAt,
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <ClipboardCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Attendance</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {admitted.length} admitted to the venue · {records.length} session scans recorded.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Event">
            <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            {([['sessions', 'By session'], ['people', 'By person']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  view === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={exportCsv}
              disabled={records.length === 0}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {view === 'sessions' ? (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {bySession.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400 italic">No sessions for this event.</p>
          )}
          {bySession.map((r) => (
            <div key={r.session.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 leading-snug">{r.session.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Day {r.session.day} · {r.session.startTime} · {r.room?.name ?? '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-slate-900 tabular-nums">
                    {r.attended}
                    <span className="text-sm font-medium text-slate-400"> / {r.booked}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">attended / booked</div>
                </div>
              </div>

              {/* Booked-versus-attended as one bar: the shortfall is the point. */}
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                <div className="h-full rounded-r"
                     style={{
                       width: `${Math.min(100, r.booked ? (r.verified / r.booked) * 100 : 0)}%`,
                       background: (r.showRate ?? 100) < 60 ? '#b04318' : '#2a6791',
                     }} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-800">
                  <ShieldCheck className="w-3 h-3" /> {r.verified} verified
                </span>
                {r.walkIn > 0 && (
                  <span className="flex items-center gap-1 text-blue-700">
                    <UserCheck className="w-3 h-3" /> {r.walkIn} walk-in
                  </span>
                )}
                {r.wrong > 0 && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <ShieldAlert className="w-3 h-3" /> {r.wrong} wrong room
                  </span>
                )}
                {r.showRate !== null && (
                  <span className={r.showRate < 60 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                    {r.showRate}% of those who booked turned up
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {byPerson.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-400 italic">Nobody matches that.</p>
            )}
            {byPerson.map((r) => (
              <div key={r.person.id} className="p-4 flex items-center gap-4">
                <img src={r.person.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 truncate">{r.person.fullName}</span>
                    {r.person.checkedIn && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                        At venue
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{r.person.organization}</div>
                  {r.records.length > 0 && (
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {r.records.map((a) =>
                        eventSessions.find((s) => s.id === a.sessionId)?.title).filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {r.attended}<span className="text-slate-400 font-medium"> / {r.booked}</span>
                  </div>
                  <div className={`text-[11px] ${r.missed > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {r.missed > 0 ? `${r.missed} booked, not attended` : 'attended / booked'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
