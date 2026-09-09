import React, { useMemo, useState } from 'react';
import { Sun, Sprout, Star, Users, TrendingDown, EyeOff, AlertTriangle } from 'lucide-react';
import {
  FeedbackEntry, Session, MealService, UserProfile, EVENT_FEEDBACK_ASPECTS,
} from '../types';

interface FeedbackReportProps {
  feedback: FeedbackEntry[];
  sessions: Session[];
  mealServices: MealService[];
  profiles: UserProfile[];
}

/**
 * Organiser view of the glows and grows.
 *
 * Sorted worst-rated first by default. A feedback report ordered by popularity
 * tells you what you already know; ordered by weakness it tells you where the
 * next hour of work should go. Response rate sits alongside every average,
 * because a 5.0 from two people is not the same finding as a 4.1 from ninety.
 */

/**
 * Visual summary.
 *
 * The job of this data is magnitude comparison, so the bars are a single hue
 * and length carries the meaning. A categorical palette was the wrong tool and
 * would also have failed CVD separation on the Chadwick secondaries — checked,
 * not assumed. Where a score falls below the attention threshold the row gains
 * a status colour AND an icon AND a label, never colour alone.
 */
const THRESHOLD = 3.5;

const ScoreBars: React.FC<{
  rows: { key: string; label: string; context?: string; avg: number; n: number; denom: number }[];
}> = ({ rows }) => {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = (r.avg / 5) * 100;
        const low = r.avg < THRESHOLD;
        return (
          <div key={r.key} title={`${r.label} — ${r.avg.toFixed(1)} of 5 from ${r.n} response${r.n === 1 ? '' : 's'}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-xs font-semibold text-slate-700 truncate flex items-center gap-1.5">
                {low && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
                {r.label}
                {low && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Needs attention
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums shrink-0">
                <span className="font-bold text-slate-900">{r.avg.toFixed(1)}</span>
                <span className="text-slate-400"> · {r.n}/{r.denom}</span>
              </span>
            </div>
            {/* Track and fill. 4px rounded end anchored to the baseline; the
                track is recessive so the fill carries the comparison. */}
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-r"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: low ? '#b04318' : '#2a6791',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const FeedbackReport: React.FC<FeedbackReportProps> = ({
  feedback, sessions, mealServices, profiles,
}) => {
  const [sort, setSort] = useState<'weakest' | 'strongest' | 'most'>('weakest');

  const nameFor = (targetId: string) => {
    const s = sessions.find((x) => x.id === targetId);
    if (s) return { label: s.title, context: `Day ${s.day} · ${s.startTime}`, denom: s.reservedUserIds.length };
    const m = mealServices.find((x) => x.id === targetId);
    if (m) return { label: m.name, context: m.location, denom: Object.keys(m.selections).length };
    const a = EVENT_FEEDBACK_ASPECTS.find((x) => x.id === targetId);
    if (a) return { label: a.label, context: 'Event-wide', denom: profiles.length };
    return { label: targetId, context: '', denom: profiles.length };
  };

  const groups = useMemo(() => {
    const by = new Map<string, FeedbackEntry[]>();
    for (const f of feedback) by.set(f.targetId, [...(by.get(f.targetId) ?? []), f]);

    const rows = [...by.entries()].map(([targetId, entries]) => {
      const avg = entries.reduce((s, e) => s + e.rating, 0) / entries.length;
      const meta = nameFor(targetId);
      return {
        targetId, entries, avg,
        ...meta,
        responseRate: meta.denom > 0 ? Math.round((entries.length / meta.denom) * 100) : 0,
      };
    });

    if (sort === 'weakest') rows.sort((a, b) => a.avg - b.avg);
    if (sort === 'strongest') rows.sort((a, b) => b.avg - a.avg);
    if (sort === 'most') rows.sort((a, b) => b.entries.length - a.entries.length);
    return rows;
  }, [feedback, sessions, mealServices, profiles, sort]);

  /** Rolled up to the categories an organiser reports on, rather than one row
   *  per session — the question after an event is "how was the programme",
   *  not "how was session seven". */
  const categories = useMemo(() => {
    const bucket = (f: FeedbackEntry) =>
      f.targetKind === 'session' ? 'Sessions'
        : f.targetId === 'catering' || f.targetKind === 'meal' ? 'Food & dining'
        : f.targetId === 'venue' ? 'Venue & wayfinding'
        : f.targetId === 'organisation' ? 'Registration & comms'
        : 'Overall conference';

    const names = ['Overall conference', 'Sessions', 'Food & dining', 'Venue & wayfinding', 'Registration & comms'];
    return names.map((label) => {
      const rows = feedback.filter((f) => bucket(f) === label);
      return {
        key: label, label,
        avg: rows.length ? rows.reduce((s, f) => s + f.rating, 0) / rows.length : 0,
        n: rows.length,
        denom: profiles.length,
      };
    }).filter((r) => r.n > 0).sort((a, b) => a.avg - b.avg);
  }, [feedback, profiles]);

  /** How ratings are spread. An average of 3.5 from all-3s is a different
   *  finding from an average of 3.5 that is half 5s and half 2s. */
  const distribution = useMemo(() => {
    const counts = [1, 2, 3, 4, 5].map((n) => ({
      rating: n, count: feedback.filter((f) => f.rating === n).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, pct: (c.count / max) * 100 }));
  }, [feedback]);

  const overall = useMemo(() => {
    if (feedback.length === 0) return null;
    return {
      avg: feedback.reduce((s, e) => s + e.rating, 0) / feedback.length,
      count: feedback.length,
      glows: feedback.filter((f) => f.glow).length,
      grows: feedback.filter((f) => f.grow).length,
    };
  }, [feedback]);

  const authorOf = (f: FeedbackEntry) =>
    f.isAnonymous ? null : profiles.find((p) => p.id === f.userId);

  if (feedback.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Sun className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 mb-1">No feedback yet</h3>
        <p className="text-sm text-slate-500">
          Glows and grows appear here as attendees submit them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Average rating', value: overall.avg.toFixed(1), icon: Star, tone: 'text-amber-600' },
            { label: 'Responses', value: String(overall.count), icon: Users, tone: 'text-blue-600' },
            { label: 'Glows', value: String(overall.glows), icon: Sun, tone: 'text-amber-500' },
            { label: 'Grows', value: String(overall.grows), icon: Sprout, tone: 'text-emerald-600' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${tone}`} />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Visual summary ---------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-1">How each area scored</h3>
          <p className="text-xs text-slate-500 mb-4">
            Weakest first. Anything under {THRESHOLD.toFixed(1)} is flagged.
          </p>
          <ScoreBars rows={categories} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-1">Spread of ratings</h3>
          <p className="text-xs text-slate-500 mb-4">
            An average hides whether people agreed. A split verdict matters more
            than a middling one.
          </p>
          <div className="space-y-2">
            {distribution.slice().reverse().map((d) => (
              <div key={d.rating} className="flex items-center gap-3"
                   title={`${d.count} response${d.count === 1 ? '' : 's'} rated ${d.rating}`}>
                <span className="w-10 shrink-0 text-xs font-semibold text-slate-600 flex items-center gap-0.5">
                  {d.rating}
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-r" style={{ width: `${Math.max(d.count ? 2 : 0, d.pct)}%`, background: '#2a6791' }} />
                </div>
                <span className="w-6 shrink-0 text-xs tabular-nums text-slate-500 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Sort</span>
        {([
          ['weakest', 'Needs attention first'],
          ['strongest', 'Strongest first'],
          ['most', 'Most responses'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSort(v)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              sort === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-target */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.targetId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 leading-snug">{g.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{g.context}</p>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <div className={`text-xl font-bold flex items-center gap-1.5 ${
                    g.avg < 3.5 ? 'text-amber-700' : 'text-slate-900'
                  }`}>
                    {g.avg < 3.5 && <TrendingDown className="w-4 h-4" />}
                    {g.avg.toFixed(1)}
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {g.entries.length} of {g.denom} · {g.responseRate}%
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {g.entries.map((f) => {
                const author = authorOf(f);
                return (
                  <div key={f.id} className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      {author ? (
                        <>
                          <img src={author.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{author.fullName}</div>
                            <div className="text-[10px] text-slate-400 truncate">{author.organization}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500">Anonymous</span>
                        </>
                      )}
                      <div className="ml-auto flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${n <= f.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {f.glow && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1.5">
                            <Sun className="w-3.5 h-3.5" />
                            Glow
                          </div>
                          <p className="text-sm text-amber-950 leading-relaxed">{f.glow}</p>
                        </div>
                      )}
                      {f.grow && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
                            <Sprout className="w-3.5 h-3.5" />
                            Grow
                          </div>
                          <p className="text-sm text-emerald-950 leading-relaxed">{f.grow}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2.5">{f.submittedAt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
