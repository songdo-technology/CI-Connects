import React, { useState } from 'react';
import {
  Calendar, QrCode, Users, MessageSquare, ShieldCheck, Building2, BellRing, Sparkles,
  UtensilsCrossed, Send, LogOut, Sun, UserRound, LayoutGrid, Presentation, Radio,
  LayoutDashboard,
} from 'lucide-react';
import { can, ROLE_LABEL } from '../lib/permissions';
import { ActiveTab, BroadcastAnnouncement, UserProfile, UserRole } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  /** Which event this portal belongs to, said plainly. The same chrome on top
   *  of two different conferences otherwise reads as one product. */
  eventName: string;
  announcements: BroadcastAnnouncement[];
  bookmarkedCount: number;
  unreadMessageCount: number;
  /** How many profile fields other people can see are still empty. */
  profileGapCount: number;
  onSignOut: () => void;
  /** All events — the public catalogue. */
  onGoHome: () => void;
  /** The person's own dashboard: the organiser's, or their learning record. */
  onOpenHome: () => void;
  onOpenAdmin: () => void;
  realRole: UserRole;
  previewRole: UserRole | null;
  onPreviewRole: (role: UserRole | null) => void;
}

const tabClass = (active: boolean, tone = 'text-blue-700') =>
  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
    active
      ? `bg-white ${tone} shadow-xs border border-slate-200`
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
  }`;

/** A count, not a bare dot: "3" is a job you can size before opening it,
 *  where a dot only says "something, somewhere". */
const Count: React.FC<{ n: number; tone?: string }> = ({ n, tone = 'bg-blue-100 text-blue-700' }) =>
  n > 0
    ? <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tone}`}>{n}</span>
    : null;

/**
 * The chrome of one event's portal.
 *
 * Two ways out and one way up: All events (the public catalogue), Sign out,
 * and Dashboard — the person's own home, which is also where the brand mark
 * goes. The organiser's Admin sits beside them. Nothing here is a demo
 * control any more: the phone-frame toggle, the architecture blueprint and
 * the "switch identity" menu were the prototype's, not the product's.
 */
