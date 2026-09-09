import React, { useState } from 'react';
import { Calendar, QrCode, Users, MessageSquare, Award, ShieldCheck, Smartphone, Monitor, Layers, ChevronDown, Building2, BellRing, CheckCircle2, Sparkles, ExternalLink, UtensilsCrossed, Send, LogOut, Globe, Sun, UserRound } from 'lucide-react';
import { can, ROLE_LABEL } from '../lib/permissions';
import { ActiveTab, BroadcastAnnouncement, UserProfile } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  deviceMode: 'desktop' | 'mobile';
  setDeviceMode: (mode: 'desktop' | 'mobile') => void;
  announcements: BroadcastAnnouncement[];
  onOpenArchitecture: () => void;
  bookmarkedCount: number;
  unreadMessageCount: number;
  onSignOut: () => void;
  onViewPublicPage: () => void;
  onOpenAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  unreadMessageCount,
  onSignOut,
  onViewPublicPage,
  onOpenAdmin,
  currentUser,
  allUsers,
  onSwitchUser,
  deviceMode,
  setDeviceMode,
  announcements,
  onOpenArchitecture,
  bookmarkedCount,
}) => {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const activeAnnouncement = announcements.find(a => a.active);

  const getRoleBadge = (user: UserProfile) => {
    switch (user.userType) {
      case 'internal_faculty':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            School Faculty SSO
          </span>
        );
      case 'internal_staff':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-600" />
            Organizer / Staff SSO
          </span>
        );
      case 'external_guest':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <ExternalLink className="w-3 h-3 text-amber-600" />
            External Guest (Magic Link)
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            Student Ambassador
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Utility Bar: Live Announcements */}
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

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand & Event Identity */}
          <button
            onClick={onViewPublicPage}
            title="Back to the public event page"
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
              <p className="text-xs text-slate-500 truncate">
                The Chadwick International Event Management Platform
              </p>
            </div>
          </button>

          {/* Prototype Controls: View Mode & Persona Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* View Mode Toggle: Website vs App */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 hidden sm:flex items-center text-xs font-medium text-slate-600">
              <button
                id="toggle-desktop-view"
                onClick={() => setDeviceMode('desktop')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  deviceMode === 'desktop'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View as responsive Desktop Website"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Web Platform</span>
              </button>
              <button
                id="toggle-mobile-view"
                onClick={() => setDeviceMode('mobile')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  deviceMode === 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View in Mobile PWA Simulator frame"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile App</span>
              </button>
            </div>

            {/* Administration — platform-level, distinct from the Organizer
                Console, which is about running an event in progress. */}
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

            {/* Return to the public-facing event site */}
            <button
              onClick={onViewPublicPage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              title="Back to the public event page"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Event Page</span>
            </button>

            {/* Architecture Blueprint Button */}
            <button
              id="open-architecture-specs"
              onClick={onOpenArchitecture}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>System Specs</span>
            </button>

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <button
                id="persona-switcher-button"
                onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-left cursor-pointer"
              >
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
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Persona Dropdown Menu */}
              {showPersonaMenu && (
                <div 
                  className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setShowPersonaMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Switch Role & Identity (Demo Simulation)
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Test Google Workspace SSO, external guest magic links, and organizer permissions.
                    </p>
                  </div>

                  <div className="max-h-72 overflow-y-auto py-1 divide-y divide-slate-100">
                    {allUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          onSwitchUser(user);
                          setShowPersonaMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          currentUser.id === user.id ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName}
                          className="w-8 h-8 rounded-full object-cover mt-0.5 border border-slate-200"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {user.fullName}
                            </span>
                            {currentUser.id === user.id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {user.title} • {user.organization}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {getRoleBadge(user)}
                            <span className="text-[10px] text-slate-400 font-mono">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Active Domain Auth:</span>
                    <span className="font-semibold text-slate-700">
                      {currentUser.email.includes('@chadwickschool.org') ? 'chadwickschool.org (SSO)' : 'External Realm'}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs (Desktop View) */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">
          
          <button
            id="tab-agenda"
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'agenda'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Interactive Agenda</span>
            {bookmarkedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                {bookmarkedCount}
              </span>
            )}
          </button>

          <button
            id="tab-badge"
            onClick={() => setActiveTab('badge')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'badge'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Digital Badge & Pass</span>
            {currentUser.checkedIn && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Checked In" />
            )}
          </button>

          <button
            id="tab-dining"
            onClick={() => setActiveTab('dining')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'dining'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-emerald-700" />
            <span>Dining & Meals</span>
          </button>

          <button
            id="tab-community"
            onClick={() => setActiveTab('community')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'community'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>Community Board & Meetups</span>
          </button>

          <button
            id="tab-directory"
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Users className="w-4 h-4 text-amber-600" />
            <span>Colleague Directory</span>
          </button>

          <button
            id="tab-messages"
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Send className="w-4 h-4 text-blue-600" />
            <span>Messages</span>
            {unreadMessageCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                {unreadMessageCount}
              </span>
            )}
          </button>

          <button
            id="tab-profile"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <UserRound className="w-4 h-4 text-slate-500" />
            <span>My Profile</span>
          </button>

          <button
            id="tab-feedback"
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'feedback'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Glows &amp; Grows</span>
          </button>

          <button
            id="tab-luckydraw"
            onClick={() => setActiveTab('luckydraw')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'luckydraw'
                ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Lucky Draw Wheel</span>
          </button>

          <button
            id="tab-admin"
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ml-auto cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 bg-slate-200/60 hover:bg-slate-200'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Organizer Console & CSV</span>
            {can(currentUser, 'events:edit_own') && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400/20 text-amber-300 font-bold uppercase tracking-wider">
                Admin
              </span>
            )}
          </button>

          <button
            onClick={onSignOut}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-700 hover:bg-slate-100/80 whitespace-nowrap transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>

        </div>
      </div>
    </header>
  );
};
