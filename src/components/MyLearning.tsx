import React, { useMemo, useState } from 'react';
import {
  Building2, LogOut, Award, CalendarDays, Clock, ArrowRight, KeyRound, Check,
  Loader2, Search, MapPin, GraduationCap, FileText, PlayCircle, UserRound, Mail,
} from 'lucide-react';
import {
  EventConfig, Session, Room, UserProfile, Certificate, AttendanceRecord, Invite,
  eventStatus, registrationState,
} from '../types';
import { formatHours } from '../lib/certificates';
import { ROLE_LABEL } from '../lib/permissions';

interface MyLearningProps {
  currentUser: UserProfile;
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  certificates: Certificate[];
  attendance: AttendanceRecord[];
  invites: Invite[];
  onOpenEventPortal: (slug: string) => void;
  onOpenPublicPage: (slug: string) => void;
  onOpenHub: () => void;
  /** Rendered inside this dashboard rather than jumped to. */
  profilePanel: React.ReactNode;
  onRedeemCode: (code: string) => Promise<string | null>;
  onRequestPlace: (eventId: string) => void;
  onSignOut: () => void;
  /** Present for organisers, so their own record is not a dead end. */
  onBackToAdmin?: () => void;
}

/**
 * A person's own record.
 *
 * Everything else in the platform is organised around an event. This is
 * organised around a person: what they are booked on, what they have
 * completed, the hours they can prove, and what is worth their time next. That
 * is the difference between a conference website and somewhere professional
 * learning is actually tracked, and it is what makes an account worth having
 * to someone who is not attending anything this month.
 *
 * Completed learning leads, not upcoming events. Somebody opens this to answer
 * "what have I done and can I prove it" far more often than "what is on".
 */
