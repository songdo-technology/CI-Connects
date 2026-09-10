import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard, CalendarDays, UserRound, ShieldCheck, LogOut, Menu, X, Eye, Megaphone,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { isStaff, isAdmin } from '../lib/roles';
import { Role, ROLE_LABEL } from '../lib/types';
import { Avatar, Spinner } from './ui';

// ------------------------------------------------------------------ public
export const PublicLayout: React.FC = () => {
  const { status } = useAuth();
  const { doc: site } = useDoc('settings', 'site');
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-sand-100/90 backdrop-blur border-b border-sand-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center font-bold text-sm">CI</span>
            <span className="leading-tight">
              <span className="block font-semibold text-ink-900">{site?.name ?? 'CI Connects'}</span>
              <span className="block text-[11px] text-ink-500">Chadwick International</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/events" className={({ isActive }) => `btn-ghost btn-sm ${isActive ? 'text-ink-900 bg-sand-200/70' : ''}`}>Events</NavLink>
            {status === 'signed_in'
              ? <Link to="/dashboard" className="btn-primary btn-sm">Dashboard</Link>
              : <Link to="/signin" className="btn-primary btn-sm">Sign in</Link>}
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-sand-200 mt-16">
        <div className="max-w-6xl mx-auto px-5 py-8 text-xs text-ink-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>{site?.name ?? 'CI Connects'} · Chadwick International</span>
          {site?.contactEmail && <a className="hover:text-ink-900" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>}
        </div>
      </footer>
    </div>
  );
};

// ------------------------------------------------------------------ guards
export const RequireAuth: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { status, profile, error } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <Spinner label="Signing you in" />;
  if (status === 'signed_out') {
    return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}${error ? '&error=1' : ''}`} replace />;
  }
  if (!profile) return <Spinner label="Preparing your profile" />;
  return <>{children ?? <Outlet />}</>;
};

export const RequireStaff: React.FC = () => {
  const { profile } = useAuth();
  if (!isStaff(profile)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export const RequireAdmin: React.FC = () => {
  const { profile } = useAuth();
  if (!isAdmin(profile)) return <Navigate to="/admin" replace />;
  return <Outlet />;
};

// ------------------------------------------------------------------ app shell
const NavItem: React.FC<{ to: string; icon: React.ElementType; end?: boolean; children: React.ReactNode; onClick?: () => void }> =
  ({ to, icon: Icon, end, children, onClick }) => (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive ? 'bg-white text-blue-700 font-semibold shadow-[var(--shadow-card)] border border-sand-200' : 'text-ink-700 hover:bg-white/70 hover:text-ink-900'}`}>
      {({ isActive }) => (<><Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-ink-300'}`} />{children}</>)}
    </NavLink>
  );

export const AppShell: React.FC = () => {
  const { profile, realProfile, signOut, viewAs, setViewAs } = useAuth();
  const [open, setOpen] = useState(false);
  const { doc: site } = useDoc('settings', 'site');
  const staff = isStaff(profile);
  const close = () => setOpen(false);

  const nav = (
    <nav className="space-y-5">
      <div>
        <div className="eyebrow px-3 mb-1.5">You</div>
        <div className="space-y-0.5">
          <NavItem to="/dashboard" icon={LayoutDashboard} onClick={close}>Dashboard</NavItem>
          <NavItem to="/events" icon={CalendarDays} onClick={close}>All events</NavItem>
          <NavItem to="/me" icon={UserRound} onClick={close}>Profile</NavItem>
        </div>
      </div>
      {staff && (
        <div>
          <div className="eyebrow px-3 mb-1.5">Manage</div>
          <div className="space-y-0.5">
            <NavItem to="/admin" icon={ShieldCheck} onClick={close}>Administration</NavItem>
            {isAdmin(profile) && <NavItem to="/admin/announcements" icon={Megaphone} onClick={close}>Announcements</NavItem>}
          </div>
        </div>
      )}
    </nav>
  );

  const account = (
    <div className="space-y-3">
      {realProfile?.role === 'admin' && (
        <label className="block">
          <span className="eyebrow px-3 mb-1.5 flex items-center gap-1"><Eye className="w-3 h-3" /> View as</span>
          <select value={viewAs ?? ''} onChange={(e) => setViewAs((e.target.value || null) as Role | null)} className="input text-xs py-1.5">
            <option value="">Myself (administrator)</option>
            <option value="schedule_admin">Schedule admin</option>
            <option value="user">Member</option>
          </select>
        </label>
      )}
      {profile && (
        <div className="flex items-center gap-2.5 px-2">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink-900 truncate">{profile.name}</div>
            <div className="text-[11px] text-ink-500 truncate">{ROLE_LABEL[profile.role]}</div>
          </div>
          <button onClick={() => void signOut()} className="btn-ghost btn-sm" title="Sign out" aria-label="Sign out"><LogOut className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (wide) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-sand-200 bg-sand-50 px-4 py-5 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-2 mb-7">
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center font-bold text-sm">CI</span>
          <span className="leading-tight">
            <span className="block font-semibold text-ink-900">{site?.name ?? 'CI Connects'}</span>
            <span className="block text-[11px] text-ink-500">Chadwick International</span>
          </span>
        </Link>
        <div className="flex-1">{nav}</div>
        <div className="pt-4 border-t border-sand-200">{account}</div>
      </aside>

      {/* Top bar (narrow) */}
      <div className="lg:hidden sticky top-0 z-40 bg-sand-100/90 backdrop-blur border-b border-sand-200">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-blue-600 text-white inline-flex items-center justify-center font-bold text-xs">CI</span>
            <span className="font-semibold text-ink-900">{site?.name ?? 'CI Connects'}</span>
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="btn-ghost btn-sm" aria-label="Menu">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
        {open && <div className="px-4 pb-4 space-y-4 border-t border-sand-200 bg-sand-50">{nav}{account}</div>}
      </div>

      <main className="flex-1 min-w-0"><Outlet /></main>
    </div>
  );
};

/** Live announcements for one event, or the whole platform. */
export const AnnouncementBar: React.FC<{ eventId: string | null }> = ({ eventId }) => {
  const forEvent = useWatch('announcements', eventId ? [{ field: 'eventId', op: '==', value: eventId }] : [], Boolean(eventId));
  const global = useWatch('announcements', [{ field: 'eventId', op: '==', value: null }]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const active = [...forEvent.items, ...global.items].filter((a) => a.active && !dismissed.includes(a.id))
    .sort((a, b) => (a.level === 'urgent' ? -1 : 1) - (b.level === 'urgent' ? -1 : 1));
  if (active.length === 0) return null;
  return (
    <div className="space-y-2 mb-5">
      {active.map((a) => (
        <div key={a.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${a.level === 'urgent' ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
          <Megaphone className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0"><span className="font-semibold">{a.title}</span>{a.body && <span> — {a.body}</span>}</div>
          <button onClick={() => setDismissed((d) => [...d, a.id])} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      ))}
    </div>
  );
};
