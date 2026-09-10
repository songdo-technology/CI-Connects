import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { CalendarDays, MapPin, ArrowRight, Lock, LogIn, ExternalLink, Sparkles } from 'lucide-react';
import { Event, SPONSOR_TIERS } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { isStaff, canSeeEvent } from '../lib/roles';
import { formatRange, eventPhase, daysUntil } from '../lib/time';
import { Button, Card, Chip, Empty, Notice, Spinner, Field, Input } from '../components/ui';
import { isDemo } from '../lib/firebase';
import { ConnectsOrbit, MODES } from '../components/Orbit';
import { Reveal, Marquee, useParallax, useMouseParallax, CountUp } from '../lib/motion';
import { useIntroDone } from '../components/Intro';
import { Mark } from '../components/Mark';

const usePublishedEvents = () => useWatch('events', [{ field: 'status', op: '==', value: 'published' }]);

const EventCard: React.FC<{ event: Event; big?: boolean }> = ({ event, big }) => {
  const phase = eventPhase(event.startDate, event.endDate);
  const chips = (
    <>
      {phase === 'live' && <Chip tone="green">Happening now</Chip>}
      {phase === 'upcoming' && <Chip tone={big ? 'neutral' : 'blue'} className={big ? 'bg-white/15 text-white border border-white/20' : ''}>In {daysUntil(event.startDate)} days</Chip>}
      {phase === 'past' && <Chip>Past</Chip>}
    </>
  );
  if (big) {
    return (
      <Link to={`/events/${event.slug}`} className="group relative block overflow-hidden rounded-3xl bg-ink-900 text-white min-h-[26rem] sm:min-h-[32rem] shadow-[var(--shadow-pop)] transition-transform duration-500 hover:-translate-y-1">
        <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:scale-[1.04] transition-transform duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/35 to-transparent" />
        <div className="relative h-full min-h-[26rem] sm:min-h-[32rem] flex flex-col justify-end p-7 sm:p-10">
          <div className="flex items-center gap-2 mb-3">{chips}</div>
          <h3 className="font-display font-bold tracking-[-0.03em] text-4xl sm:text-6xl leading-[0.98] max-w-3xl">{event.name}</h3>
          <p className="text-white/80 text-base sm:text-lg mt-3 max-w-xl">{event.tagline}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-5 text-sm text-white/75">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatRange(event.startDate, event.endDate)}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venueName}</span>
          </div>
          <span className="btn bg-white text-blue-700 hover:bg-blue-50 mt-7 w-fit">See the event<ArrowRight className="w-4 h-4" /></span>
        </div>
      </Link>
    );
  }
  return (
    <Link to={`/events/${event.slug}`} className="card overflow-hidden group hover:border-blue-300 transition-colors block">
      <div className="aspect-[16/9] bg-sand-200 overflow-hidden">
        <img src={event.coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">{chips}</div>
        <h3 className="font-display font-bold tracking-tight text-ink-900 leading-tight text-2xl">{event.name}</h3>
        <p className="text-ink-700 mt-2 text-sm line-clamp-2">{event.tagline}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-sm text-ink-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatRange(event.startDate, event.endDate)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venueName}</span>
        </div>
      </div>
    </Link>
  );
};

