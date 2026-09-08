import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Session, Room, Track, UserProfile, EventConfig, Sponsor } from '../types';
import {
  SignageBroadcast, subscribeBroadcast, appliesToRoom, BROADCAST_KIND_META,
} from '../lib/signage';

interface RoomSignageProps {
  event: EventConfig;
  room: Room;
  sessions: Session[];
  tracks: Track[];
  profiles: UserProfile[];
  sponsors: Sponsor[];
  /** Overrides the wall clock so the display can be previewed at any moment
   *  of the programme without waiting for the real time to arrive. */
  simulatedMinutes?: number | null;
}

/**
 * Full-screen room display, designed to be cast to a panel outside or inside a
 * session room by CI Vision.
 *
 * The display's single most important job is answering "am I in the right
 * room?" from the doorway, so the room name and the current session title carry
 * the largest type and everything else is subordinate to them.
 *
 * It is driven purely by the clock: the component resolves which session owns
 * the room at the current minute and re-resolves every 15 seconds, so a cast
 * screen left running for two days stays correct without anyone touching it.
 *
 * INTEGRATION: this renders at `?signage=<roomId>` with no chrome and no auth,
 * which is what a signage player needs — point a CI Vision Live Cast at that
 * URL and it will hold the right content all day.
 */

const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

