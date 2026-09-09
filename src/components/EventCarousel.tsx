import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, MapPin, ArrowRight, Clock, PlayCircle,
  Pause, Play,
} from 'lucide-react';
import { EventConfig, registrationState, eventStatus } from '../types';

interface EventCarouselProps {
  events: EventConfig[];
  onOpenEvent: (slug: string) => void;
  onSignIn: () => void;
  /** Advance on its own. Off by default: a panel that moves while you are
   *  reading it is worse than one that waits. */
  autoPlay?: boolean;
}

/** How long a card holds before the panel advances. */
const AUTOPLAY_MS = 6000;

/**
 * The sliding panel of what is bookable now and what is coming.
 *
 * Scrolling is native (scroll-snap) rather than a transform-driven carousel,
 * so a touch swipe, a trackpad, a scrollbar and the arrow keys all work
 * without any of them being implemented. The arrows drive the same scroll
 * container, so the two never disagree about where the panel is.
 */
export const EventCarousel: React.FC<EventCarouselProps> = ({
  events, onOpenEvent, onSignIn, autoPlay = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Someone who has asked their system for less motion has asked for this too.
  // Read once: it is a setting, not a state that flips mid-session.
  const reducedMotion = useRef(
    typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ).current;

  const [playing, setPlaying] = useState(autoPlay && !reducedMotion);
  /** Set while the pointer is over the panel or focus is inside it. Held
   *  separately from `playing` so that leaving resumes what the user chose,
   *  rather than starting a panel they had deliberately stopped. */
  const [held, setHeld] = useState(false);

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

  const nudge = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // One card plus its gap, so a click always lands on a card boundary.
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  }, []);

  /**
   * Auto-advance.
   *
   * Held while the pointer is over the panel or focus is inside it — reading a
   * card is exactly when it must not move — and while the tab is hidden, so a
   * panel left in a background tab does not race to the end and sit there.
   * Reaching the end wraps to the start rather than stopping, since a panel
   * that quietly dies looks broken.
   */
  useEffect(() => {
    if (!playing || held || events.length < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const el = trackRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        nudge(1);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, held, events.length, nudge]);

  if (events.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocusCapture={() => setHeld(true)}
        onBlurCapture={() => setHeld(false)}
        onTouchStart={() => setHeld(true)}
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

      {/* Auto-advance is visible and stoppable. A panel that moves with no way
          to stop it is the complaint people actually have about carousels. */}
      {autoPlay && !reducedMotion && events.length > 1 && (
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause automatic scrolling' : 'Scroll automatically'}
          className="absolute -top-11 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-blue-600 transition-colors cursor-pointer"
        >
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? 'Pause' : 'Auto-scroll'}
        </button>
      )}

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
