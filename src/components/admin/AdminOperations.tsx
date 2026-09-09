import React, { useMemo, useState } from 'react';
import { Gift, Wallet, Pencil, X, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Prize, CostEntry, CostCategory, COST_CATEGORIES, formatMoney,
  EventConfig, Sponsor, UserProfile,
} from '../../types';
import { Field, inputClass, Notice, SectionHeader, ConfirmDelete } from './formKit';

/* ============================================================================
   Lucky draw and spend — the two things an event manager owns that are neither
   programme nor people.
   ========================================================================= */

// ------------------------------------------------------------- lucky draw
export const AdminPrizes: React.FC<{
  prizes: Prize[];
  events: EventConfig[];
  sponsors: Sponsor[];
  profiles: UserProfile[];
  onSave: (prize: Prize, isNew: boolean) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}> = ({ prizes, events, sponsors, profiles, onSave, onDelete }) => {
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [editing, setEditing] = useState<Prize | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(
    () => prizes.filter((p) => p.eventId === eventId)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    [prizes, eventId]);

  const blank = (): Prize => ({
    id: `prize-${Date.now()}`, eventId, name: '', quantity: 1,
    orderIndex: mine.length + 1, wonBy: [],
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError('The prize needs a name.'); return; }
    if (editing.quantity < 1) { setError('Quantity must be at least 1.'); return; }
    const drawn = editing.wonBy?.length ?? 0;
    if (editing.quantity < drawn) {
      setError(`${drawn} of these have already been drawn. Quantity cannot go below that.`);
      return;
    }
    try { await onSave(editing, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New prize' : `Editing: ${editing.name || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Prize"><input className={inputClass} value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Apple iPad Air (64GB) + Apple Pencil" /></Field>
          <Field label="Description"><textarea className={`${inputClass} resize-none`} rows={2}
            value={editing.description ?? ''}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Quantity" hint="How many of this prize there are.">
              <input type="number" min={1} className={inputClass} value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Draw order">
              <input type="number" min={1} className={inputClass} value={editing.orderIndex}
                onChange={(e) => setEditing({ ...editing, orderIndex: Number(e.target.value) })} />
            </Field>
            <Field label="Donated by" hint="Optional.">
              <select className={inputClass} value={editing.sponsorId ?? ''}
                onChange={(e) => setEditing({ ...editing, sponsorId: e.target.value || undefined })}>
                <option value="">No sponsor</option>
                {sponsors.filter((s) => !s.isPlaceholder).map((s) =>
                  <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Add prize' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Gift} title="Lucky draw"
        subtitle="Prizes for the closing draw. The wheel only ever draws from attendees who were actually scanned in."
        action={{ label: 'New prize', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <Field label="Event">
          <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {mine.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400 italic">No prizes for this event yet.</p>
        )}
        {mine.map((p) => {
          const won = p.wonBy ?? [];
          const sponsor = sponsors.find((s) => s.id === p.sponsorId);
          return (
            <div key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                {p.orderIndex}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{p.name}</div>
                <div className="text-[11px] text-slate-500">
                  {won.length}/{p.quantity} drawn
                  {sponsor && ` · donated by ${sponsor.name}`}
                </div>
                {won.length > 0 && (
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Won by {won.map((w) =>
                      profiles.find((x) => x.id === w.userId)?.fullName ?? 'Unknown').join(', ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { setEditing({ ...p }); setIsNew(false); setError(null); }}
                        className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 cursor-pointer" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <ConfirmDelete onConfirm={() => onDelete(p.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ spend
export const AdminCosts: React.FC<{
  costs: CostEntry[];
  events: EventConfig[];
  currentUser: UserProfile;
  onSave: (entry: CostEntry, isNew: boolean) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}> = ({ costs, events, currentUser, onSave, onDelete }) => {
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [editing, setEditing] = useState<CostEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(
    () => costs.filter((c) => c.eventId === eventId),
    [costs, eventId]);

  const currency = mine[0]?.currency ?? 'KRW';

  const totals = useMemo(() => {
    const budget = mine.reduce((s, c) => s + c.budgetedMinor, 0);
    const actual = mine.reduce((s, c) => s + c.actualMinor, 0);
    const byCategory = COST_CATEGORIES
      .map((cat) => ({
        cat,
        budget: mine.filter((c) => c.category === cat).reduce((s, c) => s + c.budgetedMinor, 0),
        actual: mine.filter((c) => c.category === cat).reduce((s, c) => s + c.actualMinor, 0),
      }))
      .filter((x) => x.budget || x.actual)
      .sort((a, b) => b.actual - a.actual);
    return { budget, actual, variance: budget - actual, byCategory };
  }, [mine]);

  const blank = (): CostEntry => ({
    id: `cost-${Date.now()}`, eventId, label: '', category: 'Catering',
    budgetedMinor: 0, actualMinor: 0, currency,
    recordedBy: currentUser.id, recordedAt: new Date().toLocaleDateString(),
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.label.trim()) { setError('The line needs a label.'); return; }
    try { await onSave(editing, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New cost line' : `Editing: ${editing.label || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="What is this for"><input className={inputClass} value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="Day 1 lunch — 180 covers" /></Field>
            <Field label="Category">
              <select className={inputClass} value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as CostCategory })}>
                {COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Budgeted" hint={`In ${editing.currency}.`}>
              <input type="number" min={0} className={inputClass} value={editing.budgetedMinor}
                onChange={(e) => setEditing({ ...editing, budgetedMinor: Number(e.target.value) })} />
            </Field>
            <Field label="Actual" hint="Leave at 0 until invoiced.">
              <input type="number" min={0} className={inputClass} value={editing.actualMinor}
                onChange={(e) => setEditing({ ...editing, actualMinor: Number(e.target.value) })} />
            </Field>
            <Field label="Currency">
              <select className={inputClass} value={editing.currency}
                onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                {['KRW', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Note" hint="Optional — supplier, quote reference, anything worth remembering.">
            <input className={inputClass} value={editing.note ?? ''}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          </Field>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Add line' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Wallet} title="Event spend"
        subtitle="Budgeted against actual. Visible to event managers and admins only — what an event cost is an internal matter."
        action={{ label: 'New line', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <Field label="Event">
          <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
      </div>

      {mine.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Budgeted', value: totals.budget, tone: 'text-slate-900' },
              { label: 'Actual', value: totals.actual, tone: 'text-slate-900' },
              {
                label: totals.variance >= 0 ? 'Under budget' : 'Over budget',
                value: Math.abs(totals.variance),
                tone: totals.variance >= 0 ? 'text-emerald-700' : 'text-amber-700',
                icon: totals.variance >= 0 ? TrendingDown : TrendingUp,
              },
            ].map(({ label, value, tone, icon: Icon }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </div>
                <div className={`text-xl font-bold mt-1 ${tone}`}>{formatMoney(value, currency)}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h4 className="text-sm font-bold text-slate-800 mb-3">By category</h4>
            <div className="space-y-2.5">
              {totals.byCategory.map(({ cat, budget, actual }) => {
                const pct = totals.actual ? Math.round((actual / totals.actual) * 100) : 0;
                const over = actual > budget && budget > 0;
                return (
                  <div key={cat}>
                    <div className="flex items-baseline justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{cat}</span>
                      <span className={over ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                        {formatMoney(actual, currency)}
                        <span className="text-slate-400"> of {formatMoney(budget, currency)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${over ? 'bg-amber-600' : 'bg-blue-600'}`}
                           style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {mine.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400 italic">
            No spend recorded for this event yet.
          </p>
        )}
        {mine.map((c) => {
          const over = c.actualMinor > c.budgetedMinor && c.budgetedMinor > 0;
          return (
            <div key={c.id} className="p-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{c.label}</div>
                <div className="text-[11px] text-slate-500">
                  {c.category}{c.note ? ` · ${c.note}` : ''} · recorded {c.recordedAt}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${over ? 'text-amber-700' : 'text-slate-900'}`}>
                  {formatMoney(c.actualMinor, c.currency)}
                </div>
                <div className="text-[11px] text-slate-400">
                  budget {formatMoney(c.budgetedMinor, c.currency)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { setEditing({ ...c }); setIsNew(false); setError(null); }}
                        className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 cursor-pointer" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <ConfirmDelete onConfirm={() => onDelete(c.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
