import React, { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, MapPin, ArrowRight, ArrowUpRight, LogIn, Sparkles, Check,
  LayoutGrid, CalendarRange, PlayCircle, Images, Ticket, QrCode, MessagesSquare,
  FileText, Lightbulb, Compass, ChevronDown,
} from 'lucide-react';
import { EventConfig, EventCategory, eventStatus, registrationState } from '../types';
import { EventCarousel } from './EventCarousel';
import { EventCalendar } from './EventCalendar';
import { EventRecapModal } from './EventRecapModal';
import { HubFooter } from './HubFooter';
import { ConnectsStatement } from './ConnectsStatement';

interface EventsHubProps {
  events: EventConfig[];
  onOpenEvent: (slug: string) => void;
  onSignIn: () => void;
}

/**
 * The platform's front door: every event Chadwick runs across a year, past and
 * upcoming, rather than a single conference.
 *
 * Past events are given real estate rather than being archived out of sight.
 * For a school, the record of what it has already convened is the most credible
 * argument that the next one is worth attending — so past cards lead with
 * outcomes (who came, what changed) instead of a dead registration button.
 */

const CATEGORY_STYLE: Record<EventCategory, string> = {
  Conference: 'bg-blue-600 text-white',
  Symposium:  'bg-indigo-600 text-white',
  Workshop:   'bg-emerald-600 text-white',
  Community:  'bg-amber-600 text-white',
  Admissions: 'bg-slate-700 text-white',
  Student:    'bg-blue-400 text-blue-950',
};

