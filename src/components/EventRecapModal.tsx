import React, { useEffect } from 'react';
import {
  X, PlayCircle, CalendarDays, MapPin, FileText, ExternalLink, Lightbulb,
  Images, Info,
} from 'lucide-react';
import { EventConfig } from '../types';
import { resolveVideoEmbed, needsSharingReminder } from '../lib/videoEmbed';

interface EventRecapModalProps {
  event: EventConfig;
  onClose: () => void;
  onOpenEvent: (slug: string) => void;
}

/**
 * The write-up itself, without the frame around it.
 *
 * Rendered both in the hub's modal and inline on a completed event's own page,
 * from here rather than from two copies — a recap that showed different things
 * depending on which door you came through would be the kind of bug nobody
 * reports and everybody notices.
 */
export const EventRecapBody: React.FC<{ event: EventConfig }> = ({ event }) => {
  const recap = event.recap;
  const embed = resolveVideoEmbed(recap?.recordingUrl);
  const metrics = recap?.highlights ?? event.outcomes ?? [];

  return (
    <div className="space-y-7">
      {/* ---------- Recording ---------- */}
      {embed ? (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
            <PlayCircle className="w-4 h-4 text-blue-600" />
            {recap?.recordingLabel ?? 'Watch it back'}
          </h3>
          <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
            <iframe
              src={embed.src}
              title={`${event.name} recording`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {needsSharingReminder(embed) && (
            <p className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              Hosted on Google Drive. If the player asks viewers to sign in, set the
              file's sharing to "Anyone with the link".
            </p>
          )}
        </section>
      ) : recap?.recordingUrl ? (
        // Unrecognised host: an honest link beats an empty frame.
        <a
          href={recap.recordingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-600 transition-colors text-sm font-semibold text-blue-700"
        >
          <PlayCircle className="w-4 h-4" />
          {recap.recordingLabel ?? 'Watch the recording'}
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
        </a>
      ) : null}

      {/* ---------- What happened ---------- */}
      {recap?.summary && (
        <section>
          <h3 className="text-sm font-bold text-slate-900 mb-2">What happened</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{recap.summary}</p>
        </section>
      )}

      {metrics.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-100">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
                {m.value}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">
                {m.label}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---------- Takeaways ---------- */}
      {!!recap?.takeaways?.length && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            Key takeaways
          </h3>
          <ul className="space-y-2.5">
            {recap.takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-px tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Slides & materials ---------- */}
      {!!recap?.materials?.length && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
            <FileText className="w-4 h-4 text-blue-600" />
            Slides and materials
          </h3>
          <div className="space-y-2">
            {recap.materials.map((m, i) => (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 transition-colors group"
              >
                <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 truncate">
                    {m.label}
                  </span>
                  {m.presenter && (
                    <span className="block text-[11px] text-slate-500 truncate">
                      {m.presenter}
                    </span>
                  )}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Photos ---------- */}
      {!!recap?.photoUrls?.length && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
            <Images className="w-4 h-4 text-blue-600" />
            Highlights
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {recap.photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full object-cover rounded-xl border border-slate-200"
              />
            ))}
          </div>
        </section>
      )}

      {/* Nothing recorded yet — say so plainly rather than showing a shell. */}
      {!recap?.summary && !embed && !recap?.takeaways?.length
        && !recap?.materials?.length && !recap?.photoUrls?.length && (
        <p className="text-sm text-slate-400 italic text-center py-6">
          The write-up from this event has not been published yet.
        </p>
      )}

    </div>
  );
};

/**
 * What a completed event leaves behind.
 *
 * A finished event is the most-visited kind on a school's site — people who
 * attended want the slides, and people who did not want to know what they
 * missed. Sending both to a dead landing page with a greyed-out register
 * button wastes the most valuable thing the platform holds.
 *
 * Ordered by what people came for: watch it, then read what changed, then take
 * the materials away. Sections with nothing in them are omitted rather than
 * shown empty, so a sparse recap still reads as deliberate.
 */
export const EventRecapModal: React.FC<EventRecapModalProps> = ({
  event, onClose, onOpenEvent,
}) => {
  // Escape closes, and the background does not scroll underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${event.name} — what happened`}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
        <div
          className="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ---------- Header ---------- */}
          <div className="relative">
            <div className="aspect-[21/9] overflow-hidden bg-slate-200">
              <img src={event.heroImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-slate-900/20" />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-900/60 text-white hover:bg-slate-900/80 backdrop-blur-sm transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
              <span className="inline-block px-2.5 py-1 rounded-full bg-white/20 border border-white/25 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider mb-2.5">
                Event completed
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">{event.name}</h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/80">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> {event.dateLabel}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {event.venueName}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-7">
            <EventRecapBody event={event} />

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => { onClose(); onOpenEvent(event.slug); }}
                className="flex-1 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                See the full programme
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
