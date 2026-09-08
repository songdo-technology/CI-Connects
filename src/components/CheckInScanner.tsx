import React, { useState } from 'react';
import { 
  X, 
  Scan, 
  CheckCircle2, 
  Search, 
  UserCheck, 
  AlertCircle, 
  Users, 
  History, 
  Sparkles,
  Volume2
} from 'lucide-react';
import { UserProfile } from '../types';

interface CheckInScannerProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  onCheckInUser: (userId: string) => void;
}

export const CheckInScanner: React.FC<CheckInScannerProps> = ({
  isOpen,
  onClose,
  profiles,
  onCheckInUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentScans, setRecentScans] = useState<{ user: UserProfile; time: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [scannedFeedback, setScannedFeedback] = useState<UserProfile | null>(null);

  if (!isOpen) return null;

  const totalAttendees = profiles.length;
  const checkedInCount = profiles.filter(p => p.checkedIn).length;
  const checkInPercent = Math.round((checkedInCount / totalAttendees) * 100);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Ignore if browser restricts audio
    }
  };

  const handleScanAction = (user: UserProfile) => {
    onCheckInUser(user.id);
    playBeep();
    setScannedFeedback(user);
    setRecentScans(prev => [
      { user, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
      ...prev.slice(0, 4)
    ]);
    setTimeout(() => {
      setScannedFeedback(null);
    }, 3000);
  };

  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.organization.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Staff Door Terminal & QR Scanner</h2>
              <p className="text-xs text-slate-500">Live attendee admission verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Bar */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Checked-in Status:</span>
            <span className="font-bold text-blue-600">{checkedInCount} / {totalAttendees} ({checkInPercent}%)</span>
          </div>
          <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${checkInPercent}%` }}
            />
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5">
          
          {/* Viewfinder simulation */}
          <div className="bg-slate-950 rounded-2xl p-6 text-white text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            {/* Viewfinder borders */}
            <div className="relative w-48 h-48 border-2 border-dashed border-blue-400/60 rounded-2xl flex items-center justify-center p-3">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400" />

              {/* Animated Laser line */}
              <div className="absolute inset-x-2 h-0.5 bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-pulse pointer-events-none" />

              <div className="text-center space-y-1">
                <Scan className="w-8 h-8 text-blue-300 mx-auto animate-bounce opacity-80" />
                <p className="text-xs font-semibold text-slate-200">Point Camera at Attendee QR</p>
                <p className="text-[10px] text-slate-400">or click any attendee below to simulate</p>
              </div>
            </div>

            {scannedFeedback && (
              <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-150">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                <h3 className="text-base font-bold text-white">Admit: {scannedFeedback.fullName}</h3>
                <p className="text-xs text-emerald-200">{scannedFeedback.organization} • {scannedFeedback.department}</p>
                <span className="mt-2 text-[10px] font-mono bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded">
                  ✓ VERIFIED ON-SITE
                </span>
              </div>
            )}
          </div>

          {/* Quick Roster Scan List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quick Attendee List (Click to Scan & Admit)
              </h3>
              <span className="text-[11px] text-slate-500">
                {filteredProfiles.length} attendees
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee by name, email, or dept..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto divide-y divide-slate-100 pr-1">
              {filteredProfiles.map(profile => (
                <div 
                  key={profile.id}
                  onClick={() => handleScanAction(profile)}
                  className={`pt-2 pb-1 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl cursor-pointer transition-colors ${
                    profile.checkedIn ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{profile.fullName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{profile.title} • {profile.department}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {profile.checkedIn ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Checked In
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                        <Scan className="w-3 h-3 text-blue-600" />
                        Scan & Admit
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Log */}
          {recentScans.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <History className="w-3 h-3" />
                <span>Recent Gate Check-ins:</span>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                {recentScans.map((scan, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg">
                    <span className="font-semibold text-slate-800">{scan.user.fullName}</span>
                    <span className="text-[11px] text-slate-400">{scan.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            Audio beep feedback active
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-black transition-colors cursor-pointer"
          >
            Close Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
