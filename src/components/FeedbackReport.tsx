import React, { useMemo, useState } from 'react';
import { Sun, Sprout, Star, Users, TrendingDown, EyeOff } from 'lucide-react';
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
