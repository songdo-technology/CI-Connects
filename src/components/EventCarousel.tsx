import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, MapPin, ArrowRight, Clock, PlayCircle,
} from 'lucide-react';
import { EventConfig, registrationState, eventStatus } from '../types';

interface EventCarouselProps {
  events: EventConfig[];
  onOpenEvent: (slug: string) => void;
  onSignIn: () => void;
}

/**
 * The sliding panel of what is bookable now and what is coming.
 *
 * Scrolling is native (scroll-snap) rather than a transform-driven carousel,
 * so a touch swipe, a trackpad, a scrollbar and the arrow keys all work
 * without any of them being implemented. The arrows drive the same scroll
 * container, so the two never disagree about where the panel is.
 */
export const EventCarousel: React.FC<EventCarouselProps> = ({ events, onOpenEvent, onSignIn }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => { el.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); };
  }, [sync, events.length]);

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // One card plus its gap, so a click always lands on a card boundary.
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (events.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {events.map((e) => {
          const reg = registrationState(e);
          const live = eventStatus(e) === 'live';
          return (
            <article
              key={e.id}
              className="snap-start shrink-0 w-[19rem] sm:w-[22rem] rounded-2xl overflow-hidden border border-slate-200 bg-white flex flex-col"
            >
              <button
                onClick={() => onOpenEvent(e.slug)}
                className="relative aspect-[16/9] overflow-hidden bg-slate-100 group cursor-pointer"
              >
                <img src={e.heroImageUrl} alt=""
                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {live && (
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Happening now
                  </span>
                )}
                {!live && reg.state === 'open' && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Registration open
                  </span>
                )}
                {reg.state === 'opens_later' && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                    Opening soon
                  </span>
                )}
              </button>

              <div className="p-5 flex flex-col flex-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  {e.category}
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2">{e.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">{e.summary}</p>

                <div className="space-y-1 text-xs text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    {e.dateLabel}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{e.venueName}</span>
                  </div>
                </div>

                <div className="mt-auto">
                  {reg.state === 'open' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={onSignIn}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Register
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenEvent(e.slug)}
                        className="px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        Agenda
                      </button>
                    </div>
                  ) : reg.state === 'opens_later' ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        Registration opens{' '}
                        {new Date(reg.opensAt + 'T00:00:00').toLocaleDateString('en-US',
                          { day: 'numeric', month: 'long' })}
                      </div>
                      <button
                        onClick={() => onOpenEvent(e.slug)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        Learn more &amp; see the schedule
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onOpenEvent(e.slug)}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      {e.recap?.recordingUrl && <PlayCircle className="w-3.5 h-3.5" />}
                      {e.recap ? 'See highlights' : 'Event details'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Arrows sit outside the track so they never cover a card's controls. */}
      {!atStart && (
        <button
          onClick={() => nudge(-1)}
          aria-label="Previous events"
          className="hidden sm:flex absolute -left-4 top-[38%] w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center hover:border-blue-600 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
      )}
      {!atEnd && (
        <button
          onClick={() => nudge(1)}
          aria-label="More events"
          className="hidden sm:flex absolute -right-4 top-[38%] w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center hover:border-blue-600 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      )}
    </div>
  );
};
