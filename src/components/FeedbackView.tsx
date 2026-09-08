import React, { useMemo, useState } from 'react';
import { Sun, Sprout, Check, Star, Lock, EyeOff, MapPin, Clock } from 'lucide-react';
import {
  Session, MealService, AttendanceRecord, UserProfile, FeedbackEntry,
  FeedbackTargetKind, EVENT_FEEDBACK_ASPECTS,
} from '../types';

interface FeedbackViewProps {
  currentUser: UserProfile;
  sessions: Session[];
  mealServices: MealService[];
  attendance: AttendanceRecord[];
  feedback: FeedbackEntry[];
  onSubmit: (entry: Omit<FeedbackEntry, 'id' | 'userId' | 'submittedAt'>) => void;
}

/**
 * Glows and grows.
 *
 * Two named fields rather than one comment box. A single box reliably collects
 * only praise or only complaints depending on who shows up; asking for both by
 * name gets each from the same person, and gives an organiser something to act
 * on rather than a satisfaction score.
 *
 * Prompts are gated to what someone actually did — sessions they reserved or
 * were scanned into, meals they selected — because feedback on a session
 * nobody attended is noise that makes the real signal harder to read. Event-wide
 * aspects stay open to everyone.
 */

type Prompt = {
  key: string;
  kind: FeedbackTargetKind;
  title: string;
  subtitle: string;
  meta?: string;
  /** Set when a door scan confirms the person was actually there. */
  verified?: boolean;
};

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Outstanding'];

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  currentUser, sessions, mealServices, attendance, feedback, onSubmit,
}) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [glow, setGlow] = useState('');
  const [grow, setGrow] = useState('');
  const [anon, setAnon] = useState(false);

  const mine = useMemo(
    () => feedback.filter((f) => f.userId === currentUser.id),
    [feedback, currentUser.id],
  );
  const done = (targetId: string) => mine.some((f) => f.targetId === targetId);

  const prompts = useMemo<Prompt[]>(() => {
    const scanned = new Set(
      attendance.filter((a) => a.userId === currentUser.id).map((a) => a.sessionId),
    );

    // A session qualifies if they reserved it or were scanned in at its door.
    const attended = sessions.filter(
      (s) => s.reservedUserIds.includes(currentUser.id) || scanned.has(s.id),
    );

    const sessionPrompts: Prompt[] = attended
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes)
      .map((s) => ({
        key: s.id,
        kind: 'session',
        title: s.title,
        subtitle: `Day ${s.day} · ${s.startTime} – ${s.endTime}`,
        meta: scanned.has(s.id) ? 'Attendance verified at the door' : 'Reserved',
        verified: scanned.has(s.id),
      }));

    const mealPrompts: Prompt[] = mealServices
      .filter((m) => m.selections[currentUser.id])
      .map((m) => ({
        key: m.id,
        kind: 'meal',
        title: m.name,
        subtitle: m.location,
        meta: m.options.find((o) => o.id === m.selections[currentUser.id])?.label,
      }));

    const aspectPrompts: Prompt[] = EVENT_FEEDBACK_ASPECTS.map((a) => ({
      key: a.id,
      kind: a.kind,
      title: a.label,
      subtitle: a.hint,
    }));

    return [...sessionPrompts, ...mealPrompts, ...aspectPrompts];
  }, [sessions, mealServices, attendance, currentUser.id]);

  const open = (key: string) => {
    setOpenKey(openKey === key ? null : key);
    setRating(0); setGlow(''); setGrow(''); setAnon(false);
  };

  const submit = (p: Prompt) => {
    if (rating === 0) return;
    onSubmit({
      targetKind: p.kind,
      targetId: p.key,
      rating,
      glow: glow.trim(),
      grow: grow.trim(),
      isAnonymous: anon,
    });
    setOpenKey(null);
  };

  const completed = prompts.filter((p) => done(p.key)).length;

  const Card: React.FC<{ p: Prompt }> = ({ p }) => {
    const isDone = done(p.key);
    const isOpen = openKey === p.key;

    return (
      <div className={`rounded-2xl border overflow-hidden transition-colors ${
        isDone ? 'border-emerald-300 bg-emerald-50/40' : isOpen ? 'border-blue-600 bg-white' : 'border-slate-200 bg-white'
      }`}>
        <button
          onClick={() => !isDone && open(p.key)}
          disabled={isDone}
          className={`w-full text-left p-4 flex items-start gap-3 ${isDone ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isDone ? 'bg-emerald-600' : 'bg-slate-100'
          }`}>
            {isDone
              ? <Check className="w-4 h-4 text-white" strokeWidth={3} />
              : <Sun className="w-4 h-4 text-slate-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 text-sm leading-snug">{p.title}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {p.kind === 'session' && <Clock className="w-3 h-3 shrink-0" />}
              {p.kind === 'meal' && p.key !== 'catering' && <MapPin className="w-3 h-3 shrink-0" />}
              <span>{p.subtitle}</span>
            </div>
            {p.meta && (
              <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                p.verified
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                {p.meta}
              </span>
            )}
          </div>
          {isDone && (
            <span className="text-[11px] font-bold text-emerald-800 shrink-0 mt-1">Submitted</span>
          )}
        </button>

        {isOpen && !isDone && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
            {/* Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                How was it?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className="p-1 cursor-pointer"
                    aria-label={`${n} out of 5`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        n <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="text-sm font-semibold text-slate-600 ml-1">
                    {RATING_WORDS[rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Glow */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                Glow — what worked
              </label>
              <textarea
                value={glow}
                onChange={(e) => setGlow(e.target.value)}
                rows={3}
                placeholder="What should we keep doing, and why did it land?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Grow */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5">
                <Sprout className="w-4 h-4 text-emerald-600" />
                Grow — what would stretch it
              </label>
              <textarea
                value={grow}
                onChange={(e) => setGrow(e.target.value)}
                rows={3}
                placeholder="What would make this better next time? Be specific — it is more useful than being kind."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anon}
                  onChange={(e) => setAnon(e.target.checked)}
                  className="accent-blue-600"
                />
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                Submit without my name
              </label>
              <button
                onClick={() => submit(p)}
                disabled={rating === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Submit feedback
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const group = (kind: 'session' | 'meal-service' | 'aspect') => {
    if (kind === 'session') return prompts.filter((p) => p.kind === 'session');
    if (kind === 'meal-service') return prompts.filter((p) => p.kind === 'meal' && p.key !== 'catering');
    return prompts.filter((p) => EVENT_FEEDBACK_ASPECTS.some((a) => a.id === p.key));
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <Sun className="w-5 h-5 text-amber-500" />
              <Sprout className="w-5 h-5 text-emerald-600 -ml-1" />
              <h2 className="text-xl font-bold text-slate-900">Glows & Grows</h2>
            </div>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              A <strong className="text-slate-700">glow</strong> is what worked and
              should be kept. A <strong className="text-slate-700">grow</strong> is
              the stretch — what would make it better next time. We ask for both,
              because the useful feedback is usually the pair.
            </p>
          </div>
          <div className="shrink-0 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Completed</div>
            <div className="text-2xl font-bold text-blue-700 leading-tight">
              {completed}
              <span className="text-sm font-medium text-blue-600/70"> / {prompts.length}</span>
            </div>
          </div>
        </div>
      </div>

      {group('session').length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-1">Sessions you attended</h3>
          <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Only sessions you reserved or were scanned into appear here.
          </p>
          <div className="space-y-2.5">
            {group('session').map((p) => <Card key={p.key} p={p} />)}
          </div>
        </section>
      )}

      {group('meal-service').length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Meals you selected</h3>
          <div className="space-y-2.5">
            {group('meal-service').map((p) => <Card key={p.key} p={p} />)}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-bold text-slate-700 mb-3">The conference as a whole</h3>
        <div className="space-y-2.5">
          {group('aspect').map((p) => <Card key={p.key} p={p} />)}
        </div>
      </section>
    </div>
  );
};
