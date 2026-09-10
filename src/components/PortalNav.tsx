import React from 'react';
import {
  Calendar, QrCode, UtensilsCrossed, Users, Send, MessageSquare, Presentation, UserRound, Sun,
  Sparkles, Radio, LayoutGrid, LayoutDashboard,
} from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';
import { can } from '../lib/permissions';

interface PortalNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  bookmarkedCount: number;
  unreadMessageCount: number;
  profileGapCount: number;
  onOpenHome: () => void;
  onGoHub: () => void;
}

type Item = { tab: ActiveTab; label: string; icon: React.ElementType; badge?: number; dot?: boolean; tone?: string };
type Group = { label: string; items: Item[] };

/**
 * The portal's navigation, grouped by what a person is doing rather than
 * strung across the top in one row of eleven tabs.
 *
 * Four groups. What is on at this event; the people at it; your own things;
 * and, for the people running it, the controls — which used to sit among the
 * attendee tabs, so a lucky-draw wheel was a click away for every guest.
 */
export function portalGroups(user: UserProfile, counts: {
  bookmarked: number; unread: number; profileGaps: number;
}): Group[] {
  const mayPropose = user.role === 'speaker' || can(user, 'sessions:edit_any');
  const mayOperate = can(user, 'announcements:send');
  return [
    { label: 'This event', items: [
      { tab: 'agenda', label: 'Agenda', icon: Calendar, badge: counts.bookmarked },
      { tab: 'badge', label: 'Badge & pass', icon: QrCode, dot: user.checkedIn },
      { tab: 'dining', label: 'Dining', icon: UtensilsCrossed },
    ] },
    { label: 'People', items: [
      { tab: 'directory', label: 'Directory', icon: Users },
      { tab: 'messages', label: 'Messages', icon: Send, badge: counts.unread, tone: 'bg-blue-600 text-white' },
      { tab: 'community', label: 'Community', icon: MessageSquare },
    ] },
    { label: 'You', items: [
      ...(mayPropose ? [{ tab: 'propose' as ActiveTab, label: 'My sessions', icon: Presentation }] : []),
      { tab: 'profile', label: 'Profile', icon: UserRound, badge: counts.profileGaps, tone: 'bg-amber-500 text-white' },
      { tab: 'feedback', label: 'Glows & Grows', icon: Sun },
    ] },
    ...(mayOperate ? [{ label: 'Organiser', items: [
      { tab: 'admin' as ActiveTab, label: 'Event operations', icon: Radio },
      { tab: 'luckydraw' as ActiveTab, label: 'Lucky draw', icon: Sparkles },
    ] }] : []),
  ];
}

const Badge: React.FC<{ n?: number; dot?: boolean; tone?: string }> = ({ n, dot, tone = 'bg-blue-100 text-blue-700' }) => {
  if (n && n > 0) {
    return <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${tone}`}>{n}</span>;
  }
  if (dot) return <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" title="Checked in" />;
  return null;
};

export const PortalNav: React.FC<PortalNavProps> = ({
  activeTab, setActiveTab, currentUser, bookmarkedCount, unreadMessageCount, profileGapCount,
  onOpenHome, onGoHub,
}) => {
  const groups = portalGroups(currentUser, {
    bookmarked: bookmarkedCount, unread: unreadMessageCount, profileGaps: profileGapCount,
  });

  return (
    <>
      {/* Wide screens: a rail. */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-24 space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {g.label}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = activeTab === it.tab;
                  const Icon = it.icon;
                  return (
                    <li key={it.tab}>
                      <button
                        id={`tab-${it.tab}`}
                        onClick={() => setActiveTab(it.tab)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                          active
                            ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="truncate">{it.label}</span>
                        <Badge n={it.badge} dot={it.dot} tone={it.tone} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="pt-4 border-t border-slate-200 space-y-0.5">
            <button onClick={onOpenHome}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-colors cursor-pointer">
              <LayoutDashboard className="w-4 h-4 text-slate-400" /> Dashboard
            </button>
            <button onClick={onGoHub}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-colors cursor-pointer">
              <LayoutGrid className="w-4 h-4 text-slate-400" /> All events
            </button>
          </div>
        </div>
      </aside>

      {/* Narrow screens: one scrolling strip, same items, same order. */}
      <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 w-max">
          {groups.flatMap((g) => g.items).map((it) => {
            const active = activeTab === it.tab;
            const Icon = it.icon;
            return (
              <button key={it.tab} onClick={() => setActiveTab(it.tab)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                <Icon className="w-3.5 h-3.5" />
                {it.label}
                {it.badge ? <span className="ml-0.5 tabular-nums">{it.badge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
