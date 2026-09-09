import React, { useMemo } from 'react';
import {
  BarChart3, Users, Repeat, DoorOpen, Building2, TrendingUp, AlertTriangle,
  Star, CalendarCheck2,
} from 'lucide-react';
import {
  EventConfig, Session, Room, Track, UserProfile, AttendanceRecord, FeedbackEntry,
} from '../../types';
import { buildAnalytics } from '../../lib/analytics';

interface AdminAnalyticsProps {
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  tracks: Track[];
  users: UserProfile[];
  attendance: AttendanceRecord[];
  feedback: FeedbackEntry[];
}

/**
 * What the run of events actually shows.
 *
 * Magnitude throughout, so magnitude is how it is drawn: one hue, light to
 * dark, and every bar carries its own number. Nothing here is encoded by
 * colour alone — the Chadwick secondary palette was measured earlier and its
 * adjacent pairs fail colour-vision separation, so using them to distinguish
 * categories would have made the charts unreadable for part of the staff and
 * looked fine to everyone checking.
 *
 * The panels are ordered by the questions asked while planning the next
 * programme: did people come, what drew them, were the rooms right, who comes
 * back, and where from.
 */

/**
 * One hue, light to dark, for magnitude.
 *
 * Measured rather than chosen: OKLab lightness runs 0.288 / 0.494 / 0.679 /
 * 0.851 — strictly monotonic across a range of 0.563, which is what a
 * sequential ramp has to be. Adjacent steps also clear colour-vision
 * separation at ΔE 16.4 (protan), so the ordering survives for readers who do
 * not see the hue at all.
 *
 * The two lightest steps fall below 3:1 against the page, which obliges a
 * second encoding rather than being dismissable. Every bar therefore carries
 * its own number, always, and the bar is a supporting cue rather than the
 * information.
 */
const barColour = (fraction: number): string => {
  if (fraction >= 0.75) return '#002b54';
  if (fraction >= 0.5) return '#2a6791';
  if (fraction >= 0.25) return '#56a0d3';
  return '#acd4f1';
};