export const Header: React.FC<HeaderProps> = ({
  activeTab, setActiveTab, currentUser, eventName, announcements, bookmarkedCount,
  unreadMessageCount, profileGapCount, onSignOut, onGoHome, onOpenHome, onOpenAdmin,
  realRole, previewRole, onPreviewRole,
}) => {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const activeAnnouncement = announcements.find(a => a.active);
  /** Presenters and the people who run the event write sessions. */
  const mayPropose = currentUser.role === 'speaker' || can(currentUser, 'sessions:edit_any');
  /** Announcements, signage, capacity, feedback: the people running it. */
  const mayOperate = can(currentUser, 'announcements:send');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Live announcement */}
      {activeAnnouncement && !bannerDismissed && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <BellRing className="w-4 h-4 shrink-0 animate-pulse text-slate-950" />
            <span className="font-bold uppercase tracking-wider text-[11px] bg-black/15 px-2 py-0.5 rounded">
              {activeAnnouncement.title}
            </span>
            <span className="truncate">{activeAnnouncement.message}</span>
            <span className="text-slate-900/80 text-xs hidden md:inline ml-auto">({activeAnnouncement.timestamp})</span>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-slate-900/80 hover:text-black text-xs underline font-semibold ml-2 cursor-pointer"
            title="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}

      {previewRole && (
        <div className="bg-amber-500 text-amber-950 px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4 text-xs font-semibold">
          <span>
            Viewing as <strong>{ROLE_LABEL[previewRole]}</strong>. Your real role is{' '}
            {ROLE_LABEL[realRole]} — this changes only what you see, not what you may do.
          </span>
          <button
            onClick={() => onPreviewRole(null)}
            className="shrink-0 px-3 py-1 rounded-lg bg-amber-950/15 hover:bg-amber-950/25 transition-colors cursor-pointer"
          >
            Exit preview
          </button>
        </div>
      )}

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Brand, and the event this portal is for */}
          <button
            onClick={onOpenHome}
            title="Your dashboard"
            className="flex items-center gap-3 min-w-0 text-left rounded-xl hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 flex items-center justify-center text-white shadow-md shadow-slate-900/10 shrink-0">
              <Building2 className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                  CI Connects
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Chadwick International
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">{eventName}</p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {realRole === 'technical_admin' && (
              <select
                value={previewRole ?? ''}
                onChange={(e) => onPreviewRole((e.target.value || null) as UserRole | null)}
                title="See the app as another role"
                className="hidden lg:block px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">View as: myself</option>
                {(['event_organizer', 'speaker', 'sponsor', 'front_desk', 'attendee'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>View as: {ROLE_LABEL[r]}</option>
                ))}
              </select>
            )}

            <button
              onClick={onOpenHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              title="Your dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            {/* Administration — the platform, distinct from Event operations,
                which is about running this event while it is on. */}
            {can(currentUser, 'events:create') && (
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Administration"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              title="All Chadwick events — the public catalogue"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">All events</span>
            </button>

            <button
              onClick={onSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign out</span>
            </button>

            {/* Who is signed in. A label, not a menu. */}
            <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-left">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="w-7 h-7 rounded-full object-cover border border-slate-300 ring-1 ring-white"
              />
              <div className="hidden sm:block text-left max-w-[130px]">
                <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-500 truncate leading-tight">
                  {ROLE_LABEL[currentUser.role]}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">

          <button id="tab-agenda" onClick={() => setActiveTab('agenda')} className={tabClass(activeTab === 'agenda')}>
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Interactive Agenda</span>
            <Count n={bookmarkedCount} />
          </button>

          <button id="tab-badge" onClick={() => setActiveTab('badge')} className={tabClass(activeTab === 'badge')}>
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Digital Badge &amp; Pass</span>
            {currentUser.checkedIn && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Checked in" />
            )}
          </button>

          <button id="tab-dining" onClick={() => setActiveTab('dining')} className={tabClass(activeTab === 'dining')}>
            <UtensilsCrossed className="w-4 h-4 text-emerald-700" />
            <span>Dining &amp; Meals</span>
          </button>

          <button id="tab-community" onClick={() => setActiveTab('community')} className={tabClass(activeTab === 'community')}>
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>Community Board &amp; Meetups</span>
          </button>

          <button id="tab-directory" onClick={() => setActiveTab('directory')} className={tabClass(activeTab === 'directory')}>
            <Users className="w-4 h-4 text-amber-600" />
            <span>Colleague Directory</span>
          </button>

          <button id="tab-messages" onClick={() => setActiveTab('messages')} className={tabClass(activeTab === 'messages')}>
            <Send className="w-4 h-4 text-blue-600" />
            <span>Messages</span>
            <Count n={unreadMessageCount} tone="bg-blue-600 text-white" />
          </button>

          {/* Only for people who present. An attendee has nothing to propose,
              and a tab that does nothing for most of the room is clutter. */}
          {mayPropose && (
            <button id="tab-propose" onClick={() => setActiveTab('propose')} className={tabClass(activeTab === 'propose')}>
              <Presentation className="w-4 h-4 text-slate-500" />
              <span>My Sessions</span>
            </button>
          )}

          <button id="tab-profile" onClick={() => setActiveTab('profile')} className={tabClass(activeTab === 'profile')}>
            <UserRound className="w-4 h-4 text-slate-500" />
            <span>My Profile</span>
            <Count n={profileGapCount} tone="bg-amber-500 text-white" />
          </button>

          <button id="tab-feedback" onClick={() => setActiveTab('feedback')} className={tabClass(activeTab === 'feedback')}>
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Glows &amp; Grows</span>
          </button>

          <button id="tab-luckydraw" onClick={() => setActiveTab('luckydraw')} className={tabClass(activeTab === 'luckydraw', 'text-purple-700')}>
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Lucky Draw</span>
          </button>

          {/* Running the event while it is on — announcements, capacity,
              signage, feedback. Organisers only; it was on everyone's strip. */}
          {mayOperate && (
            <button
              id="tab-admin"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ml-auto cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 bg-slate-200/60 hover:bg-slate-200'
              }`}
            >
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Event operations</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
