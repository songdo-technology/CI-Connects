import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DIETARY_META } from '../lib/dietary';
import { buildBadgePayload, currentSessionFor } from '../lib/badge';
import { ShieldCheck, CheckCircle2, Clock, Sparkles, Download, Share2, Scan, Camera, Building2, QrCode, AlertCircle, ExternalLink, RefreshCw, Printer, UtensilsCrossed, DoorOpen, ShieldOff } from 'lucide-react';
import { UserProfile, Session, MealService, MealOption, AttendanceRecord } from '../types';

interface DigitalBadgeProps {
  currentUser: UserProfile;
  onToggleCheckIn: (userId: string) => void;
  reservedSessions: Session[];
  onOpenScanner: () => void;
  mealSelections: { service: MealService; option: MealOption }[];
  attendanceRecords: AttendanceRecord[];
  sessions: Session[];
  onToggleContactSharing: () => void;
  onOpenDoorScanner: () => void;
  onOpenPrintBadge: () => void;
}

export const DigitalBadge: React.FC<DigitalBadgeProps> = ({
  currentUser,
  onToggleCheckIn,
  reservedSessions,
  mealSelections,
  attendanceRecords,
  sessions,
  onToggleContactSharing,
  onOpenDoorScanner,
  onOpenPrintBadge,
  onOpenScanner,
}) => {
  const [copiedUuid, setCopiedUuid] = useState(false);

  /* Held for the life of the mount; regenerating per render made the
     footer token flicker on every state change. */
  const sessionToken = useMemo(
    () => Math.random().toString(36).substring(2, 8).toUpperCase(),
    [],
  );

  // Encode structured payload into dynamic QR Code
  /**
   * The code refreshes on a timer so it always names the session the holder is
   * booked into right now. A door scan then resolves the session by itself,
   * instead of the scanner having to be told which door it is standing at.
   *
   * Personal details are deliberately absent from the payload: a QR is
   * photographable, and a uid the rules can resolve is enough. Name and email
   * come from the directory once the scanner has authenticated.
   */
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSession = useMemo(
    () => currentSessionFor(
      currentUser,
      sessions,
      nowTick.getHours() * 60 + nowTick.getMinutes(),
      // Day is inferred from which day's sessions the person actually holds;
      // a two-day event means the badge must not assume day 1.
      reservedSessions[0]?.day ?? 1,
    ),
    [currentUser, sessions, nowTick, reservedSessions],
  );

  const qrPayload = useMemo(
    () => buildBadgePayload(currentUser, 'ci-connects', activeSession, 'live'),
    [currentUser, activeSession],
  );

  const handleCopyId = () => {
    navigator.clipboard?.writeText(currentUser.id);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
  };

  const getPassHeaderColor = () => {
    switch (currentUser.userType) {
      case 'internal_faculty':
        return 'from-emerald-800 via-teal-900 to-slate-950';
      case 'internal_staff':
        return 'from-blue-900 via-indigo-950 to-slate-950';
      case 'external_guest':
        return 'from-amber-800 via-orange-950 to-slate-950';
      case 'student':
        return 'from-purple-900 via-violet-950 to-slate-950';
      default:
        return 'from-slate-900 via-indigo-950 to-slate-950';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Top Controls: Staff Scanner Launch */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">Event Staff Terminal</h3>
            <p className="text-[11px] text-slate-500">Scan incoming attendee badges</p>
          </div>
        </div>
        <button
          onClick={onOpenScanner}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Launch Scanner</span>
        </button>
      </div>

      {/* Physical Lanyard / Digital Pass Card */}
      <div className="relative group perspective">
        
        {/* Pass Hole/Lanyard cutout effect */}
        <div className="flex justify-center -mb-3 relative z-10">
          <div className="w-14 h-4 bg-slate-200 rounded-full border border-slate-300 shadow-inner flex items-center justify-center">
            <div className="w-8 h-1.5 bg-slate-400 rounded-full" />
          </div>
        </div>

        {/* Main Pass Container */}
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-300 shadow-xl transition-all duration-300">
          
          {/* Header gradient banner */}
          <div className={`p-6 bg-gradient-to-br ${getPassHeaderColor()} text-white relative overflow-hidden`}>
            {/* Background geometric accents */}
            <div className="absolute right-0 top-0 w-36 h-36 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute left-0 bottom-0 w-24 h-24 bg-blue-400/10 rounded-full blur-xl -ml-6 -mb-6 pointer-events-none" />

            <div className="flex items-center justify-between text-xs relative z-10">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-300" />
                <span className="font-bold tracking-wider uppercase text-[11px] text-slate-200">
                  Chadwick International
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 backdrop-blur-md text-white border border-white/20">
                Official Access Pass
              </span>
            </div>

            {/* Attendee Profile Row */}
            <div className="mt-5 flex items-center gap-4 relative z-10">
              <div className="relative">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/80 shadow-md"
                />
                {currentUser.checkedIn && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  {currentUser.fullName}
                </h2>
                <p className="text-xs text-slate-300 truncate font-medium">
                  {currentUser.title}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {currentUser.department} • {currentUser.organization}
                </p>
              </div>
            </div>

            {/* Role & Verification pill */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-medium text-slate-300">
                  {currentUser.userType === 'internal_faculty' 
                    ? 'Verified School SSO (@chadwickschool.org)' 
                    : currentUser.userType === 'internal_staff'
                    ? 'Staff & Organizer Access'
                    : 'External Guest (Authorized)'}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                UUID: {currentUser.id.slice(0, 8)}...
              </span>
            </div>

          </div>

          {/* QR Code Section */}
          <div className="p-6 bg-white space-y-4">
            
            {/* Verification Status Banner */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              currentUser.checkedIn 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                {currentUser.checkedIn ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="leading-tight font-bold">VENUE ADMISSION GRANTED</p>
                      <p className="text-[10px] text-emerald-700 font-normal">
                        Checked in at {currentUser.checkedInAt || 'Gate 1 Terminal'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="leading-tight font-bold">CHECK-IN PENDING</p>
                      <p className="text-[10px] text-amber-700 font-normal">
                        Present QR to door staff at the entrance
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Simulation Quick Toggle */}
              <button
                onClick={() => onToggleCheckIn(currentUser.id)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                title="Toggle check-in state for testing"
              >
                {currentUser.checkedIn ? 'Reset' : 'Simulate Scan'}
              </button>
            </div>

            {/* Dynamic QR Code */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200/80">
                <QRCodeSVG
                  value={qrPayload}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700 font-mono tracking-wider">
                  {currentUser.id}
                </p>
                {activeSession ? (
                  <p className="text-[11px] text-blue-700 font-semibold leading-snug">
                    Now pointing at: {activeSession.title}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Identity only — no session running. Scanning still admits you.
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Updates automatically as the day moves.
                </p>
              </div>

              <button
                onClick={handleCopyId}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
              >
                {copiedUuid ? '✓ Registration UUID Copied' : 'Copy Registration UUID'}
              </button>
            </div>

            {/* Bookmarked / Reserved Schedule Summary on Badge */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Reserved Workshop Seats:</span>
                <span className="text-slate-500 font-medium">{reservedSessions.length} sessions booked</span>
              </div>

              {reservedSessions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No workshop reservations yet. Browse the agenda to lock your seats!
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {reservedSessions.slice(0, 3).map(s => (
                    <div key={s.id} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{s.startTime}:</span>{' '}
                        <span className="text-slate-600">{s.title}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">
                        Confirmed
                      </span>
                    </div>
                  ))}
                  {reservedSessions.length > 3 && (
                    <p className="text-[11px] text-slate-400 text-center font-medium">
                      +{reservedSessions.length - 3} more bookmarked sessions
                    </p>
                  )}
                </div>
              )}
            </div>


            {/* Pre-selected meals, shown for catering staff at the counter */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-700" />
                  Meal Selections:
                </span>
                <span className="text-slate-500 font-medium">{mealSelections.length} chosen</span>
              </div>
              {mealSelections.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No meals selected yet. Choose them under Dining &amp; Meals.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {mealSelections.map(({ service, option }) => (
                    <div key={service.id} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{service.name}:</span>{' '}
                        <span className="text-slate-600">{option.label}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 border ${DIETARY_META[option.dietary].className}`}>
                        {DIETARY_META[option.dietary].short}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verified attendance — the record this badge produces */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Verified Attendance:</span>
                <span className="text-slate-500 font-medium">{attendanceRecords.length} scans</span>
              </div>
              {attendanceRecords.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No session scans recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {attendanceRecords.map(rec => {
                    const sess = sessions.find(s => s.id === rec.sessionId);
                    const tone = rec.status === 'verified'
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                      : rec.status === 'walk_in'
                        ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : 'text-amber-900 bg-amber-50 border-amber-300';
                    return (
                      <div key={rec.id} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-slate-600">{sess?.title ?? 'Unknown session'}</span>
                          <span className="text-slate-400"> · {rec.scannedAt}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 border capitalize ${tone}`}>
                          {rec.status.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Consent: does a peer scan hand over contact details */}
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={onToggleContactSharing}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer text-left ${
                  currentUser.shareContactOnScan
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {currentUser.shareContactOnScan
                  ? <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                  : <ShieldOff className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800">
                    {currentUser.shareContactOnScan ? 'Contact sharing is on' : 'Contact sharing is off'}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug">
                    {currentUser.shareContactOnScan
                      ? 'Scanning your badge shares your email and LinkedIn.'
                      : 'Your badge verifies identity only; no contact details are shared.'}
                  </div>
                </div>
              </button>
            </div>

            {/* Badge actions */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                onClick={onOpenPrintBadge}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print badge
              </button>
              <button
                onClick={onOpenDoorScanner}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <DoorOpen className="w-4 h-4" />
                Door scanner
              </button>
            </div>

          </div>

          {/* Pass Footer Barcode & Security Strip */}
          <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>CI-CONNECTS-SECURE-OIDC</span>
            <span>TOKEN: {sessionToken}</span>
            <span>CHADWICK-INTL</span>
          </div>

        </div>
      </div>

    </div>
  );
};