const Bar: React.FC<{
  label: string; sub?: string; value: number; max: number; suffix?: string;
  warn?: boolean; note?: string;
}> = ({ label, sub, value, max, suffix = '', warn, note }) => {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800 truncate">{label}</div>
          {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
        </div>
        {/* The number is always present. A bar alone asks the reader to
            estimate, and they will estimate wrong. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {warn && <AlertTriangle className="w-3 h-3 text-amber-600" />}
          <span className={`text-xs font-bold tabular-nums ${warn ? 'text-amber-800' : 'text-slate-900'}`}>
            {value}{suffix}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(2, Math.min(100, fraction * 100))}%`,
            background: warn ? '#b04318' : barColour(fraction),
          }}
        />
      </div>
      {note && <div className="text-[10px] text-slate-400 mt-1">{note}</div>}
    </div>
  );
};

const Panel: React.FC<{
  icon: React.ElementType; title: string; hint?: string; children: React.ReactNode;
}> = ({ icon: Icon, title, hint, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-blue-600" />
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    </div>
    {hint && <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">{hint}</p>}
    <div className={hint ? '' : 'mt-3'}>{children}</div>
  </div>
);

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  events, sessions, rooms, tracks, users, attendance, feedback,
}) => {
  const a = useMemo(
    () => buildAnalytics({ events, sessions, rooms, tracks, users, attendance, feedback }),
    [events, sessions, rooms, tracks, users, attendance, feedback]);

  if (a.empty) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 mb-1">Nothing to report yet</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          These figures come from door scans at real events that have finished. Sample
          events are excluded — an average show rate built from invented attendance
          would look like evidence and would not be any.
        </p>
      </div>
    );
  }

  const maxAttended = Math.max(...a.bestAttended.map((s) => s.attended), 1);
  const maxOrg = Math.max(...a.organisations.map((o) => o.people), 1);
  const maxTrack = Math.max(...a.byTrack.map((t) => t.attended), 1);
  const maxReturning = Math.max(...a.returning.map((r) => r.people), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          [CalendarCheck2, String(a.eventsRun), 'Events run'],
          [Users, String(a.uniquePeople), 'People reached'],
          [TrendingUp, String(a.totalAttendances), 'Session attendances'],
          [BarChart3, a.averageShowRate === null ? '—' : `${a.averageShowRate}%`, 'Average show rate'],
          [Star, a.averageRating === null ? '—' : String(a.averageRating), 'Average rating'],
        ] as const).map(([Icon, value, label]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <Icon className="w-4 h-4 text-blue-600 mb-2.5" />
            <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-1.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel icon={CalendarCheck2} title="Did people come?"
               hint="Attendances against seats booked. Below 60% is worth a look — it usually means booking was too easy or the reminder never landed.">
          {a.byEvent.length === 0
            ? <p className="text-xs text-slate-400 italic py-3">No finished events yet.</p>
            : a.byEvent.map((e) => (
                <Bar key={e.event.id}
                     label={e.event.name}
                     sub={`${e.attendances} of ${e.booked} booked · ${e.people} people`}
                     value={e.showRate ?? 0} max={100} suffix="%"
                     warn={(e.showRate ?? 100) < 60}
                     note={e.showRate === null ? 'Nothing was booked in advance' : undefined} />
              ))}
        </Panel>

        <Panel icon={TrendingUp} title="What drew people"
               hint="The sessions with the most in the room. The clearest signal for next year's programme.">
          {a.bestAttended.map((s) => (
            <Bar key={s.session.id}
                 label={s.session.title}
                 sub={[s.track?.name, s.room?.name].filter(Boolean).join(' · ')}
                 value={s.attended} max={maxAttended} />
          ))}
        </Panel>

        <Panel icon={DoorOpen} title="Rooms that were the wrong size"
               hint="Half-empty in a large room, or over capacity in a small one. Both are a different room next time.">
          {a.roomMismatches.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              Every session sat comfortably in its room.
            </p>
          ) : a.roomMismatches.map((s) => (
            <Bar key={s.session.id}
                 label={s.session.title}
                 sub={`${s.room?.name} · holds ${s.capacity}`}
                 value={s.attended} max={s.capacity}
                 warn={s.fill > 1}
                 note={s.fill > 1
                   ? `Over capacity by ${s.attended - s.capacity}`
                   : `${Math.round(s.fill * 100)}% full — a smaller room would suit it`} />
          ))}
        </Panel>

        <Panel icon={Repeat} title="Who comes back"
               hint="People counted by how many events they have attended. A wide base with few returners means each event is finding a new audience rather than building one.">
          {a.returning.map((r) => (
            <Bar key={r.events}
                 label={r.events === 1 ? 'Attended one event' : `Attended ${r.events} events`}
                 value={r.people} max={maxReturning}
                 sub={r.events > 1 ? 'returning' : 'first time'} />
          ))}
        </Panel>

        <Panel icon={Building2} title="Where they came from"
               hint="Distinct people per organisation, across every event.">
          {a.organisations.length === 0
            ? <p className="text-xs text-slate-400 italic py-3">No organisations recorded.</p>
            : a.organisations.map((o) => (
                <Bar key={o.name} label={o.name} value={o.people} max={maxOrg} />
              ))}
        </Panel>

        <Panel icon={BarChart3} title="Balance across strands"
               hint="Attendance per strand. A strand with many sessions and little attendance is worth fewer slots; one with the reverse is worth more.">
          {a.byTrack.length === 0
            ? <p className="text-xs text-slate-400 italic py-3">No strands recorded.</p>
            : a.byTrack.map((t) => (
                <Bar key={t.track.id} label={t.track.name}
                     sub={`${t.sessions} session${t.sessions === 1 ? '' : 's'}`}
                     value={t.attended} max={maxTrack} />
              ))}
        </Panel>
      </div>

      {a.worstAttended.length > 0 && (
        <Panel icon={AlertTriangle} title="Booked but not attended"
               hint="Sessions people reserved and did not come to. Often a clash, a room that was hard to find, or a title that promised something else.">
          {a.worstAttended.map((s) => (
            <Bar key={s.session.id}
                 label={s.session.title}
                 sub={[s.track?.name, s.room?.name].filter(Boolean).join(' · ')}
                 value={s.attended} max={Math.max(s.booked, 1)}
                 warn={s.attended < s.booked * 0.5}
                 note={`${s.booked} booked, ${s.attended} came`} />
          ))}
        </Panel>
      )}
    </div>
  );
};
