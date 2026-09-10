import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import {
  CalendarDays, MapPin, Search, LayoutList, LayoutGrid, Download, Users, Lock, ArrowLeft, CircleCheck, Clock, ShieldCheck, ExternalLink,
} from 'lucide-react';
import { Event, Room, Session, Track, Sponsor, SPONSOR_TIERS, SPONSOR_TIER_LABEL } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch } from '../lib/hooks';
import { isStaff, canSeeEvent } from '../lib/roles';
import { formatRange, formatDate, formatTime, eachDate, eventPhase, daysUntil, todayYmd } from '../lib/time';
import { byStart, slotsForDay, speakerIndex, overlaps, seatState } from '../lib/schedule';
import { buildIcs, downloadText } from '../lib/ics';
import { useEventData, SessionCard, RoomGrid, SessionDrawer, TrackDot } from '../components/schedule';
import { AnnouncementBar } from '../components/layouts';
import { EventWelcome } from '../components/EventWelcome';
import { PageTransition } from '../lib/motion';
import { Avatar, Button, Card, Chip, Empty, Spinner, SubNav } from '../components/ui';

interface EventCtx { event: Event; sessions: Session[]; rooms: Room[]; tracks: Track[]; sponsors: Sponsor[]; mine: Session[]; base: string }
const useEvent = () => useOutletContext<EventCtx>();

/** Resolves a slug to an event the viewer may read. Members query only
 *  published events, which is what the rules can prove. */
function useEventBySlug(slug: string | undefined) {
  const { profile } = useAuth();
  const staff = isStaff(profile);
  const filters = [{ field: 'slug', op: '==' as const, value: slug }, ...(staff ? [] : [{ field: 'status', op: '==' as const, value: 'published' }])];
  const { items, ready } = useWatch('events', filters, Boolean(slug));
  return { event: items[0] ?? null, ready };
}

export const EventLayout: React.FC = () => {
  const { slug } = useParams();
  const { profile, user, invitedEventIds } = useAuth();
  const { event, ready } = useEventBySlug(slug);
  const allowed = event ? canSeeEvent(profile, event.id, invitedEventIds) : false;
  const data = useEventData(allowed && event ? event.id : null);
  // The threshold, every time this event is arrived at from outside.
  const [welcome, setWelcome] = useState(true);
  useEffect(() => { setWelcome(true); }, [slug]);
  if (!ready) return <Spinner />;
  if (!event) return <Navigate to="/dashboard" replace />;
  const base = `/e/${event.slug}`;
  const phase = eventPhase(event.startDate, event.endDate);

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <Link to="/dashboard" className="btn-ghost btn-sm mb-6"><ArrowLeft className="w-4 h-4" />Dashboard</Link>
        <Card className="p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-sand-100 border border-sand-200 inline-flex items-center justify-center mb-4"><Lock className="w-5 h-5 text-ink-500" /></div>
          <h1 className="text-xl font-bold text-ink-900">{event.name} is for listed participants</h1>
          <p className="text-sm text-ink-500 mt-2">An organiser adds people to this event. If you expected to be on the list, ask them — and check that you signed in with the address they invited.</p>
        </Card>
      </div>
    );
  }

  const mine = data.sessions.filter((s) => user && s.reservedUserIds.includes(user.uid)).sort(byStart);
  const ctx: EventCtx = { event, sessions: data.sessions, rooms: data.rooms, tracks: data.tracks, sponsors: data.sponsors, mine, base };

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 lg:py-8">
      {welcome && profile && data.ready && (
        <EventWelcome event={event} profile={profile} isStaff={isStaff(profile)} sessionCount={data.sessions.length}
          roomCount={data.rooms.length} reservedCount={mine.length} onDone={() => setWelcome(false)} />
      )}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Link to="/dashboard" className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Dashboard</Link>
              {phase === 'live' && <Chip tone="green">Happening now</Chip>}
              {phase === 'upcoming' && <Chip tone="blue">In {daysUntil(event.startDate)} days</Chip>}
              {phase === 'past' && <Chip>Past event</Chip>}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl text-ink-900 leading-none">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-ink-700">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-ink-300" />{formatRange(event.startDate, event.endDate)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-ink-300" />{event.venueName}</span>
            </div>
          </div>
          {isStaff(profile) && (
            <Link to={`/admin/events/${event.id}/schedule`} className="btn-secondary btn-sm shrink-0"><ShieldCheck className="w-3.5 h-3.5" />Manage</Link>
          )}
        </div>
        <SubNav items={[
          { to: `${base}/schedule`, label: 'Programme' },
          { to: `${base}/mine`, label: `My day${mine.length ? ` · ${mine.length}` : ''}` },
          { to: `${base}/speakers`, label: 'Speakers' },
          { to: `${base}/venue`, label: 'Venue' },
          ...(data.sponsors.length > 0 ? [{ to: `${base}/sponsors`, label: 'Sponsors' }] : []),
          { to: `${base}/badge`, label: 'Badge' },
        ]} />
      </div>
      <AnnouncementBar eventId={event.id} />
      {!data.ready ? <Spinner /> : <PageTransition><Outlet context={ctx} /></PageTransition>}
    </div>
  );
};

