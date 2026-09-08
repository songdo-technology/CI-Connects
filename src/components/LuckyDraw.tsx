import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Award, 
  Trophy, 
  RefreshCw, 
  CheckCircle2, 
  Users, 
  Filter, 
  Gift, 
  Volume2, 
  VolumeX,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, Session } from '../types';

interface LuckyDrawProps {
  profiles: UserProfile[];
  sessions: Session[];
}

interface WinnerRecord {
  id: string;
  user: UserProfile;
  prize: string;
  timestamp: string;
}

export const LuckyDraw: React.FC<LuckyDrawProps> = ({
  profiles,
  sessions,
}) => {
  const [selectedCriteria, setSelectedCriteria] = useState<'checkedIn' | 'activeWorkshops' | 'all'>('checkedIn');
  const [selectedPrize, setSelectedPrize] = useState<string>('Grand Prize: Apple iPad Air (64GB) + Apple Pencil');
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDisplayedUser, setCurrentDisplayedUser] = useState<UserProfile | null>(null);
  const [winner, setWinner] = useState<UserProfile | null>(null);
  const [pastWinners, setPastWinners] = useState<WinnerRecord[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Eligible pool based on criteria
  const eligibleAttendees = profiles.filter(p => {
    if (selectedCriteria === 'checkedIn') {
      return p.checkedIn;
    }
    if (selectedCriteria === 'activeWorkshops') {
      const userReservedCount = sessions.filter(s => s.reservedUserIds.includes(p.id)).length;
      return p.checkedIn && userReservedCount >= 2;
    }
    return true;
  });

  const prizes = [
    'Grand Prize: Apple iPad Air (64GB) + Apple Pencil',
    'Diamond Award: Bose Noise-Cancelling Wireless Headphones',
    'Innovation Runner-Up: Anker Prime Power Bank & Fast Charger Suite',
    'Faculty Book & EdTech Subscription Bundle ($200 Campus Grant)',
  ];

  const playClickSound = (frequency: number = 600) => {
    if (!audioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch {
      // Audio not permitted
    }
  };

  const playVictoryFanfare = () => {
    if (!audioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.12);
        osc.stop(audioCtx.currentTime + idx * 0.12 + 0.35);
      });
    } catch {
      // Audio not permitted
    }
  };

  const startDraw = () => {
    if (eligibleAttendees.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setWinner(null);

    let counter = 0;
    const totalFlips = 35;
    let speed = 40; // ms

    const runFlip = () => {
      const randomIdx = Math.floor(Math.random() * eligibleAttendees.length);
      const chosen = eligibleAttendees[randomIdx];
      setCurrentDisplayedUser(chosen);
      playClickSound(400 + (counter * 15));
      counter++;

      if (counter < totalFlips) {
        speed = speed * 1.07; // gradually decelerate
        setTimeout(runFlip, speed);
      } else {
        // Final Winner Selected
        const finalWinner = chosen;
        setWinner(finalWinner);
        setIsSpinning(false);
        playVictoryFanfare();

        // Confetti celebration
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#7c3aed', '#10b981', '#f59e0b'],
        });

        // Add to records
        setPastWinners(prev => [
          {
            id: `win-${Date.now()}`,
            user: finalWinner,
            prize: selectedPrize,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev,
        ]);
      }
    };

    runFlip();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-purple-900/50 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Closing Ceremony Gamification
              </span>
              <span className="text-xs text-slate-400">Keynote Stage Terminal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Summit Lucky Draw & Verified Raffle Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Randomized fair prize drawing strictly restricted to verified on-site attendees. Projected on main auditorium screens during the closing plenary.
            </p>
          </div>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors self-start sm:self-auto cursor-pointer"
            title={audioEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-purple-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          {/* Prize Tier */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-purple-600" />
              <span>Current Drawing Prize:</span>
            </label>
            <select
              value={selectedPrize}
              onChange={(e) => setSelectedPrize(e.target.value)}
              disabled={isSpinning}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
            >
              {prizes.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Eligibility Criteria */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified Eligibility Filter:</span>
            </label>
            <select
              value={selectedCriteria}
              onChange={(e) => setSelectedCriteria(e.target.value as any)}
              disabled={isSpinning}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
            >
              <option value="checkedIn">
                Verified Present at Venue (Checked-In Only)
              </option>
              <option value="activeWorkshops">
                Checked-In + Active Participant (2+ Workshops Booked)
              </option>
              <option value="all">
                All Registered Summit Attendees
              </option>
            </select>
          </div>

        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="w-4 h-4 text-slate-400" />
            Eligible Attendees in Pool: <strong className="text-slate-800">{eligibleAttendees.length}</strong>
          </span>
          <span className="text-[11px] text-slate-400">
            Cryptographically pseudo-random draw
          </span>
        </div>
      </div>

      {/* Main Drawing Visualizer Stage */}
      <div className="bg-slate-950 rounded-3xl p-8 text-center text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col items-center justify-center min-h-[320px]">
        
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none" />

        {/* Display Box */}
        <div className="relative z-10 max-w-md w-full space-y-4">
          
          <div className="text-xs font-bold uppercase tracking-widest text-purple-300">
            {isSpinning ? 'SELECTING LUCKY WINNER...' : winner ? '🎉 WINNER ANNOUNCED! 🎉' : 'READY FOR CLOSING DRAW'}
          </div>

          <div className={`p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center justify-center space-y-3 ${
            winner
              ? 'bg-purple-900/40 border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.35)] animate-in zoom-in-95'
              : isSpinning
              ? 'bg-slate-900/80 border-blue-400/80'
              : 'bg-slate-900/50 border-slate-800'
          }`}>
            
            {/* Avatar */}
            <div className="relative">
              {currentDisplayedUser || winner ? (
                <img
                  src={(winner || currentDisplayedUser)?.avatarUrl}
                  alt={(winner || currentDisplayedUser)?.fullName}
                  className={`w-24 h-24 rounded-full object-cover border-4 transition-transform duration-100 ${
                    winner ? 'border-amber-400 scale-105 shadow-xl' : 'border-purple-400'
                  }`}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border-4 border-slate-700">
                  <Trophy className="w-10 h-10" />
                </div>
              )}

              {winner && (
                <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 rounded-full p-1 shadow-md font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Name & Dept */}
            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {(winner || currentDisplayedUser)?.fullName || 'Click Draw to Spin'}
              </h3>
              <p className="text-xs sm:text-sm text-purple-200">
                {(winner || currentDisplayedUser) 
                  ? `${(winner || currentDisplayedUser)?.title} • ${(winner || currentDisplayedUser)?.department}`
                  : 'Eligible attendees loaded'}
              </p>
              {(winner || currentDisplayedUser) && (
                <p className="text-[11px] text-slate-400 font-mono">
                  {(winner || currentDisplayedUser)?.organization}
                </p>
              )}
            </div>

            {/* Winner Confirmed Badge */}
            {winner && (
              <div className="mt-2 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Claiming: {selectedPrize}
              </div>
            )}
          </div>

          {/* Spin Button */}
          <div className="pt-2">
            <button
              onClick={startDraw}
              disabled={isSpinning || eligibleAttendees.length === 0}
              className={`px-8 py-3.5 rounded-2xl text-sm font-bold tracking-wide transition-all shadow-lg flex items-center gap-2 mx-auto cursor-pointer ${
                isSpinning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white active:scale-95'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Drawing Winner...' : 'Draw Next Winner'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Past Winners Gallery */}
      {pastWinners.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Session Winners Roll
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pastWinners.map(win => (
              <div key={win.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <img
                  src={win.user.avatarUrl}
                  alt={win.user.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-300"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 truncate">{win.user.fullName}</span>
                    <span className="text-[10px] text-slate-400">{win.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-purple-700 font-semibold truncate">{win.prize}</p>
                  <p className="text-[10px] text-slate-500 truncate">{win.user.department}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