const fmtClock = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const RoomSignage: React.FC<RoomSignageProps> = ({
  event, room, sessions, tracks, profiles, sponsors, simulatedMinutes = null,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [broadcast, setBroadcast] = useState<SignageBroadcast | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Organizer takeovers arrive here; they override the room's own content.
  useEffect(() => subscribeBroadcast(setBroadcast), []);

  const minutes = simulatedMinutes ?? toMinutes(now);

  const roomSessions = useMemo(
    () => sessions
      .filter((s) => s.roomId === room.id)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [sessions, room.id],
  );

  const current = roomSessions.find((s) => minutes >= s.startMinutes && minutes < s.endMinutes);
  const next = roomSessions.find((s) => s.startMinutes > minutes);

  const track = tracks.find((t) => t.id === current?.trackId);
  const accent = track?.colorHex ?? '#002b54';
  const speakers = (current?.speakerIds ?? [])
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is UserProfile => Boolean(p));

  const sponsor = sponsors.find((s) => s.id === current?.primarySponsorId);

  // Progress through the running session, for the bar along the foot.
  const progress = current
    ? Math.min(100, Math.max(0,
        ((minutes - current.startMinutes) / (current.endMinutes - current.startMinutes)) * 100))
    : 0;
  const minutesLeft = current ? Math.max(0, current.endMinutes - minutes) : 0;

  const takeover = appliesToRoom(broadcast, room.id) ? broadcast : null;

  if (takeover) {
    const meta = BROADCAST_KIND_META[takeover.kind];
    return (
      <div
        className="min-h-screen w-full flex flex-col"
        style={{ background: meta.bg, color: meta.fg }}
      >
        <div className="px-12 py-8 flex items-center justify-between shrink-0 border-b border-white/15">
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-[0.3em] uppercase" style={{ color: meta.accent }}>
              {meta.label}
            </div>
            <div className="text-3xl font-bold truncate mt-1">{room.name}</div>
          </div>
          <div className="text-5xl font-bold tabular-nums shrink-0">{fmtClock(now)}</div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-12 py-10 min-h-0">
          <h1 className="text-6xl xl:text-7xl 2xl:text-8xl font-bold leading-[1.05] tracking-tight mb-8">
            {takeover.title}
          </h1>
          {takeover.message && (
            <p className="text-3xl xl:text-4xl leading-snug max-w-6xl" style={{ color: meta.accent }}>
              {takeover.message}
            </p>
          )}
        </div>

        {/* The room's own programme still shows underneath, so a takeover
            never leaves someone unable to tell what is happening here. */}
        {current && (
          <div className="px-12 py-6 border-t border-white/15 flex items-center justify-between gap-8 shrink-0">
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-widest uppercase opacity-60">
                In this room now
              </div>
              <div className="text-2xl font-bold truncate mt-0.5">{current.title}</div>
            </div>
            <div className="text-xl font-semibold opacity-70 shrink-0">
              {current.startTime} – {current.endTime}
            </div>
          </div>
        )}

        <div className="px-12 py-4 bg-black/25 text-base opacity-60 flex items-center justify-between shrink-0">
          <span>{event.name}</span>
          <span>CI Connects · powered by CI Vision</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* ---------------- Top bar: room identity ---------------- */}
      <div
        className="px-10 py-6 flex items-center justify-between gap-8 shrink-0"
        style={{ background: accent }}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-[0.25em] text-white/70 uppercase">
            You are in
          </div>
          <div className="text-5xl xl:text-6xl font-bold tracking-tight truncate">
            {room.name}
          </div>
          <div className="text-lg text-white/70 mt-1">
            {room.floorLabel} · capacity {room.capacity}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-6xl xl:text-7xl font-bold tabular-nums tracking-tight">
            {fmtClock(now)}
          </div>
          <div className="text-base text-white/70 mt-1">{event.shortName}</div>
        </div>
      </div>

      {/* ---------------- Body ---------------- */}
      {current ? (
        <div className="flex-1 flex min-h-0">
          {/* Session detail */}
          <div className="flex-1 px-10 py-8 flex flex-col min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <span
                className="px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider"
                style={{ background: accent }}
              >
                {track?.name ?? 'Session'}
              </span>
              <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white/10 border border-white/20">
                {current.startTime} – {current.endTime}
              </span>
              {minutesLeft > 0 && minutesLeft <= 10 && (
                <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-amber-500 text-amber-950">
                  {minutesLeft} min remaining
                </span>
              )}
            </div>

            <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              {current.title}
            </h1>

            <p className="text-xl xl:text-2xl text-slate-300 leading-relaxed max-w-4xl line-clamp-4">
              {current.description}
            </p>

            {/* Speakers */}
            {speakers.length > 0 && (
              <div className="mt-auto pt-8 flex items-center gap-8 flex-wrap">
                {speakers.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-4">
                    <img
                      src={sp.avatarUrl}
                      alt=""
                      className="w-20 h-20 xl:w-24 xl:h-24 rounded-2xl object-cover border-2 border-white/20"
                    />
                    <div className="min-w-0">
                      <div className="text-2xl xl:text-3xl font-bold leading-tight">{sp.fullName}</div>
                      <div className="text-lg text-slate-400">{sp.title}</div>
                      <div className="text-base text-slate-500">{sp.organization}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scan-in rail */}
          <div className="w-[22rem] xl:w-[26rem] shrink-0 border-l border-white/10 bg-white/[0.03] px-8 py-8 flex flex-col">
            <div className="bg-white rounded-3xl p-6 flex flex-col items-center">
              <QRCodeSVG
                value={JSON.stringify({ t: 'ci-connects-door', sid: current.id, rid: room.id })}
                size={210}
                level="M"
                bgColor="#ffffff"
                fgColor="#002b54"
              />
              <div className="text-slate-900 font-bold text-lg mt-4 text-center leading-tight">
                Scan to check in
              </div>
              <div className="text-slate-500 text-sm text-center mt-1 leading-snug">
                Confirms your attendance for this session
              </div>
            </div>

            <div className="mt-6 px-5 py-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-1">
                Seats
              </div>
              <div className="text-3xl font-bold">
                {current.reservedUserIds.length}
                <span className="text-lg text-slate-500 font-medium"> / {current.maxAttendees}</span>
              </div>
              {current.waitlistUserIds.length > 0 && (
                <div className="text-sm text-amber-400 mt-1">
                  {current.waitlistUserIds.length} on the waitlist
                </div>
              )}
            </div>

            {next && (
              <div className="mt-auto pt-6">
                <div className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2">
                  Next in this room
                </div>
                <div className="text-xl font-bold leading-snug line-clamp-2">{next.title}</div>
                <div className="text-base text-slate-400 mt-1">{next.startTime}</div>
              </div>
            )}

            {sponsor && (
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="text-xs tracking-widest text-slate-500 uppercase mb-1">
                  Session partner
                </div>
                <div className="text-lg font-semibold text-slate-300">{sponsor.name}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---------------- Between sessions: day schedule ---------------- */
        <div className="flex-1 px-10 py-8 flex flex-col min-h-0">
          <div className="text-2xl font-bold text-slate-400 tracking-widest uppercase mb-2">
            No session running right now
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold mb-8">Today in this room</h2>

          <div className="flex-1 overflow-hidden">
            <div className="space-y-4">
              {roomSessions.slice(0, 6).map((s) => {
                const t = tracks.find((x) => x.id === s.trackId);
                const done = minutes >= s.endMinutes;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-6 px-6 py-5 rounded-2xl border ${
                      done ? 'border-white/5 bg-white/[0.02] opacity-40' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="w-40 shrink-0">
                      <div className="text-2xl font-bold tabular-nums">{s.startTime}</div>
                      <div className="text-base text-slate-500">Day {s.day}</div>
                    </div>
                    <div
                      className="w-1.5 h-14 rounded-full shrink-0"
                      style={{ background: t?.colorHex ?? '#002b54' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-2xl font-bold leading-snug truncate">{s.title}</div>
                      <div className="text-lg text-slate-400 truncate">{t?.name}</div>
                    </div>
                    {done && (
                      <span className="text-base text-slate-500 font-semibold shrink-0">Finished</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Progress / footer ---------------- */}
      <div className="shrink-0">
        {current && (
          <div className="h-2 bg-white/10">
            <div
              className="h-full transition-[width] duration-1000"
              style={{ width: `${progress}%`, background: accent }}
            />
          </div>
        )}
        <div className="px-10 py-4 flex items-center justify-between text-base text-slate-500 bg-black/40">
          <span className="font-semibold text-slate-400">
            {event.name}
          </span>
          <span>CI Connects · powered by CI Vision</span>
        </div>
      </div>
    </div>
  );
};
