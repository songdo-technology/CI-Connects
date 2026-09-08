import React from 'react';
import { 
  Calendar, 
  QrCode, 
  MessageSquare, 
  Users, 
  Sparkles, 
  Award, 
  Wifi, 
  Battery, 
  Signal, 
  Monitor,
  Building2
} from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';

interface MobileAppFrameProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  onExitMobile: () => void;
}

export const MobileAppFrame: React.FC<MobileAppFrameProps> = ({
  children,
  activeTab,
  setActiveTab,
  currentUser,
  onExitMobile,
}) => {
  return (
    <div className="py-6 px-2 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-900/5">
      
      {/* Top Simulator Control Bar */}
      <div className="mb-4 flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-xs text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1.5 text-blue-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Mobile PWA Simulator Active
        </span>
        <span className="text-slate-300">|</span>
        <button
          onClick={onExitMobile}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Switch back to Desktop Portal</span>
        </button>
      </div>

      {/* Phone Hardware Mockup */}
      <div className="w-full max-w-[400px] h-[830px] bg-slate-950 rounded-[50px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-900/50 relative flex flex-col overflow-hidden">
        
        {/* Screen Container */}
        <div className="w-full h-full bg-slate-50 rounded-[40px] flex flex-col overflow-hidden relative">
          
          {/* iOS / Android Status Bar */}
          <div className="h-11 bg-white px-6 flex items-center justify-between text-xs font-bold text-slate-900 shrink-0 z-30 border-b border-slate-100">
            <span>9:41</span>
            
            {/* Dynamic Island Notch */}
            <div className="w-24 h-5 bg-black rounded-full mx-auto" />

            <div className="flex items-center gap-1.5 text-slate-700">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-4 h-4" />
            </div>
          </div>

          {/* App Internal Mobile Header */}
          <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs tracking-tighter">
                CI
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-900 truncate">
                  CI Events Pass
                </h2>
                <p className="text-[10px] text-slate-400 truncate">
                  {currentUser.fullName} ({currentUser.userType === 'internal_faculty' ? 'Faculty SSO' : 'Guest'})
                </p>
              </div>
            </div>

            <img
              src={currentUser.avatarUrl}
              alt={currentUser.fullName}
              className="w-7 h-7 rounded-full object-cover border border-slate-200"
            />
          </div>

          {/* Scrollable View Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 scrollbar-thin">
            {children}
          </div>

          {/* Native-Feeling Mobile Bottom Navigation Bar */}
          <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex items-center justify-around shrink-0 z-30 shadow-lg">
            
            <button
              onClick={() => setActiveTab('agenda')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'agenda' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-[10px]">Agenda</span>
            </button>

            <button
              onClick={() => setActiveTab('badge')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'badge' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span className="text-[10px]">My Pass</span>
            </button>

            <button
              onClick={() => setActiveTab('community')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'community' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px]">Meetups</span>
            </button>

            <button
              onClick={() => setActiveTab('directory')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'directory' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-[10px]">Colleagues</span>
            </button>

            <button
              onClick={() => setActiveTab('luckydraw')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'luckydraw' ? 'text-purple-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px]">Draw</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'admin' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="text-[10px]">Admin</span>
            </button>

          </div>

          {/* iOS Home Indicator Bar */}
          <div className="h-4 bg-white flex items-center justify-center shrink-0">
            <div className="w-32 h-1 bg-slate-300 rounded-full" />
          </div>

        </div>
      </div>

    </div>
  );
};
