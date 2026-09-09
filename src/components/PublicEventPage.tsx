import React, { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, MapPin, ArrowRight, Clock, ChevronDown,
  Users, Sparkles, LogIn, PlayCircle, Clock as ClockIcon, FileText,
} from 'lucide-react';
import { EventConfig, Session, Track, Room, UserProfile, Sponsor, registrationState, eventStatus } from '../types';
import { resolveVideoEmbed } from '../lib/videoEmbed';
import { EventRecapBody } from './EventRecapModal';
import { SponsorWall } from './SponsorWall';

interface PublicEventPageProps {
  event: EventConfig;
  /** Back to the events hub. */
  onBackToEvents: () => void;
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  profiles: UserProfile[];
  sponsors: Sponsor[];
  onSignIn: () => void;
}

/**
 * The public, unauthenticated face of an event — what a prospective attendee
 * sees before they have any credentials.
 *
 * Deliberately separate from the portal: this page is marketing and is safe to
 * index and share, while everything behind sign-in is attendee data. All copy
 * comes from EventConfig, so re-skinning it for the next event is a content
 * change rather than a code change.
 */
export const PublicEventPage: React.FC<PublicEventPageProps> = ({
  event, sessions, tracks, rooms, profiles, sponsors, onSignIn, onBackToEvents,
}) => {
  // Only the flagship has a programme wired up. For a landing-page-only event
  // the agenda, speaker and venue-room sections are hidden rather than shown
  // empty, which would read as a broken page rather than a lighter one.
  const hasProgramme = sessions.length > 0;
  /** A finished event answers a different question: not "should I come" but
   *  "what did I miss". The page shifts accordingly. */
  const isPast = eventStatus(event) === 'past';
  const [agendaDay, setAgendaDay] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Confirmed speakers first; sample entries trail so the real programme leads.
  const speakers = useMemo(
    () => profiles
      .filter((p) => p.role === 'speaker')
      .sort((a, b) => Number(a.isPlaceholder ?? false) - Number(b.isPlaceholder ?? false)),
    [profiles],
  );

  const agendaForDay = useMemo(
    () => sessions.filter((s) => s.day === agendaDay).sort((a, b) => a.startMinutes - b.startMinutes),
    [sessions, agendaDay],
  );

  const days = useMemo(() => {
    const seen: number[] = [];
    for (const s of sessions) if (!seen.includes(s.day)) seen.push(s.day);
    return seen.sort((a, b) => a - b);
  }, [sessions]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const NAV = ([
    event.about?.length ? ['About', 'about'] : null,
    hasProgramme ? ['Speakers', 'speakers'] : null,
    event.presenters?.length ? ['Led by', 'presenters'] : null,
    hasProgramme ? ['Agenda', 'agenda'] : null,
    ['Venue', 'venue'],
    sponsors.length ? ['Sponsors', 'sponsors'] : null,
    event.recap ? ['How it went', 'recap'] : null,
    event.discover ? ['Discover', 'discover'] : null,
    event.faqs?.length ? ['FAQ', 'faq'] : null,
  ].filter(Boolean)) as [string, string][];

  return (
    <div className="min-h-screen bg-white">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* The mark returns to the hub, as a logo is expected to. Without
              this the only way back was a nav item hidden below md, which left
              a phone with no route off an event page at all. */}
          <button
            onClick={onBackToEvents}
            title="All Chadwick events"
            className="flex items-center gap-2.5 min-w-0 group cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
              <Building2 className="w-4.5 h-4.5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 truncate leading-tight">{event.shortName}</span>
                {event.isTemplate && (
                  <span className="hidden sm:inline shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                    Template
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 truncate group-hover:text-blue-700 transition-colors">
                CI Connects · Chadwick International
              </div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={onBackToEvents}
              className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
            >
              ← All events
            </button>
            {NAV.map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </nav>

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

      {/* Template notice — deliberately above the hero, so it is read before
          the event content rather than discovered afterwards. */}
      {event.isTemplate && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-xs text-amber-900">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Sample event template.</strong> Content here is illustrative,
              showing how a Chadwick event appears in CI Connects. Replace the
              event configuration to publish a real one.
            </span>
          </div>
        </div>
      )}

      {/* ---------------- Hero ---------------- */}
      <section className="relative bg-blue-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img src={event.heroImageUrl} alt="" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-blue-800/90 to-blue-950/95" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span className="text-xs font-semibold text-blue-100 tracking-wide">
                Hosted at {event.venueName}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
              {event.name}
            </h1>
            <p className="text-2xl sm:text-3xl text-blue-100 font-light leading-snug mb-7 italic">
              {event.tagline}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-blue-100/80 mb-9">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-200" />
                {event.dateLabel}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-200" />
                {event.venueName}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {(() => {
                const reg = registrationState(event);
                if (reg.state === 'open') {
                  return (
                    <button
                      onClick={onSignIn}
                      className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      Register now
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  );
                }
                if (reg.state === 'opens_later') {
                  return (
                    <div className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-white/10 border border-white/25 font-semibold backdrop-blur-sm">
                      <ClockIcon className="w-4 h-4 text-blue-200" />
                      Registration opens{' '}
                      {new Date(reg.opensAt + 'T00:00:00').toLocaleDateString('en-US',
                        { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  );
                }
                return (
                  <div className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-white/10 border border-white/25 font-semibold backdrop-blur-sm">
                    {reg.reason === 'ended' ? 'This event has finished' : 'Registration is closed'}
                  </div>
                );
              })()}
              <button
                onClick={() => scrollTo('agenda')}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/10 border border-white/25 text-white font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm cursor-pointer"
              >
                Explore the agenda
              </button>
            </div>
          </div>
        </div>

        {/* Highlights strip */}
        <div className="relative border-t border-white/15 bg-blue-950/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {(event.highlights ?? []).map((h) => (
              <div key={h.label}>
                <div className="text-2xl sm:text-3xl font-bold text-white">{h.value}</div>
                <div className="text-xs text-blue-200/70 uppercase tracking-wide mt-0.5">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- About ---------------- */}
      {(event.description || event.about?.length) && (
      <section id="about" className="py-20 sm:py-24 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">About the conference</div>
            <p className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-snug">
              {event.description}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {(event.about ?? []).map((block, i) => (
              <div key={block.heading}>
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2.5">{block.heading}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{block.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ---------------- Tracks ---------------- */}
      {hasProgramme && (
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Programme tracks</h2>
          <div className="flex flex-wrap gap-2.5">
            {tracks.map((t) => (
              <span
                key={t.id}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: t.colorHex }}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ---------------- After the event ---------------- */}
      {isPast && event.recap && (
        <section id="recap" className="py-16 sm:py-20 bg-white border-b border-slate-200 scroll-mt-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
              After the event
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-8">
              What came out of it
            </h2>
            <EventRecapBody event={event} />
          </div>
        </section>
      )}

      {/* ---------------- Speakers ---------------- */}
      {hasProgramme && (
      <section id="speakers" className="py-20 sm:py-24 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Speakers</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Led by people doing the work
          </h2>
          <p className="text-slate-500 max-w-2xl mb-4 leading-relaxed">
            Every session is presented by a practising educator, school leader or
            technologist — not a vendor.
          </p>
          {speakers.some((s) => s.isPlaceholder) && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 max-w-2xl mb-12">
              Entries marked <strong>Sample</strong> are placeholders. Replace them
              with the confirmed speakers for this event.
            </p>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {speakers.map((s) => (
              <div key={s.id} className="group rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-600 transition-colors">
                <div className="aspect-[4/3] overflow-hidden bg-slate-100 flex items-center justify-center">
                  <img
                    src={s.avatarUrl}
                    alt=""
                    className="w-24 h-24 rounded-2xl object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 leading-tight">{s.fullName}</h3>
                    {s.isPlaceholder && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        Sample
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-700 font-medium mt-0.5">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.organization}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3 line-clamp-3">{s.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ---------------- Led by ----------------
          Workshop-style events have no session programme, but who is running
          them is the main reason to attend, so they get their own block. */}
      {!!event.presenters?.length && (
        <section id="presenters" className="py-20 sm:py-24 bg-white scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
              Led by
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10">
              {event.presenters.length === 1 ? 'Your facilitator' : 'Your facilitators'}
            </h2>
            <div className="space-y-4">
              {event.presenters.map((pr) => (
                <div key={pr.name} className="flex items-start gap-5 rounded-2xl border border-slate-200 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
                    {pr.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{pr.name}</h3>
                    <p className="text-sm text-blue-700 font-medium mt-0.5">{pr.role}</p>
                    {pr.note && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{pr.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Agenda ---------------- */}
      {hasProgramme && (
      <section id="agenda" className="py-20 sm:py-24 bg-slate-50 border-y border-slate-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Agenda</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8">
            Two days, five tracks
          </h2>

          <div className="flex items-center gap-2 mb-6">
            {days.map((d) => {
              const label = sessions.find((s) => s.day === d)?.dateStr ?? `Day ${d}`;
              return (
                <button
                  key={d}
                  onClick={() => setAgendaDay(d)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    d === agendaDay
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                  }`}
                >
                  Day {d} · {label.replace(', 2026', '')}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {agendaForDay.map((s) => {
              const track = tracks.find((t) => t.id === s.trackId);
              const room = rooms.find((r) => r.id === s.roomId);
              return (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-4">
                  <div className="sm:w-40 shrink-0">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {s.startTime}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 ml-5">to {s.endTime}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {track && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wide"
                          style={{ backgroundColor: track.colorHex }}
                        >
                          {track.name}
                        </span>
                      )}
                      {s.isFeatured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
                          Featured
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 leading-snug mb-1.5">{s.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-2">{s.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      {room && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {room.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        {s.maxAttendees} seats
                      </span>
                    </div>

                    {/* After the event, a session card stops advertising seats
                        and starts handing over what was said in the room. */}
                    {isPast && (s.recordingUrl || s.materials?.length) && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        {(() => {
                          const embed = resolveVideoEmbed(s.recordingUrl);
                          if (embed) {
                            return (
                              <div className="aspect-video rounded-lg overflow-hidden bg-slate-900 max-w-lg">
                                <iframe
                                  src={embed.src}
                                  title={`${s.title} recording`}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }
                          if (s.recordingUrl) {
                            return (
                              <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                                <PlayCircle className="w-3.5 h-3.5" /> Watch this session
                              </a>
                            );
                          }
                          return null;
                        })()}
                        {!!s.materials?.length && (
                          <div className="flex flex-wrap gap-2">
                            {s.materials.map((m) => (
                              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700 transition-colors">
                                <FileText className="w-3 h-3" />
                                {m.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-5 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              Seats are limited per room. Sign in to reserve your place and build a
              personal agenda.
            </p>
            <button
              onClick={onSignIn}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Reserve your seat
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ---------------- Venue ---------------- */}
      <section id="venue" className="py-20 sm:py-24 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Venue</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{event.venueName}</h2>
            {event.venueAddress && <p className="text-slate-600 leading-relaxed mb-6">{event.venueAddress}</p>}
            <div className="space-y-3">
              {(hasProgramme ? rooms : []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.floorLabel}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {r.capacity} seats
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100">
            <img src={event.heroImageUrl} alt={event.venueName} className="w-full h-full object-cover" />
          </div>
        </div>
      </section>


      {/* ---------------- Recap ----------------
          Shown only after an event has run. Past events keep their page
          rather than being archived: the recording and the numbers are the
          most persuasive argument for the next one. */}
      {event.recap && (
        <section id="recap" className="py-20 sm:py-24 bg-slate-900 text-white scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                Event completed
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5">How it went</h2>
            {event.recap.summary && (
              <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-3xl">
                {event.recap.summary}
              </p>
            )}

            {!!event.recap.highlights?.length && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10 pb-10 border-b border-white/10">
                {event.recap.highlights.map((h) => (
                  <div key={h.label}>
                    <div className="text-3xl font-bold">{h.value}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">{h.label}</div>
                  </div>
                ))}
              </div>
            )}

            {event.recap.recordingUrl && (
              <a
                href={event.recap.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors mb-10"
              >
                <PlayCircle className="w-5 h-5" />
                {event.recap.recordingLabel ?? 'Watch the recording'}
              </a>
            )}

            {!!event.recap.photoUrls?.length && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                  Highlights
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {event.recap.photoUrls.map((url, i) => (
                    <img
                      key={url}
                      src={url}
                      alt={`Highlight ${i + 1}`}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover rounded-xl border border-white/10"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------- Discover Chadwick ----------------
          The school-connection half of the event. Framed as an invitation
          rather than a recruitment pitch, because that is what actually
          persuades a mission-aligned teacher — and because overselling here
          would undercut the honesty the rest of the page trades on. */}
      {event.discover && (
        <section id="discover" className="py-20 sm:py-24 bg-blue-600 text-white scroll-mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-14">
              <div className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-3">
                Discover Chadwick
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-5">
                {event.discover.heading}
              </h2>
              <p className="text-lg text-blue-50/90 leading-relaxed">
                {event.discover.intro}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mb-14">
              {event.discover.points.map((pt, i) => (
                <div key={pt.title}>
                  <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-bold text-sm mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2.5">{pt.title}</h3>
                  <p className="text-sm text-blue-50/80 leading-relaxed">{pt.body}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-white/20 pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <p className="text-xl sm:text-2xl font-light italic text-blue-100 max-w-2xl leading-snug">
                {event.discover.closing}
              </p>
              <button
                onClick={onSignIn}
                className="shrink-0 inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
              >
                Join us in October
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Sponsors ---------------- */}
      {sponsors.length > 0 && (
        <section id="sponsors" className="py-20 sm:py-24 bg-slate-50 border-y border-slate-200 scroll-mt-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                Sponsors & Partners
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Supported by organisations invested in education
              </h2>
            </div>
            <SponsorWall sponsors={sponsors} onEnquire={onSignIn} />
          </div>
        </section>
      )}

      {/* ---------------- FAQ ---------------- */}
      {!!event.faqs?.length && (
      <section id="faq" className="py-20 sm:py-24 bg-white scroll-mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">FAQ</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10">Questions, answered</h2>

          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {(event.faqs ?? []).map((faq, i) => (
              <div key={faq.question}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left cursor-pointer"
                >
                  <span className="font-semibold text-slate-900">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <p className="text-sm text-slate-600 leading-relaxed pb-5 -mt-1">{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      )}

      {/* ---------------- Closing CTA ---------------- */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to join us?</h2>
          {event.registrationNote && <p className="text-blue-100/90 leading-relaxed mb-8">{event.registrationNote}</p>}
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Go to the attendee portal
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="bg-slate-900 text-slate-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-300">CI Connects</span>
            <span>·</span>
            <span>The Chadwick International Event Management Platform</span>
          </div>
          <span>{event.venueName}</span>
        </div>
      </footer>
    </div>
  );
};
