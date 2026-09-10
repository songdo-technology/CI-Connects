import React, { useState } from 'react';
import {
  ShieldCheck, Building2, BellRing, LogOut, LayoutDashboard, CalendarDays,
} from 'lucide-react';
import { can, ROLE_LABEL } from '../lib/permissions';
import { BroadcastAnnouncement, UserProfile, UserRole } from '../types';

interface HeaderProps {
  currentUser: UserProfile;
  /** Which event this portal belongs to — the header's main line, because
   *  the same chrome on top of two conferences otherwise reads as one. */
  eventName: string;
  eventDateLabel: string;
  announcements: BroadcastAnnouncement[];
  onSignOut: () => void;
  /** The person's own dashboard: the organiser's, or their learning record. */
  onOpenHome: () => void;
  onOpenAdmin: () => void;
  realRole: UserRole;
  previewRole: UserRole | null;
  onPreviewRole: (role: UserRole | null) => void;
}

/**
 * The top of one event's portal: which event, who you are, and the way up.
 *
 * Navigation between the portal's panes lives in the rail beside the content
 * (PortalNav), not here — eleven tabs in one row was the prototype's shape.
 */
export const Header: React.FC<HeaderProps> = ({
  currentUser, eventName, eventDateLabel, announcements, onSignOut, onOpenHome, onOpenAdmin,
  realRole, previewRole, onPreviewRole,
}) => {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const activeAnnouncement = announcements.find(a => a.active);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {activeAnnouncement && !bannerDismissed && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center justify-between">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Which event */}
          <button
            onClick={onOpenHome}
            title="Your dashboard"
            className="flex items-center gap-3 min-w-0 text-left rounded-xl hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 flex items-center justify-center text-white shadow-md shadow-slate-900/10 shrink-0">
              <Building2 className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 leading-none">
                CI Connects
              </div>
              <div className="flex items-baseline gap-2 min-w-0 mt-1">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate leading-tight">
                  {eventName}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                  <CalendarDays className="w-3.5 h-3.5" /> {eventDateLabel}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
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
              onClick={onSignOut}
              title="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign out</span>
            </button>

            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-full object-cover border border-slate-300 ring-1 ring-white"
              />
              <div className="hidden sm:block max-w-[140px]">
                <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                  {currentUser.preferredName || currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-500 truncate leading-tight">
                  {ROLE_LABEL[currentUser.role]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
