import React, { useMemo } from 'react';
import {
  Building2, LogOut, Plus, FileSpreadsheet, Inbox, UserPlus, Settings2,
  CalendarDays, Users, Ticket, AlertTriangle, ArrowRight, Check, Eye,
  Presentation, DoorOpen, Sparkles, ScanLine,
} from 'lucide-react';
import {
  EventConfig, Session, Room, UserProfile, Invite, AttendanceRecord,
  eventStatus, registrationState,
} from '../types';
import { ROLE_LABEL } from '../lib/permissions';

interface AdminDashboardProps {
  currentUser: UserProfile;
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  users: UserProfile[];
  invites: Invite[];
  attendance: AttendanceRecord[];
  isTechnical: boolean;
  isRemote: boolean;
  onOpenAdmin: (section?: 'events-new') => void;
  onOpenEventPortal: (slug: string) => void;
  onOpenPublicPage: (slug: string) => void;
  onOpenHub: () => void;
  /** Organisers cover the gate too, especially in the first hour. */
  onOpenGate: () => void;
  onSignOut: () => void;
}

/**
 * Where an organiser lands.
 *
 * Every other surface in this platform belongs to one event, which is why
 * signing in used to put an administrator inside a sample conference: there
 * was nowhere else for them to be. Running the platform is not the same job as
 * attending an event on it, and it needs a home of its own.
 *
 * Everything here is counted from the data. Sample events are separated from
 * real ones throughout, because a dashboard that reports eleven events when
 * none of them are yours is worse than one reporting zero — it tells you the
 * work is done.
 *
 * The most valuable panel is "Needs you". A dashboard whose numbers only go up
 * is decoration; this one is trying to be a list of things that are actually
 * waiting, and to be empty when nothing is.
 */