// ------------------------------------------------------------------ landing
export const Landing: React.FC = () => {
  const { items, ready } = usePublishedEvents();
  const { doc: site } = useDoc('settings', 'site');
  const { status } = useAuth();
  const introDone = useIntroDone();
  const glow = useMouseParallax(26);
  const upcoming = items.filter((e) => eventPhase(e.startDate, e.endDate) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = items.filter((e) => eventPhase(e.startDate, e.endDate) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));
  const next = upcoming[0];
  const cta = 'btn bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 text-base shadow-[var(--shadow-pop)]';
  return (
    <div>
      {/* ---------------- The hero: the brand's own world ---------------- */}
      <section className="relative overflow-hidden bg-blue-900 text-white">
        <div ref={glow} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -left-32 w-[44rem] h-[44rem] rounded-full bg-blue-500/30 blur-3xl breathe" />
          <div className="absolute -bottom-52 right-[-12%] w-[48rem] h-[48rem] rounded-full bg-blue-400/20 blur-3xl breathe" style={{ animationDelay: '-3s' }} />
        </div>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '26px 26px' }} aria-hidden="true" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vmax] h-[120vmax] rounded-full border border-white/[0.06] spin-slow pointer-events-none" aria-hidden="true" />

        {introDone ? (
          <div className="relative max-w-6xl mx-auto px-5 pt-28 pb-16 lg:pt-32 lg:pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center min-h-[92vh]">
            <div>
              <div className="eyebrow text-blue-200/80 rise">Chadwick International · Events</div>
              <h1 className="font-display font-bold tracking-[-0.03em] text-5xl sm:text-6xl lg:text-7xl leading-[1.0] mt-5 max-w-xl rise d1">
                {site?.tagline ?? "Chadwick International's events, in one place."}
              </h1>
              <p className="text-lg text-white/70 mt-6 max-w-lg rise d2">Programmes, seats, badges and the people in the room — for the conferences the school hosts and the days it opens its doors.</p>
              <div className="flex flex-wrap gap-3 mt-8 rise d3">
                {status === 'signed_in'
                  ? <Link to="/dashboard" className={cta}>Go to your dashboard<ArrowRight className="w-4 h-4" /></Link>
                  : <Link to="/signin" className={cta}><LogIn className="w-4 h-4" />Sign in with Google</Link>}
                <Link to="/events" className="btn border border-white/25 text-white hover:bg-white/10 px-6 py-3.5 text-base">All events</Link>
              </div>
              <div className="flex flex-wrap gap-x-10 gap-y-5 mt-12 rise d4">
                <div>
                  <div className="text-3xl font-display font-bold tabular-nums leading-none"><CountUp value={items.length} /></div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50 mt-2">events announced</div>
                </div>
                {next && (
                  <div>
                    <div className="text-3xl font-display font-bold tabular-nums leading-none"><CountUp value={Math.max(0, daysUntil(next.startDate))} /></div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/50 mt-2">days to {next.name}</div>
                  </div>
                )}
                <div>
                  <div className="text-3xl font-display font-bold tabular-nums leading-none"><CountUp value={4} /></div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/50 mt-2">circles of connection</div>
                </div>
              </div>
            </div>
            <div className="rise d2"><ConnectsOrbit /></div>
          </div>
        ) : <div className="min-h-[92vh]" />}

        <div className="relative border-t border-white/10">
          <Marquee className="text-blue-200/70 text-[13px] font-semibold uppercase tracking-[0.16em] py-4"
            items={[...MODES.map((m) => `CI Connects ${m.headline}`), ...(next ? [`${next.name} · ${formatRange(next.startDate, next.endDate)}`, next.venueName] : [])]} />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5">
        {!ready ? <Spinner /> : next ? (
          <Reveal className="mt-16 mb-16">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="eyebrow mb-1.5">Next up</div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink-900">The next time the doors open</h2>
              </div>
              <Link to="/events" className="text-sm font-semibold text-blue-700 hover:underline shrink-0">All events →</Link>
            </div>
            <EventCard event={next} big />
          </Reveal>
        ) : (
          <div className="mt-16 mb-16"><Empty icon={CalendarDays} title="No events announced yet" body="Published events appear here." /></div>
        )}

        {upcoming.length > 1 && (
          <section className="mb-16">
            <Reveal><div className="eyebrow mb-3">Also coming</div></Reveal>
            <Reveal stagger={0.1} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{upcoming.slice(1).map((e) => <EventCard key={e.id} event={e} />)}</Reveal>
          </section>
        )}

        <section className="mb-16">
          <Reveal><div className="eyebrow mb-1.5">How it works</div><h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-ink-900 mb-6">Three steps, no forms to fill</h2></Reveal>
          <Reveal stagger={0.12} className="grid md:grid-cols-3 gap-4">
            {[
              ['Sign in', 'With the Google account you were invited at. Nothing to create, nothing to remember.'],
              ['Get on the list', 'Organisers put you on an event. Then its programme, badge and venue open to you.'],
              ['Build your day', 'Reserve seats, join a waitlist when a room is full, and take your day to your calendar.'],
            ].map(([t, b], i) => (
              <Card key={t} className="p-6">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white inline-flex items-center justify-center font-display font-bold mb-4">{i + 1}</div>
                <div className="font-semibold text-ink-900 text-lg">{t}</div>
                <p className="text-sm text-ink-500 mt-1.5">{b}</p>
              </Card>
            ))}
          </Reveal>
        </section>

        {past.length > 0 && (
          <section className="mb-6">
            <Reveal><div className="eyebrow mb-3">Past events</div></Reveal>
            <Reveal stagger={0.1} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{past.map((e) => <EventCard key={e.id} event={e} />)}</Reveal>
          </section>
        )}
      </div>
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
      <h1 className="font-display font-bold tracking-tight text-4xl sm:text-5xl text-ink-900 mb-8 rise">Events</h1>
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
  const cover = useParallax(0.25);
  const { status, profile, invitedEventIds } = useAuth();
  const staff = isStaff(profile);
  const filters = [{ field: 'slug', op: '==' as const, value: slug }, ...(staff ? [] : [{ field: 'status', op: '==' as const, value: 'published' }])];
  const { items, ready } = useWatch('events', filters, Boolean(slug));
  const event = items[0];
  const sponsors = useWatch('sponsors', [{ field: 'eventId', op: '==', value: event?.id ?? '' }], Boolean(event));
  if (!ready) return <Spinner />;
  if (!event) return <div className="max-w-3xl mx-auto px-5 py-16"><Empty icon={CalendarDays} title="No such event" body="It may not be published yet." action={<Button variant="secondary" to="/events">All events</Button>} /></div>;
  const phase = eventPhase(event.startDate, event.endDate);
  const allowed = status === 'signed_in' && canSeeEvent(profile, event.id, invitedEventIds);
  const maps = `https://www.google.com/maps/search/${encodeURIComponent(event.venueAddress ?? event.venueName)}`;
  return (
    <div>
      <div className="relative h-[46vh] min-h-[22rem] bg-ink-900">
        <img ref={cover} src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 will-change-transform" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-5 h-full flex flex-col justify-end pb-10 text-white rise">
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
          <Reveal><p className="text-lg text-ink-700 leading-relaxed whitespace-pre-line max-w-2xl">{event.description}</p></Reveal>
          <Reveal delay={0.1}><Card className="p-6">
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
          </Card></Reveal>
          {sponsors.items.length > 0 && (
            <Reveal delay={0.15}>
              <div className="eyebrow mb-3">Supported by</div>
              <div className="flex flex-wrap gap-3">
                {[...sponsors.items].sort((a, b) => SPONSOR_TIERS.indexOf(a.tier) - SPONSOR_TIERS.indexOf(b.tier) || a.order - b.order).map((sp) => {
                  const inner = sp.logoUrl
                    ? <img src={sp.logoUrl} alt={sp.name} className="h-9 max-w-[9rem] object-contain" />
                    : <span className="font-display font-bold text-ink-900">{sp.name}</span>;
                  const cls = `card px-5 py-4 flex items-center gap-3 ${sp.tier === 'platinum' ? 'ring-1 ring-blue-200' : ''}`;
                  return sp.url ? <a key={sp.id} href={sp.url} target="_blank" rel="noreferrer" className={cls} title={sp.name}>{inner}</a> : <div key={sp.id} className={cls} title={sp.name}>{inner}</div>;
                })}
              </div>
            </Reveal>
          )}
        </div>
        <Reveal stagger={0.12} className="space-y-4">
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
        </Reveal>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ sign in
export const SignIn: React.FC = () => {
  const { status, signIn, signInWithPassword, createAccount, resetPassword, error, personas, signInAs } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/dashboard';
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [form, setForm] = useState({ email: '', password: '', name: '', org: '', title: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { if (status === 'signed_in') navigate(next, { replace: true }); }, [status, next, navigate]);
  if (status === 'signed_in') return <Navigate to={next} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setProblem(null); setNote(null);
    const email = form.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setProblem('Enter your email address.');
    if (mode === 'up') {
      if (!form.name.trim()) return setProblem('Tell us your name.');
      if (form.password.length < 8) return setProblem('Use a password of at least eight characters.');
    } else if (!form.password) return setProblem('Enter your password.');
    setBusy(true);
    try {
      if (mode === 'in') await signInWithPassword(email, form.password);
      else await createAccount({ email, password: form.password, name: form.name, org: form.org, title: form.title });
    } catch { /* shown through auth.error */ } finally { setBusy(false); }
  };
  const forgot = async () => {
    setProblem(null); setNote(null);
    const email = form.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setProblem('Enter your email above first, then tap Forgot password.');
    try { await resetPassword(email); setNote(`A reset link is on its way to ${email}.`); } catch { /* shown through auth.error */ }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <Card className="p-8 rise">
        <Mark size={44} className="mb-4" />
        <h1 className="text-2xl font-display font-bold text-ink-900">{mode === 'in' ? 'Sign in' : 'Create an account'}</h1>
        <p className="text-sm text-ink-500 mt-1.5">
          {mode === 'in' ? 'With the address you were invited at.' : 'For guests without a Chadwick account. Chadwick staff sign in with Google below.'}
        </p>
        {(problem || error) && <Notice tone="error" className="mt-4">{problem ?? error}</Notice>}
        {note && <Notice tone="success" className="mt-4">{note}</Notice>}

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
          {mode === 'up' && (
            <Field label="Name"><Input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your full name" /></Field>
          )}
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@school.org" /></Field>
          <Field label="Password"><Input type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder={mode === 'up' ? 'At least eight characters' : ''} /></Field>
          {mode === 'up' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="School or organisation"><Input value={form.org} onChange={set('org')} autoComplete="organization" placeholder="Dwight School Seoul" /></Field>
              <Field label="Role or title"><Input value={form.title} onChange={set('title')} autoComplete="organization-title" placeholder="Teacher" /></Field>
            </div>
          )}
          <Button type="submit" busy={busy} className="w-full mt-2 py-3">{mode === 'in' ? 'Sign in' : 'Create account'}</Button>
          {mode === 'in' && (
            <div className="text-right"><button type="button" onClick={() => void forgot()} className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2">Forgot password?</button></div>
          )}
        </form>

        <div className="flex items-center gap-3 my-5 text-[11px] uppercase tracking-[0.14em] text-ink-300"><span className="flex-1 h-px bg-sand-200" />or<span className="flex-1 h-px bg-sand-200" /></div>

        {isDemo ? (
          <div className="space-y-2">
            <div className="eyebrow">Demo build — pick who you are</div>
            {personas.map((p) => (
              <button key={p.id} onClick={() => signInAs(p.id)} className="w-full text-left card p-3 hover:border-blue-300 transition-colors">
                <div className="font-semibold text-ink-900 text-sm">{p.name}</div>
                <div className="text-xs text-ink-500">{p.email} · {p.role}{p.eventAccess.length ? ` · on ${p.eventAccess.length} list` : ''}</div>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => void signIn()} disabled={status === 'loading'} className="btn-secondary w-full py-3">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.7 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.2 13.6 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.4 0-11.8-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
            Sign in with Google
          </button>
        )}

        <p className="text-sm text-ink-500 text-center mt-6">
          {mode === 'in'
            ? <>New here? <button type="button" onClick={() => { setMode('up'); setProblem(null); }} className="font-semibold text-blue-700 hover:underline">Create an account</button></>
            : <>Already have one? <button type="button" onClick={() => { setMode('in'); setProblem(null); }} className="font-semibold text-blue-700 hover:underline">Sign in</button></>}
        </p>
      </Card>
    </div>
  );
};
