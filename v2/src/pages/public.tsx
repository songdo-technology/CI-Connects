import React, { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { CalendarDays, MapPin, ArrowRight, Lock, LogIn, ExternalLink, Sparkles } from 'lucide-react';
import { Event } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { isStaff, canSeeEvent } from '../lib/roles';
import { formatRange, eventPhase, daysUntil } from '../lib/time';
import { Button, Card, Chip, Empty, Notice, Spinner } from '../components/ui';
import { isDemo } from '../lib/firebase';

const usePublishedEvents = () => useWatch('events', [{ field: 'status', op: '==', value: 'published' }]);

const EventCard: React.FC<{ event: Event; big?: boolean }> = ({ event, big }) => {
  const phase = eventPhase(event.startDate, event.endDate);
  return (
    <Link to={`/events/${event.slug}`} className={`card overflow-hidden group hover:border-blue-300 transition-colors ${big ? 'grid md:grid-cols-2' : ''}`}>
      <div className={`${big ? 'aspect-[4/3] md:aspect-auto md:h-full' : 'aspect-[16/9]'} bg-sand-200 overflow-hidden`}>
        <img src={event.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
      </div>
      <div className={`p-5 ${big ? 'md:p-8 flex flex-col justify-center' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          {phase === 'live' && <Chip tone="green">Happening now</Chip>}
          {phase === 'upcoming' && <Chip tone="blue">In {daysUntil(event.startDate)} days</Chip>}
          {phase === 'past' && <Chip>Past</Chip>}
        </div>
        <h3 className={`font-display text-ink-900 leading-tight ${big ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>{event.name}</h3>
        <p className={`text-ink-700 mt-2 ${big ? 'text-base' : 'text-sm line-clamp-2'}`}>{event.tagline}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-sm text-ink-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatRange(event.startDate, event.endDate)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venueName}</span>
        </div>
        {big && <span className="btn-primary mt-6 w-fit">See the event<ArrowRight className="w-4 h-4" /></span>}
      </div>
    </Link>
  );
};

// ------------------------------------------------------------------ landing
export const Landing: React.FC = () => {
  const { items, ready } = usePublishedEvents();
  const { doc: site } = useDoc('settings', 'site');
  const { status } = useAuth();
  const upcoming = items.filter((e) => eventPhase(e.startDate, e.endDate) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = items.filter((e) => eventPhase(e.startDate, e.endDate) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));
  const next = upcoming[0];
  return (
    <div className="max-w-6xl mx-auto px-5">
      <section className="pt-14 pb-10 sm:pt-20 sm:pb-14">
        <div className="eyebrow mb-4">Chadwick International · Events</div>
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] text-ink-900 max-w-3xl">
          {site?.tagline ?? "Chadwick International's events, in one place."}
        </h1>
        <p className="text-lg text-ink-700 mt-5 max-w-xl">Programmes, seats, badges and the people in the room — for conferences the school hosts and the days it opens its doors.</p>
        <div className="flex flex-wrap gap-3 mt-7">
          {status === 'signed_in'
            ? <Button to="/dashboard">Go to your dashboard<ArrowRight className="w-4 h-4" /></Button>
            : <Button to="/signin"><LogIn className="w-4 h-4" />Sign in with Google</Button>}
          <Button variant="secondary" to="/events">All events</Button>
        </div>
      </section>

      {!ready ? <Spinner /> : next ? (
        <section className="mb-14">
          <div className="eyebrow mb-3">Next up</div>
          <EventCard event={next} big />
        </section>
      ) : (
        <Empty icon={CalendarDays} title="No events announced yet" body="Published events appear here." />
      )}

      {upcoming.length > 1 && (
        <section className="mb-14">
          <div className="eyebrow mb-3">Also coming</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{upcoming.slice(1).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}

      <section className="mb-14 grid md:grid-cols-3 gap-4">
        {[
          ['Sign in', 'With the Google account you were invited at. Nothing to create, nothing to remember.'],
          ['Get on the list', 'Organisers put you on an event. Then its programme, badge and venue open to you.'],
          ['Build your day', 'Reserve seats, join a waitlist when a room is full, and take your day to your calendar.'],
        ].map(([t, b], i) => (
          <Card key={t} className="p-5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center font-bold text-sm mb-3">{i + 1}</div>
            <div className="font-semibold text-ink-900">{t}</div>
            <p className="text-sm text-ink-500 mt-1">{b}</p>
          </Card>
        ))}
      </section>

      {past.length > 0 && (
        <section className="mb-6">
          <div className="eyebrow mb-3">Past events</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{past.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ index
export const EventsIndex: React.FC = () => {
  const { items, ready } = usePublishedEvents();
  const upcoming = items.filter((e) => eventPhase(e.startDate, e.endDate) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = items.filter((e) => eventPhase(e.startDate, e.endDate) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl sm:text-5xl text-ink-900 mb-8">Events</h1>
      {!ready ? <Spinner /> : items.length === 0 ? <Empty icon={CalendarDays} title="No events announced yet" /> : (
        <div className="space-y-12">
          {upcoming.length > 0 && <section><div className="eyebrow mb-3">Upcoming</div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div></section>}
          {past.length > 0 && <section><div className="eyebrow mb-3">Past</div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{past.map((e) => <EventCard key={e.id} event={e} />)}</div></section>}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ one event, public
export const EventPublic: React.FC = () => {
  const { slug } = useParams();
  const { status, profile, invitedEventIds } = useAuth();
  const staff = isStaff(profile);
  const filters = [{ field: 'slug', op: '==' as const, value: slug }, ...(staff ? [] : [{ field: 'status', op: '==' as const, value: 'published' }])];
  const { items, ready } = useWatch('events', filters, Boolean(slug));
  const event = items[0];
  if (!ready) return <Spinner />;
  if (!event) return <div className="max-w-3xl mx-auto px-5 py-16"><Empty icon={CalendarDays} title="No such event" body="It may not be published yet." action={<Button variant="secondary" to="/events">All events</Button>} /></div>;
  const phase = eventPhase(event.startDate, event.endDate);
  const allowed = status === 'signed_in' && canSeeEvent(profile, event.id, invitedEventIds);
  const maps = `https://www.google.com/maps/search/${encodeURIComponent(event.venueAddress ?? event.venueName)}`;
  return (
    <div>
      <div className="relative h-[46vh] min-h-[22rem] bg-ink-900">
        <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-5 h-full flex flex-col justify-end pb-10 text-white">
          <div className="flex items-center gap-2 mb-3">
            {event.status === 'draft' && <Chip tone="amber">Draft — only organisers see this</Chip>}
            {phase === 'live' && <Chip tone="green">Happening now</Chip>}
            {phase === 'upcoming' && <Chip tone="blue">In {daysUntil(event.startDate)} days</Chip>}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-none">{event.name}</h1>
          <p className="text-lg text-white/85 mt-3 max-w-2xl">{event.tagline}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatRange(event.startDate, event.endDate)}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venueName}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-10 grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-10">
        <div className="space-y-8">
          <p className="text-lg text-ink-700 leading-relaxed whitespace-pre-line max-w-2xl">{event.description}</p>
          <Card className="p-6">
            {allowed ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="font-semibold text-ink-900 inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-400" />You are on the list</div>
                  <p className="text-sm text-ink-500 mt-1">The programme, your day, speakers, venue and your badge are open.</p>
                </div>
                <Button to={`/e/${event.slug}/schedule`}>Open the programme<ArrowRight className="w-4 h-4" /></Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="font-semibold text-ink-900 inline-flex items-center gap-2"><Lock className="w-4 h-4 text-ink-500" />The programme is for listed participants</div>
                  <p className="text-sm text-ink-500 mt-1">
                    {status === 'signed_in'
                      ? 'Your account is not on this event\'s list. Ask the organisers, and check you signed in with the address they invited.'
                      : 'Sign in with the Google account you were invited at, and it opens.'}
                  </p>
                </div>
                {status !== 'signed_in' && <Button to={`/signin?next=${encodeURIComponent(`/events/${event.slug}`)}`}><LogIn className="w-4 h-4" />Sign in</Button>}
              </div>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="eyebrow mb-2">When</div>
            <div className="font-semibold text-ink-900">{formatRange(event.startDate, event.endDate)}</div>
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-2">Where</div>
            <div className="font-semibold text-ink-900">{event.venueName}</div>
            {event.venueAddress && <p className="text-sm text-ink-500 mt-1">{event.venueAddress}</p>}
            <a href={maps} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-3"><ExternalLink className="w-3.5 h-3.5" />Open in Maps</a>
          </Card>
        </aside>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ sign in
export const SignIn: React.FC = () => {
  const { status, signIn, error, personas, signInAs } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/dashboard';
  useEffect(() => { if (status === 'signed_in') navigate(next, { replace: true }); }, [status, next, navigate]);
  if (status === 'signed_in') return <Navigate to={next} replace />;
  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Card className="p-8">
        <div className="eyebrow mb-2">CI Connects</div>
        <h1 className="text-2xl font-bold text-ink-900">Sign in</h1>
        <p className="text-sm text-ink-500 mt-2">Use the Google account you were invited at — a Chadwick account or any other.</p>
        {error && <Notice tone="error" className="mt-4">{error}</Notice>}
        {isDemo ? (
          <div className="mt-6 space-y-2">
            <div className="eyebrow">Demo build — pick who you are</div>
            {personas.map((p) => (
              <button key={p.id} onClick={() => signInAs(p.id)} className="w-full text-left card p-3 hover:border-blue-300 transition-colors">
                <div className="font-semibold text-ink-900 text-sm">{p.name}</div>
                <div className="text-xs text-ink-500">{p.email} · {p.role}{p.eventAccess.length ? ` · on ${p.eventAccess.length} list` : ''}</div>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => void signIn()} disabled={status === 'loading'} className="btn-primary w-full mt-6">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.7 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.2 13.6 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.4 0-11.8-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
            Continue with Google
          </button>
        )}
      </Card>
    </div>
  );
};