export const MyLearning: React.FC<MyLearningProps> = ({
  currentUser, events, sessions, rooms, certificates, attendance, invites,
  onOpenEventPortal, onOpenPublicPage, onOpenHub, profilePanel,
  onRedeemCode, onRequestPlace, onSignOut, onBackToAdmin,
}) => {
  /**
   * Which half of their own account they are looking at.
   *
   * Editing a profile used to open the event portal, so somebody who clicked
   * "Your profile" arrived at an agenda, a badge and a dining menu belonging
   * to one conference they may not even be attending. Those are properties of
   * an event and belong inside it; a person's own record belongs here.
   */
  const [view, setView] = useState<'overview' | 'profile'>('overview');
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  const mine = useMemo(() => {
    const attendedSessionIds = new Set(
      attendance.filter((a) => a.userId === currentUser.id).map((a) => a.sessionId));

    const bookedEventIds = new Set(
      sessions.filter((s) => s.reservedUserIds.includes(currentUser.id)).map((s) => s.eventId));
    const attendedEventIds = new Set(
      sessions.filter((s) => attendedSessionIds.has(s.id)).map((s) => s.eventId));
    const certified = new Set(certificates.filter((c) => c.userId === currentUser.id)
      .map((c) => c.eventId));

    // An invitation counts as involvement: somebody who has been given a place
    // is expected at that event whether or not they have picked sessions yet,
    // and showing it only after they book would hide the thing they came to
    // find.
    const invitedTo = new Set(invites
      .filter((i) => i.email.toLowerCase() === currentUser.email.toLowerCase())
      .map((i) => i.eventId));

    // Being put on an event's list by an organiser is the plainest form of
    // involvement there is — it is the whole reason the event should be here.
    const listedOn = new Set(currentUser.eventAccess ?? []);

    const involved = new Set(
      [...bookedEventIds, ...attendedEventIds, ...certified, ...invitedTo, ...listedOn]);

    return {
      attendedSessionIds,
      upcoming: events.filter((e) => involved.has(e.id) && eventStatus(e) !== 'past')
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      past: events.filter((e) => involved.has(e.id) && eventStatus(e) === 'past')
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
      /** Open to them and not already involved in. */
      open: events.filter((e) => !involved.has(e.id) && eventStatus(e) !== 'past'
        && e.status !== 'draft' && !e.isTemplate)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    };
  }, [events, sessions, attendance, certificates, invites, currentUser.id, currentUser.email, currentUser.eventAccess]);

  /** Anything they are presenting, at any stage of the proposal pipeline. */
  const mySessions = sessions.filter(
    (s) => s.speakerIds.includes(currentUser.id) || s.proposedBy === currentUser.id);

  const myCertificates = certificates.filter(
    (c) => c.userId === currentUser.id && !c.revokedAt);
  const totalHours = myCertificates.reduce((n, c) => n + c.hours, 0);

  /** Materials from sessions they actually attended. Somebody who was in the
   *  room has a claim on the slides; a general audience does not. */
  const materials = useMemo(() => sessions
    .filter((s) => mine.attendedSessionIds.has(s.id))
    .flatMap((s) => [
      ...(s.materials ?? []).map((m) => ({ session: s, name: m.name, url: m.url, video: false })),
      ...(s.recordingUrl ? [{ session: s, name: 'Recording', url: s.recordingUrl, video: true }] : []),
    ]), [sessions, mine.attendedSessionIds]);

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true); setRedeemError(null);
    const problem = await onRedeemCode(code.trim());
    setRedeeming(false);
    if (problem) { setRedeemError(problem); return; }
    setRedeemed(true); setCode('');
    setTimeout(() => setRedeemed(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={onOpenHub} className="flex items-center gap-2.5 min-w-0 group cursor-pointer text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
              <Building2 className="w-4.5 h-4.5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-tight">CI Connects</div>
              <div className="text-[11px] text-slate-500 group-hover:text-blue-700 transition-colors">
                All Chadwick events
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {onBackToAdmin && (
              <button onClick={onBackToAdmin}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
                <span className="hidden sm:inline">Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setView(view === 'profile' ? 'overview' : 'profile')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-colors cursor-pointer ${
                      view === 'profile' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-600'
                    }`}>
              <img src={currentUser.avatarUrl} alt="" className="w-6 h-6 rounded-lg object-cover" />
              <span className="hidden sm:inline text-xs font-semibold text-slate-700">
                {currentUser.preferredName || currentUser.fullName.split(' ')[0]}
              </span>
            </button>
            <button onClick={onSignOut} title="Sign out"
                    className="p-2.5 rounded-xl border-2 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {view === 'profile' ? (
          <>
            <button onClick={() => setView('overview')}
                    className="text-xs font-semibold text-slate-500 hover:text-blue-700 cursor-pointer">
              ← Back to your learning
            </button>
            {profilePanel}
          </>
        ) : (
        <>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {currentUser.preferredName || currentUser.fullName.split(' ')[0]}’s learning
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentUser.title ? `${currentUser.title} · ` : ''}
            {currentUser.organization || ROLE_LABEL[currentUser.role]}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {([
            [GraduationCap, formatHours(totalHours), 'Hours certified'],
            [Award, String(myCertificates.length), 'Certificates'],
            [CalendarDays, String(mine.past.length), 'Events completed'],
          ] as const).map(([Icon, value, label]) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <Icon className="w-4 h-4 text-blue-600 mb-2.5" />
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-1.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ---------- Booked on ---------- */}
        {mine.upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-900 mb-3">Your events</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {mine.upcoming.map((e) => {
                const days = Math.ceil(
                  (new Date(e.startDate + 'T00:00:00').getTime() - Date.now()) / 86400000);
                const booked = sessions.filter(
                  (s) => s.eventId === e.id && s.reservedUserIds.includes(currentUser.id));
                return (
                  <button key={e.id} onClick={() => onOpenEventPortal(e.slug)}
                          className="group text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-blue-600 hover:shadow-md transition-all cursor-pointer">
                    <div className="relative aspect-[16/7] overflow-hidden bg-slate-100">
                      <img src={e.heroImageUrl} alt=""
                           className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <div className="text-base font-bold leading-tight">{e.name}</div>
                        <div className="text-[11px] text-white/85">{e.dateLabel}</div>
                      </div>
                      {days >= 0 && days <= 60 && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold text-slate-800">
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{e.venueName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {booked.length > 0
                            ? `${booked.length} session${booked.length === 1 ? '' : 's'} reserved`
                            : 'No sessions reserved yet'}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-bold text-blue-700 shrink-0">
                        Open
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Completed ---------- */}
        {mine.past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-900 mb-3">Your record</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mine.past.map((e) => {
                const cert = myCertificates.find((c) => c.eventId === e.id);
                const attended = sessions.filter(
                  (s) => s.eventId === e.id && mine.attendedSessionIds.has(s.id));
                return (
                  <button key={e.id} onClick={() => onOpenPublicPage(e.slug)}
                          className="group text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-blue-600 transition-colors cursor-pointer">
                    <div className="aspect-[16/7] overflow-hidden bg-slate-100 relative">
                      <img src={e.heroImageUrl} alt=""
                           className="w-full h-full object-cover grayscale-[55%] group-hover:grayscale-0 transition-all duration-500" />
                      {cert && (
                        <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          <Award className="w-3 h-3" />
                          {formatHours(cert.hours)} h
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-bold text-slate-900 leading-snug">{e.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{e.dateLabel}</div>
                      <div className="text-[11px] text-slate-400 mt-1.5">
                        {attended.length > 0
                          ? `${attended.length} session${attended.length === 1 ? '' : 's'} attended`
                          : cert ? 'Certified' : 'No attendance recorded'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Materials from rooms they were in ---------- */}
        {materials.length > 0 && (
          <Panel title="Slides and recordings from sessions you attended">
            {materials.map((m, i) => (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
                 className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                {m.video ? <PlayCircle className="w-4 h-4 text-blue-600 shrink-0" />
                         : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{m.session.title}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              </a>
            ))}
          </Panel>
        )}

        {/* ---------- Speakers ---------- */}
        {mySessions.length > 0 && (
          <Panel title="You are presenting">
            {mySessions.map((s) => {
              const event = events.find((e) => e.id === s.eventId);
              const label =
                s.status === 'proposed' ? 'With the organisers'
                : s.status === 'declined' ? 'Not this time'
                : s.roomId ? 'Scheduled' : 'Approved — awaiting a slot';
              return (
                <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900">{s.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {event?.name}
                      {s.roomId && ` · Day ${s.day} ${s.startTime} · ${
                        rooms.find((r) => r.id === s.roomId)?.name ?? ''}`}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    {label}
                  </span>
                </div>
              );
            })}
          </Panel>
        )}

        {/* ---------- Redeem ---------- */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Have an invitation code?</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">
            Organisers send a six-character code when a place is confirmed. Entering it
            here books you onto that event.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setRedeemError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
              placeholder="A7K2M9"
              maxLength={8}
              spellCheck={false}
              className="px-4 py-2.5 rounded-xl border border-slate-300 font-mono tracking-[0.2em] uppercase text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button onClick={redeem} disabled={redeeming || !code.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer">
              {redeeming ? <Loader2 className="w-4 h-4 animate-spin" />
                         : redeemed ? <Check className="w-4 h-4" /> : null}
              {redeemed ? 'Added' : 'Redeem'}
            </button>
          </div>
          {redeemError && (
            <p className="text-[11px] text-amber-800 mt-2 leading-relaxed">{redeemError}</p>
          )}
        </div>

        {/* ---------- What is on ---------- */}
        {mine.open.length > 0 && (
          <Panel title="Coming up you could join">
            {mine.open.slice(0, 5).map((e) => {
              const reg = registrationState(e);
              return (
                <div key={e.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900">{e.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {e.dateLabel} · {reg.state === 'open' ? 'registration open' : 'registration not yet open'}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => onOpenPublicPage(e.slug)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
                      Details
                    </button>
                    <button onClick={() => onRequestPlace(e.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer">
                      <Mail className="w-3 h-3" />
                      Ask for a place
                    </button>
                  </div>
                </div>
              );
            })}
          </Panel>
        )}

        {mine.upcoming.length === 0 && mine.past.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 mb-1">Nothing recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mb-4">
              Once you attend something it appears here with its hours and certificate.
              Browse what is coming up, or redeem an invitation code above.
            </p>
            <button onClick={onOpenHub}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer">
              Browse events
            </button>
          </div>
        )}

        <button onClick={() => setView('profile')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer text-left">
          <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800">Your profile</div>
            <div className="text-[11px] text-slate-500">
              Name, photo, organisation and the links colleagues can find you by.
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
        </>
        )}
      </div>
    </div>
  );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-200">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
    </div>
    <div className="divide-y divide-slate-100">{children}</div>
  </div>
);
