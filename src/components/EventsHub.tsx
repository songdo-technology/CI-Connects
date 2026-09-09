import React, { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, MapPin, ArrowRight, ArrowUpRight, LogIn, Sparkles, Check,
  LayoutGrid, CalendarRange, PlayCircle, Images,
} from 'lucide-react';
import { EventConfig, EventCategory, eventStatus, registrationState } from '../types';
import { EventCarousel } from './EventCarousel';
import { EventCalendar } from './EventCalendar';

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

  const { featured, upcoming, past } = useMemo(() => {
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

    return { featured: feat, upcoming: up, past: pa };
  }, [events]);

  const categories = useMemo(() => {
    const seen: EventCategory[] = [];
    for (const e of events) if (!seen.includes(e.category)) seen.push(e.category);
    return seen;
  }, [events]);

  const show = (e: EventConfig) => filter === 'all' || e.category === filter;

  const Card: React.FC<{ e: EventConfig; past?: boolean }> = ({ e, past = false }) => (
    <button
      onClick={() => onOpenEvent(e.slug)}
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
            {(e.recap?.recordingUrl || e.recap?.photoUrls?.length) && (
              <div className="flex items-center gap-3 text-xs font-semibold text-blue-700">
                {e.recap?.recordingUrl && (
                  <span className="flex items-center gap-1.5">
                    <PlayCircle className="w-3.5 h-3.5" /> Recording
                  </span>
                )}
                {!!e.recap?.photoUrls?.length && (
                  <span className="flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5" /> Highlights
                  </span>
                )}
              </div>
            )}
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

      {/* ---------------- Featured ---------------- */}
      {featured && (
        <section className="relative bg-blue-900 text-white overflow-hidden">
          <div className="absolute inset-0">
            <img src={featured.heroImageUrl} alt="" className="w-full h-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-blue-800/90 to-blue-950/95" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span className="text-xs font-semibold text-blue-100 tracking-wide">Our flagship gathering</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-4">
                {featured.name}
              </h1>
              <p className="text-xl sm:text-2xl text-blue-100 font-light italic leading-snug mb-6">
                {featured.tagline}
              </p>
              <p className="text-base text-blue-50/80 leading-relaxed max-w-2xl mb-8">
                {featured.summary}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-blue-100/80 mb-8">
                <span className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-200" />
                  {featured.dateLabel}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-200" />
                  {featured.venueName}
                </span>
              </div>
              <button
                onClick={() => onOpenEvent(featured.slug)}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
              >
                Explore the conference
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Filters ---------------- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Filter</span>
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
      </div>

      {/* ---------------- Open & coming up ---------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">Coming up</h2>
            <p className="text-sm text-slate-500">
              {upcoming.filter((e) => registrationState(e).state === 'open').length} open for
              registration now · {upcoming.length} scheduled.
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

        {layout === 'calendar' ? (
          <EventCalendar events={events} onOpenEvent={onOpenEvent} />
        ) : (
          <EventCarousel
            events={[...(featured ? [featured] : []), ...upcoming].filter(show)}
            onOpenEvent={onOpenEvent}
            onSignIn={onSignIn}
          />
        )}
      </section>

      {/* ---------------- Full list ---------------- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-lg font-bold text-slate-900 mb-1.5">All scheduled events</h2>
        <p className="text-sm text-slate-500 mb-6">
          Everything announced, whether or not registration has opened.
        </p>
        {upcoming.filter(show).length === 0 ? (
          <p className="text-sm text-slate-400 italic py-8">
            No upcoming events in this category.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.filter(show).map((e) => <Card key={e.id} e={e} />)}
          </div>
        )}
      </section>

      {/* ---------------- Past ---------------- */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1.5">What we have convened</h2>
          <p className="text-sm text-slate-500 mb-8">
            The record of events already run, and what came out of them.
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

      <footer className="bg-slate-900 text-slate-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-300">CI Connects</span>
            <span>·</span>
            <span>The Chadwick International Event Management Platform</span>
          </div>
          <span>{events.length} events</span>
        </div>
      </footer>
    </div>
  );
};