// ------------------------------------------------------------------ programme
export const SchedulePage: React.FC = () => {
  const { event, sessions, rooms, tracks, sponsors, mine, base } = useEvent();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const dates = eachDate(event.startDate, event.endDate);
  const [day, setDay] = useState(() => (dates.includes(todayYmd()) ? todayYmd() : dates[0]));
  const [view, setView] = useState<'list' | 'rooms'>('list');
  const [q, setQ] = useState('');
  const [track, setTrack] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const visible = useMemo(() => sessions.filter((s) =>
    s.date === day
    && (!track || s.trackId === track)
    && (!onlyMine || (user && s.reservedUserIds.includes(user.uid)))
    && (!q || `${s.title} ${s.abstract} ${s.speakers.map((x) => x.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  ).sort(byStart), [sessions, day, track, onlyMine, q, user]);

  const slots = slotsForDay(visible, day);
  const open = sessions.find((s) => s.id === sessionId) ?? null;
  const schedulePath = `${base}/schedule`;

  return (
    <div>
      <div className="card p-3 sm:p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {dates.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg bg-sand-100 p-1">
              {dates.map((d, i) => (
                <button key={d} onClick={() => setDay(d)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${day === d ? 'bg-white text-blue-700 shadow-[var(--shadow-card)]' : 'text-ink-500 hover:text-ink-900'}`}>
                  Day {i + 1} · {formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions, speakers" className="input pl-9 py-2" />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-sand-100 p-1">
            <button onClick={() => setView('list')} className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${view === 'list' ? 'bg-white text-blue-700 shadow-[var(--shadow-card)]' : 'text-ink-500'}`}><LayoutList className="w-3.5 h-3.5" />List</button>
            <button onClick={() => setView('rooms')} className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${view === 'rooms' ? 'bg-white text-blue-700 shadow-[var(--shadow-card)]' : 'text-ink-500'}`}><LayoutGrid className="w-3.5 h-3.5" />Rooms</button>
          </div>
        </div>
        {(tracks.length > 0 || mine.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setTrack(null)} className={`chip ${!track ? 'bg-blue-600 text-white' : 'bg-white border border-sand-200 text-ink-700'}`}>All tracks</button>
            {tracks.map((t) => (
              <button key={t.id} onClick={() => setTrack(track === t.id ? null : t.id)} className={`chip ${track === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-sand-200 text-ink-700'}`}>
                <TrackDot track={t} />{t.name}
              </button>
            ))}
            {mine.length > 0 && (
              <button onClick={() => setOnlyMine((v) => !v)} className={`chip ml-auto ${onlyMine ? 'bg-emerald-600 text-white' : 'bg-white border border-sand-200 text-ink-700'}`}>Only my day</button>
            )}
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <Empty icon={CalendarDays} title="The programme is not published yet" body="Sessions appear here as the organisers add them." />
      ) : visible.length === 0 ? (
        <Empty icon={Search} title="Nothing matches" body="Try another track, day or search." />
      ) : view === 'rooms' ? (
        <RoomGrid sessions={visible} rooms={rooms} tracks={tracks} basePath={schedulePath} />
      ) : (
        <div className="space-y-6">
          {slots.map((slot) => (
            <div key={slot.start} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
              <div className="pt-4 text-sm font-semibold text-ink-900 tabular-nums leading-tight">
                {formatTime(slot.start)}
                <div className="text-[11px] text-ink-500 font-normal">to {formatTime(slot.end)}</div>
              </div>
              <div className="space-y-3">
                {slot.sessions.map((s) => (
                  <SessionCard key={s.id} session={s} room={rooms.find((r) => r.id === s.roomId)} track={tracks.find((t) => t.id === s.trackId)} sponsor={sponsors.find((x) => x.id === s.sponsorId)} to={`${schedulePath}/${s.id}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <SessionDrawer event={event} session={open} rooms={rooms} tracks={tracks} sponsors={sponsors} mine={mine} onClose={() => navigate(schedulePath)} />
    </div>
  );
};

// ------------------------------------------------------------------ my day
export const MySchedulePage: React.FC = () => {
  const { event, rooms, tracks, mine, base } = useEvent();
  const { user } = useAuth();
  const waiting = useEvent().sessions.filter((s) => user && s.waitlistUserIds.includes(user.uid)).sort(byStart);
  if (mine.length === 0 && waiting.length === 0) {
    return <Empty icon={CalendarDays} title="Nothing on your day yet" body="Reserve seats from the programme and they gather here, in order, with the gaps between them." action={<Button to={`${base}/schedule`}>Browse the programme</Button>} />;
  }
  const dates = [...new Set(mine.map((s) => s.date))];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">{mine.length} on your day{waiting.length ? `, ${waiting.length} waitlisted` : ''}.</p>
        <Button variant="secondary" size="sm" onClick={() => downloadText(`${event.slug}-my-day.ics`, buildIcs(event, mine, rooms))}><Download className="w-3.5 h-3.5" />Add to calendar</Button>
      </div>
      {dates.map((d) => (
        <div key={d}>
          {dates.length > 1 && <div className="eyebrow mb-2">{formatDate(d)}</div>}
          <div className="space-y-3">
            {mine.filter((s) => s.date === d).map((s, i, arr) => {
              const clash = arr.some((o) => o.id !== s.id && overlaps(o, s));
              return (
                <div key={s.id}>
                  <SessionCard session={s} room={rooms.find((r) => r.id === s.roomId)} track={tracks.find((t) => t.id === s.trackId)} to={`${base}/schedule/${s.id}`} />
                  {clash && <p className="text-xs text-amber-800 mt-1 ml-1">Overlaps with another session on your day.</p>}
                  {i < arr.length - 1 && <div className="text-[11px] text-ink-300 text-center py-1">· · ·</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {waiting.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Waiting for a seat</div>
          <div className="space-y-3">
            {waiting.map((s) => <SessionCard key={s.id} session={s} room={rooms.find((r) => r.id === s.roomId)} track={tracks.find((t) => t.id === s.trackId)} to={`${base}/schedule/${s.id}`} />)}
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ speakers
export const SpeakersPage: React.FC = () => {
  const { sessions, base } = useEvent();
  const speakers = speakerIndex(sessions);
  if (speakers.length === 0) return <Empty icon={Users} title="Speakers are being confirmed" body="They appear here as sessions are given presenters." />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {speakers.map((sp) => (
        <Card key={sp.name} className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={sp.name} size={40} />
            <div className="min-w-0">
              <div className="font-semibold text-ink-900 truncate">{sp.name}</div>
              {(sp.title || sp.org) && <div className="text-xs text-ink-500 truncate">{[sp.title, sp.org].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {sp.sessions.map((s) => (
              <li key={s.id}><Link to={`${base}/schedule/${s.id}`} className="text-sm text-blue-700 hover:underline">{s.title}</Link><span className="text-xs text-ink-500"> · {formatTime(s.start)}</span></li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ venue
export const VenuePage: React.FC = () => {
  const { event, rooms, sessions } = useEvent();
  const maps = `https://www.google.com/maps/search/${encodeURIComponent(event.venueAddress ?? event.venueName)}`;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-5">
      <div className="space-y-3">
        {rooms.map((r) => {
          const n = sessions.filter((s) => s.roomId === r.id).length;
          return (
            <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-ink-900">{r.name}</div>
                <div className="text-xs text-ink-500">{[r.location, r.capacity ? `${r.capacity} seats` : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="text-xs text-ink-500 tabular-nums">{n} session{n === 1 ? '' : 's'}</div>
            </Card>
          );
        })}
        {rooms.length === 0 && <Empty icon={MapPin} title="Rooms are being confirmed" />}
      </div>
      <Card className="p-5 h-fit">
        <div className="eyebrow mb-2">Getting here</div>
        <div className="font-semibold text-ink-900">{event.venueName}</div>
        {event.venueAddress && <p className="text-sm text-ink-700 mt-1">{event.venueAddress}</p>}
        <a href={maps} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-4"><ExternalLink className="w-3.5 h-3.5" />Open in Maps</a>
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------ sponsors
export const SponsorsPage: React.FC = () => {
  const { sponsors } = useEvent();
  if (sponsors.length === 0) return <Empty icon={Users} title="No sponsors listed yet" />;
  return (
    <div className="space-y-8">
      {SPONSOR_TIERS.map((tier) => {
        const list = sponsors.filter((s) => s.tier === tier);
        if (list.length === 0) return null;
        return (
          <section key={tier}>
            <div className="eyebrow mb-3">{SPONSOR_TIER_LABEL[tier]}</div>
            <div className={`grid gap-4 ${tier === 'platinum' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {list.map((s) => {
                const body = (
                  <>
                    <div className={`flex items-center justify-center bg-sand-50 border-b border-sand-200 ${tier === 'platinum' ? 'h-32' : 'h-24'}`}>
                      {s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="max-h-[60%] max-w-[70%] object-contain" /> : <span className="font-display font-bold text-2xl text-ink-900">{s.name}</span>}
                    </div>
                    <div className="p-4">
                      <div className="font-semibold text-ink-900">{s.name}</div>
                      {s.blurb && <p className="text-sm text-ink-500 mt-1">{s.blurb}</p>}
                      {s.url && <div className="text-xs text-blue-700 mt-2 inline-flex items-center gap-1">Visit<ExternalLink className="w-3 h-3" /></div>}
                    </div>
                  </>
                );
                return s.url
                  ? <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="card overflow-hidden block">{body}</a>
                  : <Card key={s.id} className="overflow-hidden">{body}</Card>;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ badge
export const BadgePage: React.FC = () => {
  const { event, sessions } = useEvent();
  const { user, profile } = useAuth();
  const attendance = useWatch('attendance', [{ field: 'eventId', op: '==', value: event.id }, { field: 'userId', op: '==', value: user?.uid ?? '' }], Boolean(user));
  const arrived = attendance.items.find((a) => a.sessionId === null);
  if (!user || !profile) return null;
  return (
    <div className="max-w-sm mx-auto">
      <Card className="p-6 text-center">
        <div className="eyebrow mb-1">{event.name}</div>
        <div className="text-xs text-ink-500 mb-5">{formatRange(event.startDate, event.endDate)}</div>
        <div className="inline-block p-3 bg-white rounded-xl border border-sand-200">
          <QRCodeSVG value={`ci2:${user.uid}`} size={196} level="M" />
        </div>
        <div className="mt-5 text-xl font-bold text-ink-900">{profile.name}</div>
        {(profile.title || profile.org) && <div className="text-sm text-ink-500">{[profile.title, profile.org].filter(Boolean).join(' · ')}</div>}
        <div className="mt-5">
          {arrived
            ? <Chip tone="green"><CircleCheck className="w-3.5 h-3.5" />Checked in {new Date(arrived.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Chip>
            : <Chip><Clock className="w-3.5 h-3.5" />Show this at the desk</Chip>}
        </div>
      </Card>
      {attendance.items.some((a) => a.sessionId) && (
        <Card className="p-4 mt-4">
          <div className="eyebrow mb-2">Sessions you were at</div>
          <ul className="space-y-1.5">
            {attendance.items.filter((a) => a.sessionId).map((a) => {
              const s = sessions.find((x) => x.id === a.sessionId);
              return <li key={a.id} className="text-sm flex items-center gap-2"><CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /><span className="text-ink-900">{s?.title ?? a.sessionId}</span><span className="text-xs text-ink-500 ml-auto">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>;
            })}
          </ul>
        </Card>
      )}
      <p className="text-xs text-ink-500 text-center mt-3">Your badge works from any phone signed in as you.</p>
    </div>
  );
};

// keep the import used for type-only consumers
export type { EventCtx };
void seatState;