const Tile: React.FC<{
  icon: React.ElementType; value: string; label: string; note?: string;
  tone?: 'plain' | 'good' | 'warn';
}> = ({ icon: Icon, value, label, note, tone = 'plain' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <Icon className={`w-4 h-4 mb-2.5 ${
      tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-blue-600'
    }`} />
    <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</div>
    <div className="text-xs font-semibold text-slate-600 mt-1.5">{label}</div>
    {note && <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{note}</div>}
  </div>
);

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, events, sessions, rooms, users, invites, attendance,
  isTechnical, isRemote, onOpenAdmin, onOpenEventPortal, onOpenPublicPage,
  onOpenHub, onOpenGate, onSignOut,
}) => {
  const real = events.filter((e) => !e.isTemplate);
  const samples = events.filter((e) => e.isTemplate);
  const realIds = new Set(real.map((e) => e.id));
  const realSessions = sessions.filter((s) => realIds.has(s.eventId));

  const upcoming = real
    .filter((e) => eventStatus(e) !== 'past')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = upcoming[0];
  const daysAway = next
    ? Math.ceil((new Date(next.startDate + 'T00:00:00').getTime() - Date.now()) / 86400000)
    : null;

  const reservations = realSessions.reduce((n, s) => n + s.reservedUserIds.length, 0);

  /** Everything actually waiting on somebody, with a way to go and do it. */
  const waiting = useMemo(() => {
    const items: { label: string; detail: string; go: () => void }[] = [];

    const proposed = sessions.filter((s) => s.status === 'proposed');
    if (proposed.length) {
      items.push({
        label: `${proposed.length} session proposal${proposed.length === 1 ? '' : 's'} awaiting a decision`,
        detail: proposed.slice(0, 3).map((s) => s.title).join(' · '),
        go: () => onOpenAdmin(),
      });
    }

    const unscheduled = sessions.filter((s) => s.status === 'approved' && !s.roomId);
    if (unscheduled.length) {
      items.push({
        label: `${unscheduled.length} approved session${unscheduled.length === 1 ? '' : 's'} with no room or time`,
        detail: 'Suggest a timetable from Proposals.',
        go: () => onOpenAdmin(),
      });
    }

    const drafts = real.filter((e) => e.status === 'draft');
    if (drafts.length) {
      items.push({
        label: `${drafts.length} event${drafts.length === 1 ? '' : 's'} still in draft`,
        detail: `${drafts.map((e) => e.name).join(', ')} — invisible on the public hub until published.`,
        go: () => onOpenAdmin(),
      });
    }

    // A session booked into a room that cannot hold it is a problem on the day,
    // and nothing else in the platform will surface it.
    const oversubscribed = realSessions.filter((s) => {
      const room = rooms.find((r) => r.id === s.roomId);
      return room && s.maxAttendees > room.capacity;
    });
    if (oversubscribed.length) {
      items.push({
        label: `${oversubscribed.length} session${oversubscribed.length === 1 ? '' : 's'} booked beyond the room's capacity`,
        detail: oversubscribed.slice(0, 2).map((s) => s.title).join(' · '),
        go: () => onOpenAdmin(),
      });
    }

    const unclaimed = invites.filter(
      (i) => realIds.has(i.eventId) && !users.some((u) => u.email.toLowerCase() === i.email.toLowerCase()));
    if (unclaimed.length) {
      items.push({
        label: `${unclaimed.length} invited guest${unclaimed.length === 1 ? '' : 's'} have not signed in yet`,
        detail: 'They each need the invitation text sending from Guests.',
        go: () => onOpenAdmin(),
      });
    }

    return items;
  }, [sessions, real, realSessions, rooms, invites, users, realIds, onOpenAdmin]);

  const actions = [
    { icon: Plus, label: 'New event', run: () => onOpenAdmin('events-new') },
    { icon: FileSpreadsheet, label: 'Import data', run: () => onOpenAdmin() },
    { icon: Inbox, label: 'Proposals', run: () => onOpenAdmin() },
    { icon: UserPlus, label: 'Guests', run: () => onOpenAdmin() },
    { icon: ScanLine, label: 'Open the gate scanner', run: onOpenGate },
    { icon: Settings2, label: 'Full admin panel', run: () => onOpenAdmin() },
  ];

  const EventRow: React.FC<{ e: EventConfig; sample?: boolean }> = ({ e, sample }) => {
    const mine = sessions.filter((s) => s.eventId === e.id);
    const reg = registrationState(e);
    const status = eventStatus(e);
    return (
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{e.name}</span>
            {sample && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                Sample
              </span>
            )}
            {e.status === 'draft' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                Draft
              </span>
            )}
            {status === 'live' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                Happening now
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {e.dateLabel} · {mine.length} session{mine.length === 1 ? '' : 's'}
            {' · '}
            {reg.state === 'open' ? 'registration open'
              : reg.state === 'opens_later' ? 'registration not yet open'
              : status === 'past' ? 'completed' : 'registration closed'}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onOpenPublicPage(e.slug)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            Public page
          </button>
          <button
            onClick={() => onOpenEventPortal(e.slug)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Enter
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={onOpenHub} title="All Chadwick events"
                  className="flex items-center gap-2.5 min-w-0 group cursor-pointer text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
              <Building2 className="w-4.5 h-4.5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-tight">CI Connects</div>
              <div className="text-[11px] text-slate-500 group-hover:text-blue-700 transition-colors">
                {ROLE_LABEL[currentUser.role]} · {currentUser.preferredName || currentUser.fullName}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onOpenHub}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
              Public site
            </button>
            <button onClick={onSignOut} title="Sign out"
                    className="p-2.5 rounded-xl border-2 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {next
              ? `${next.name} is ${daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `${daysAway} days away`}`
              : 'No real event scheduled yet'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {next
              ? `${next.dateLabel} · ${next.venueName}`
              : 'The catalogue below is sample content. Create an event to begin.'}
          </p>
        </div>

        {/* ---------- Quick actions ---------- */}
        <div className="flex flex-wrap gap-2">
          {actions.map(({ icon: Icon, label, run }) => (
            <button key={label} onClick={run}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ---------- Counted, not claimed ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile icon={CalendarDays} value={String(real.length)} label="Real events"
                note={samples.length ? `${samples.length} samples alongside` : undefined}
                tone={real.length ? 'plain' : 'warn'} />
          <Tile icon={Presentation} value={String(realSessions.length)} label="Sessions" />
          <Tile icon={Ticket} value={String(reservations)} label="Reservations" />
          <Tile icon={Users} value={String(users.length)} label="People" />
          <Tile icon={UserPlus} value={String(invites.length)} label="Guests invited" />
          <Tile icon={DoorOpen} value={String(rooms.length)} label="Rooms" />
        </div>

        {/* ---------- Needs you ---------- */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${waiting.length ? 'text-amber-600' : 'text-emerald-600'}`} />
            <h2 className="text-sm font-bold text-slate-900">Needs you</h2>
            {waiting.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                {waiting.length}
              </span>
            )}
          </div>
          {waiting.length === 0 ? (
            <div className="px-5 py-6 flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-slate-500">
                Nothing is waiting on you. Proposals, drafts and over-booked rooms would appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {waiting.map((w) => (
                <button key={w.label} onClick={w.go}
                        className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{w.label}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{w.detail}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Your events ---------- */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">Your events</h2>
            <button onClick={() => onOpenAdmin('events-new')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors cursor-pointer">
              <Plus className="w-3 h-3" />
              New event
            </button>
          </div>
          {real.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400 italic">
              Nothing real yet. The samples below show what an event looks like once it is set up.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {real.map((e) => <EventRow key={e.id} e={e} />)}
            </div>
          )}
        </div>

        {/* ---------- Samples, kept apart ---------- */}
        {samples.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Sample events</h2>
              <span className="text-[11px] text-slate-400">
                Illustrative. Enter one to see a fully configured event; nothing here counts as your work.
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {samples.map((e) => <EventRow key={e.id} e={e} sample />)}
            </div>
          </div>
        )}

        {isTechnical && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Platform</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
              <div>
                <div className="text-slate-400 mb-0.5">Data source</div>
                <div className={`font-semibold ${isRemote ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isRemote ? 'Firestore (live)' : 'In-memory (demo build)'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Attendance records</div>
                <div className="font-semibold text-slate-700 tabular-nums">{attendance.length}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Your role</div>
                <div className="font-semibold text-slate-700">{ROLE_LABEL[currentUser.role]}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
