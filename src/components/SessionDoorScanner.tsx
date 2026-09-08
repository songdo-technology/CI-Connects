import React, { useMemo, useState } from 'react';
import { X, ScanLine, ShieldCheck, ShieldAlert, DoorOpen, MapPin, UserCheck, Clock } from 'lucide-react';
import { Session, UserProfile, Room, AttendanceRecord } from '../types';

interface SessionDoorScannerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  rooms: Room[];
  profiles: UserProfile[];
  attendance: AttendanceRecord[];
  currentUser: UserProfile;
  onRecordAttendance: (userId: string, sessionId: string) => AttendanceRecord;
}

/**
 * Door-side badge scanner, operated by session hosts and event staff.
 *
 * A scan answers two separate questions, and the distinction is the point:
 *   1. Is this a real, checked-in attendee?  (identity)
 *   2. Do they hold a reservation for THIS session?  (entitlement)
 *
 * Scanning at the wrong door is not treated as a failure — it is recorded as
 * such, so the post-event audit can distinguish "attended the wrong session"
 * from "did not attend at all". That distinction is what makes the record
 * usable as proof of attendance.
 *
 * PROTOTYPE: a camera QR read is simulated by picking a badge from the list.
 * The verification logic below is the real logic and does not change when a
 * camera is wired in.
 */
export const SessionDoorScanner: React.FC<SessionDoorScannerProps> = ({
  isOpen, onClose, sessions, rooms, profiles, attendance, currentUser, onRecordAttendance,
}) => {
  const [doorSessionId, setDoorSessionId] = useState<string>(sessions[0]?.id ?? '');
  const [lastScan, setLastScan] = useState<{ record: AttendanceRecord; user: UserProfile } | null>(null);

  const doorSession = useMemo(
    () => sessions.find((s) => s.id === doorSessionId),
    [sessions, doorSessionId],
  );
  const doorRoom = rooms.find((r) => r.id === doorSession?.roomId);

  const scansForThisDoor = attendance.filter((a) => a.sessionId === doorSessionId);

  if (!isOpen) return null;

  const handleScan = (user: UserProfile) => {
    const record = onRecordAttendance(user.id, doorSessionId);
    setLastScan({ record, user });
  };

  const STATUS_META = {
    verified:      { label: 'Verified — reserved for this session', icon: ShieldCheck, className: 'bg-emerald-50 border-emerald-400 text-emerald-900', chip: 'bg-emerald-600' },
    walk_in:       { label: 'Walk-in — admitted, no reservation held', icon: UserCheck, className: 'bg-blue-50 border-blue-400 text-blue-900', chip: 'bg-blue-600' },
    wrong_session: { label: 'Wrong session — reserved elsewhere at this time', icon: ShieldAlert, className: 'bg-amber-50 border-amber-500 text-amber-900', chip: 'bg-amber-600' },
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <DoorOpen className="w-5 h-5 text-blue-200" />
            <div>
              <h3 className="font-bold text-base leading-tight">Session Door Scanner</h3>
              <p className="text-xs text-blue-100/80">Verify attendance at the session entrance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Which door is this terminal standing at */}
          <div>
            <label htmlFor="door-session" className="block text-xs font-semibold text-slate-600 mb-1.5">
              This terminal is positioned at
            </label>
            <select
              id="door-session"
              value={doorSessionId}
              onChange={(e) => { setDoorSessionId(e.target.value); setLastScan(null); }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.startTime} — {s.title}
                </option>
              ))}
            </select>
            {doorRoom && (
              <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {doorRoom.name} ({doorRoom.floorLabel}) · capacity {doorRoom.capacity} ·{' '}
                {doorSession?.reservedUserIds.length ?? 0} reserved · {scansForThisDoor.length} scanned in
              </p>
            )}
          </div>

          {/* Result of the most recent scan */}
          {lastScan && (() => {
            const meta = STATUS_META[lastScan.record.status];
            const Icon = meta.icon;
            return (
              <div className={`rounded-xl border-2 p-4 ${meta.className}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${meta.chip} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-sm">{lastScan.user.fullName}</span>
                      <span className="text-xs opacity-70">{lastScan.user.title}</span>
                    </div>
                    <p className="text-xs font-semibold mb-1.5">{meta.label}</p>
                    <p className="text-[11px] opacity-70 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Recorded {lastScan.record.scannedAt} · scanned by {currentUser.fullName}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Simulated badge reads */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ScanLine className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Simulate a badge scan
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {profiles.filter((p) => p.role !== 'front_desk').map((p) => {
                const alreadyScanned = scansForThisDoor.some((a) => a.userId === p.id);
                const isReserved = doorSession?.reservedUserIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleScan(p)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-600 transition-colors text-left cursor-pointer"
                  >
                    <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {isReserved ? 'Holds a reservation' : 'No reservation'}
                      </div>
                    </div>
                    {alreadyScanned && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                        IN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