export const EventsHub: React.FC<EventsHubProps> = ({ events, onOpenEvent, onSignIn }) => {
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [layout, setLayout] = useState<'cards' | 'calendar'>('cards');
  /** A completed event opened for its write-up, without leaving the hub. */
  const [recapEvent, setRecapEvent] = useState<EventConfig | null>(null);

  const { featured, upcoming, past, showcase } = useMemo(() => {
    const withStatus = events.map((e) => ({ e, status: eventStatus(e) }));
    const feat = withStatus.find((x) => x.e.isFeatured && x.status !== 'past')?.e ?? null;

    const up = withStatus
      .filter((x) => x.status !== 'past' && x.e.slug !== feat?.slug)
      .sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))
      .map((x) => x.e);

    // Most recent first — the newest record is the most persuasive one.
    const pa = withStatus
      .filter((x) => x.status === 'past')
      .sort((a, b) => b.e.startDate.localeCompare(a.e.startDate))
      .map((x) => x.e);

    /**
     * What the slider carries.
     *
     * The flagship leads, then everything else scheduled — including events
     * whose registration has not opened, since "coming, not yet bookable" is
     * exactly what a showcase is for. Two recent completed events with a
     * write-up trail it: for a school, what it has already run is the most
     * credible argument that the next one is worth the Saturday.
     */
    const show = [
      ...(feat ? [feat] : []),
      ...up,
      ...pa.filter((e) => e.recap).slice(0, 2),
    ];

    return { featured: feat, upcoming: up, past: pa, showcase: show };
  }, [events]);

  const categories = useMemo(() => {
    const seen: EventCategory[] = [];
    for (const e of events) if (!seen.includes(e.category)) seen.push(e.category);
    return seen;
  }, [events]);

  const show = (e: EventConfig) => filter === 'all' || e.category === filter;
  const visibleUpcoming = [...(featured ? [featured] : []), ...upcoming].filter(show);
  const openCount = upcoming.filter((e) => registrationState(e).state === 'open').length;

  const Card: React.FC<{ e: EventConfig; past?: boolean }> = ({ e, past = false }) => (
    <button
      onClick={() => (past ? setRecapEvent(e) : onOpenEvent(e.slug))}
      className="group text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-blue-600 hover:shadow-lg transition-all cursor-pointer flex flex-col"
    >
      <div className="aspect-[16/9] overflow-hidden bg-slate-100 relative">
        <img
          src={e.heroImageUrl}
          alt=""
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${past ? 'grayscale-[65%] group-hover:grayscale-0' : ''}`}
        />
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${CATEGORY_STYLE[e.category]}`}>
          {e.category}
        </span>
        {past && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 text-slate-700 backdrop-blur-sm">
            Completed
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          {e.dateLabel}
        </div>
        <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors">
          {e.name}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-3">{e.summary}</p>

        {!!e.presenters?.length && (
          <div className="text-xs text-slate-500 mb-3">
            <span className="text-slate-400">Led by </span>
            <span className="font-semibold text-slate-700">
              {e.presenters.map((pr) => pr.name).join(', ')}
            </span>
          </div>
        )}

        {past ? (
          <div className="mt-auto pt-3 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Event completed
            </div>
            {e.outcomes && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3">
                {e.outcomes.map((o) => (
                  <div key={o.label}>
                    <div className="text-base font-bold text-slate-800 leading-tight">{o.value}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{o.label}</div>
                  </div>
                ))}
              </div>
            )}
            {/* What is actually waiting behind the click, named item by item —
                "See highlights" promises less than a recording and slides do. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-blue-700">
              {e.recap?.recordingUrl && (
                <span className="flex items-center gap-1.5">
                  <PlayCircle className="w-3.5 h-3.5" /> Recording
                </span>
              )}
              {!!e.recap?.materials?.length && (
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Slides
                </span>
              )}
              {!!e.recap?.takeaways?.length && (
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Takeaways
                </span>
              )}
              {!!e.recap?.photoUrls?.length && (
                <span className="flex items-center gap-1.5">
                  <Images className="w-3.5 h-3.5" /> Photos
                </span>
              )}
              {!e.recap && (
                <span className="text-slate-400 font-normal">Write-up to come</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            {(() => {
              const reg = registrationState(e);
              if (reg.state === 'open') {
                return <span className="text-xs font-semibold text-emerald-800">Registration open</span>;
              }
              if (reg.state === 'opens_later') {
                return (
                  <span className="text-xs font-semibold text-amber-800">
                    Opens {new Date(reg.opensAt + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </span>
                );
              }
              return <span className="text-xs font-semibold text-slate-400">Registration closed</span>;
            })()}
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
          </div>
        )}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate leading-tight">CI Connects</div>
              <div className="text-[11px] text-slate-500 truncate">Chadwick International Events</div>
            </div>
          </div>
          <button
            onClick={onSignIn}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Attendee sign in</span>
            <span className="sm:hidden">Sign in</span>
          </button>
        </div>
      </header>

      <div className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-xs text-amber-900">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Sample catalogue.</strong> These events are illustrative,
            showing how a year of Chadwick events appears in CI Connects.
          </span>
        </div>
      </div>

      {/* ---------------- The platform itself ---------------- */}
      <section className="relative bg-blue-600 text-white overflow-hidden">
        {/* The flagship's imagery carries the hero, dimmed well below the type.
            A stock-photo gradient would say nothing; this says "a real place". */}
        {featured && (
          <div className="absolute inset-0">
            <img src={featured.heroImageUrl} alt="" className="w-full h-full object-cover opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-600/95 to-blue-700/90" />
        <div className="absolute -right-32 -top-32 w-[30rem] h-[30rem] rounded-full bg-blue-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-32 w-[26rem] h-[26rem] rounded-full bg-blue-200/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
            <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-7">
              <Building2 className="w-3.5 h-3.5 text-blue-200" />
              <span className="text-xs font-semibold text-blue-100 tracking-wide">
                Built by the Chadwick Technology Team, for the Chadwick community
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.06] mb-5">
              Every Chadwick event, in one place.
            </h1>

            <p className="text-lg sm:text-xl text-blue-100/90 leading-relaxed max-w-2xl mb-4">
              CI Connects is where Chadwick International announces, runs and remembers
              what it convenes — conferences, workshops, colloquia and community
              gatherings across the year.
            </p>
            <p className="text-base text-blue-100/70 leading-relaxed max-w-2xl mb-9">
              Explore any of them freely: the agenda, who is speaking, who is supporting
              it. Sign in only when you want a place at one. And when an event is over,
              the slides, the takeaways and the recordings stay here.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <button
                onClick={() => document.getElementById('coming-up')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                Explore events
              </button>
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border-2 border-white/30 text-white font-bold hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Sign in to register
              </button>
            </div>

            </div>

            {/* The name, made literal. */}
            <div className="lg:pl-4">
              <ConnectsStatement />
            </div>
          </div>

          {/* What the platform actually does, named plainly. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 pt-10 mt-12 border-t border-white/15">
              {([
                [Ticket, 'Register and reserve', 'Sessions, meals and a place at the table.'],
                [QrCode, 'A badge that scans', 'Printed lanyards, phone check-in at the door.'],
                [MessagesSquare, 'Find your colleagues', 'A directory, and a way to say hello.'],
                [FileText, 'Everything, afterwards', 'Slides, takeaways and recordings that stay put.'],
              ] as const).map(([Icon, title, body]) => (
                <div key={title}>
                  <Icon className="w-4.5 h-4.5 text-blue-200 mb-2" />
                  <div className="text-sm font-bold text-white mb-0.5">{title}</div>
                  <div className="text-xs text-blue-100/70 leading-relaxed">{body}</div>
                </div>
              ))}
          </div>
        </div>

        <ChevronDown className="relative mx-auto w-5 h-5 text-white/40 animate-bounce mb-6" />
      </section>

      {/* ---------------- Showcase ---------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="mb-6">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
            In the spotlight
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">
            {featured ? featured.name : 'Our events'}
            {featured && (
              <span className="block sm:inline text-slate-400 font-normal sm:ml-2 text-xl">
                — our new annual conference
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            {featured?.tagline
              ?? 'The gatherings worth clearing a weekend for, alongside everything else on.'}
          </p>
        </div>
        <div className="relative">
          <EventCarousel
            events={showcase}
            onOpenEvent={onOpenEvent}
            onSignIn={onSignIn}
            autoPlay
          />
        </div>
      </section>

      {/* ---------------- Coming up ---------------- */}
      <section id="coming-up" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 scroll-mt-16">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">Coming up</h2>
            <p className="text-sm text-slate-500">
              {openCount > 0
                ? `${openCount} open for registration now · ${upcoming.length} scheduled.`
                : `${upcoming.length} scheduled. Registration opens closer to each date.`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {([['cards', 'Cards', LayoutGrid], ['calendar', 'Calendar', CalendarRange]] as const).map(
              ([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setLayout(v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    layout === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
          </div>
        </div>

        {/* Filters belong to the browsable list, not to the showcase above it. */}
        {layout === 'cards' && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {(['all', ...categories] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c as 'all' | EventCategory)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  filter === c
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                }`}
              >
                {filter === c && <Check className="w-3 h-3" />}
                {c === 'all' ? 'All events' : c}
              </button>
            ))}
          </div>
        )}

        {layout === 'calendar' ? (
          <EventCalendar events={events} onOpenEvent={onOpenEvent} />
        ) : visibleUpcoming.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-10 text-center">
            Nothing scheduled in this category yet.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleUpcoming.map((e) => <Card key={e.id} e={e} />)}
          </div>
        )}
      </section>

      {/* ---------------- Past ---------------- */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">What we have convened</h2>
          <p className="text-sm text-slate-500 mb-8">
            Events already run. Open any of them for the slides, the takeaways and the
            recordings — no sign-in needed.
          </p>
          {past.filter(show).length === 0 ? (
            <p className="text-sm text-slate-400 italic py-8">
              No past events in this category.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.filter(show).map((e) => <Card key={e.id} e={e} past />)}
            </div>
          )}
        </div>
      </section>

      {recapEvent && (
        <EventRecapModal
          event={recapEvent}
          onClose={() => setRecapEvent(null)}
          onOpenEvent={onOpenEvent}
        />
      )}

      <HubFooter eventCount={events.length} />

    </div>
  );
};
