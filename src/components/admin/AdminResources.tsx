import React, { useState } from 'react';
import { DoorOpen, UtensilsCrossed, Handshake, Pencil, X, Plus } from 'lucide-react';
import {
  Room, MealService, Sponsor, SponsorTier, MealOption, DietaryTag,
  SPONSOR_TIER_ORDER,
} from '../../types';
import { DIETARY_META } from '../../lib/dietary';
import {
  Field, inputClass, Notice, SectionHeader, ConfirmDelete,
  toMinutes, toDisplayTime, toInputTime,
} from './formKit';

/* ============================================================================
   Rooms, dining and sponsors.
   Simpler CRUD than the programme, so they share this file rather than three
   near-identical ones.
   ========================================================================= */

// ------------------------------------------------------------------- rooms
export const AdminRooms: React.FC<{
  rooms: Room[];
  sessions: { roomId: string; maxAttendees: number; title: string }[];
  onSave: (room: Room, isNew: boolean) => Promise<void> | void;
  onDelete: (roomId: string) => Promise<void> | void;
}> = ({ rooms, sessions, onSave, onDelete }) => {
  const [editing, setEditing] = useState<Room | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blank = (): Room => ({
    id: `room-${Date.now()}`, name: '', capacity: 30, floorLabel: '', building: '',
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError('The room needs a name.'); return; }
    if (editing.capacity < 1) { setError('Capacity must be at least 1.'); return; }

    // Shrinking a room below a session already booked into it would create a
    // silently oversubscribed session, so refuse and name the offender.
    const tooBig = sessions.find(
      (s) => s.roomId === editing.id && s.maxAttendees > editing.capacity);
    if (tooBig) {
      setError(`"${tooBig.title}" is set to seat ${tooBig.maxAttendees} in this room. Lower that session first.`);
      return;
    }
    try { await onSave(editing, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New room' : `Editing: ${editing.name || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Room name"><input className={inputClass} value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Main Theater" /></Field>
            <Field label="Capacity"><input type="number" min={1} className={inputClass} value={editing.capacity}
              onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Floor / level"><input className={inputClass} value={editing.floorLabel}
              onChange={(e) => setEditing({ ...editing, floorLabel: e.target.value })}
              placeholder="Level 1" /></Field>
            <Field label="Building"><input className={inputClass} value={editing.building ?? ''}
              onChange={(e) => setEditing({ ...editing, building: e.target.value })}
              placeholder="Performing Arts Center" /></Field>
          </div>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Add room' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={DoorOpen} title="Rooms"
        subtitle={`${rooms.length} spaces. Capacity here caps what any session in the room may seat.`}
        action={{ label: 'New room', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {rooms.map((r) => {
          const used = sessions.filter((s) => s.roomId === r.id).length;
          return (
            <div key={r.id} className="p-4 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{r.name}</div>
                <div className="text-[11px] text-slate-500">
                  {[r.building, r.floorLabel].filter(Boolean).join(' · ')} · {r.capacity} seats · {used} session{used === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { setEditing({ ...r }); setIsNew(false); setError(null); }}
                        className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 cursor-pointer" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <ConfirmDelete onConfirm={() => onDelete(r.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ dining
export const AdminDining: React.FC<{
  mealServices: MealService[];
  onSave: (service: MealService, isNew: boolean) => Promise<void> | void;
  onDelete: (serviceId: string) => Promise<void> | void;
}> = ({ mealServices, onSave, onDelete }) => {
  const [editing, setEditing] = useState<MealService | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blank = (): MealService => ({
    id: `meal-${Date.now()}`, name: '', type: 'lunch', day: 1, dateStr: '',
    startTime: '12:00 PM', endTime: '01:15 PM', startMinutes: 720, endMinutes: 795,
    location: '', options: [], selections: {},
  });

  const setOption = (i: number, patch: Partial<MealOption>) =>
    setEditing((s) => s ? {
      ...s, options: s.options.map((o, idx) => idx === i ? { ...o, ...patch } : o),
    } : s);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError('The service needs a name.'); return; }
    if (editing.options.length === 0) { setError('Add at least one meal option.'); return; }
    if (editing.options.some((o) => !o.label.trim())) { setError('Every option needs a label.'); return; }
    try { await onSave(editing, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New meal service' : `Editing: ${editing.name || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Service name"><input className={inputClass} value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Day 1 Lunch" /></Field>
            <Field label="Type">
              <select className={inputClass} value={editing.type}
                      onChange={(e) => setEditing({ ...editing, type: e.target.value as MealService['type'] })}>
                {(['breakfast', 'lunch', 'snack', 'reception'] as const).map((x) =>
                  <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Day">
              <select className={inputClass} value={editing.day}
                      onChange={(e) => setEditing({ ...editing, day: Number(e.target.value) })}>
                <option value={1}>Day 1</option><option value={2}>Day 2</option><option value={3}>Day 3</option>
              </select>
            </Field>
            <Field label="Starts"><input type="time" className={inputClass} value={toInputTime(editing.startTime)}
              onChange={(e) => { const d = toDisplayTime(e.target.value);
                setEditing({ ...editing, startTime: d, startMinutes: toMinutes(d) }); }} /></Field>
            <Field label="Ends"><input type="time" className={inputClass} value={toInputTime(editing.endTime)}
              onChange={(e) => { const d = toDisplayTime(e.target.value);
                setEditing({ ...editing, endTime: d, endMinutes: toMinutes(d) }); }} /></Field>
          </div>
          <Field label="Location"><input className={inputClass} value={editing.location}
            onChange={(e) => setEditing({ ...editing, location: e.target.value })}
            placeholder="Dining Commons — Main Hall" /></Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Options</span>
              <button
                onClick={() => setEditing({ ...editing, options: [...editing.options, {
                  id: `opt-${Date.now()}`, label: '', dietary: 'western', description: '',
                }] })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-600 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add option
              </button>
            </div>
            <div className="space-y-3">
              {editing.options.map((o, i) => (
                <div key={o.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Label"><input className={inputClass} value={o.label}
                      onChange={(e) => setOption(i, { label: e.target.value })}
                      placeholder="Vegetarian Plate" /></Field>
                    <Field label="Dietary tag">
                      <select className={inputClass} value={o.dietary}
                              onChange={(e) => setOption(i, { dietary: e.target.value as DietaryTag })}>
                        {(Object.keys(DIETARY_META) as DietaryTag[]).map((d) =>
                          <option key={d} value={d}>{DIETARY_META[d].label}</option>)}
                      </select>
                    </Field>
                    <Field label="Max servings" hint="Blank means unlimited.">
                      <input type="number" min={1} className={inputClass} value={o.maxServings ?? ''}
                        onChange={(e) => setOption(i, {
                          maxServings: e.target.value ? Number(e.target.value) : undefined })} />
                    </Field>
                  </div>
                  <Field label="Description"><input className={inputClass} value={o.description}
                    onChange={(e) => setOption(i, { description: e.target.value })} /></Field>
                  <button
                    onClick={() => setEditing({ ...editing, options: editing.options.filter((_, x) => x !== i) })}
                    className="text-xs font-semibold text-slate-400 hover:text-amber-700 cursor-pointer"
                  >
                    Remove this option
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Add service' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={UtensilsCrossed} title="Dining"
        subtitle={`${mealServices.length} services. Attendee selections are preserved when you edit a service.`}
        action={{ label: 'New service', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {mealServices.map((m) => (
          <div key={m.id} className="p-4 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900">{m.name}</div>
              <div className="text-[11px] text-slate-500">
                Day {m.day} · {m.startTime}–{m.endTime} · {m.location} · {m.options.length} options ·{' '}
                {Object.keys(m.selections).length} chosen
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => { setEditing({ ...m }); setIsNew(false); setError(null); }}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 cursor-pointer" title="Edit">
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <ConfirmDelete onConfirm={() => onDelete(m.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- sponsors
export const AdminSponsors: React.FC<{
  sponsors: Sponsor[];
  onSave: (sponsor: Sponsor, isNew: boolean) => Promise<void> | void;
  onDelete: (sponsorId: string) => Promise<void> | void;
}> = ({ sponsors, onSave, onDelete }) => {
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blank = (): Sponsor => ({
    id: `spon-${Date.now()}`, name: '', tier: 'Gold', tagline: '', description: '', websiteUrl: '',
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError('The sponsor needs a name.'); return; }
    try { await onSave(editing, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New sponsor' : `Editing: ${editing.name || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Organisation name"><input className={inputClass} value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Tier" hint="Prominence on the public page falls with the tier.">
              <select className={inputClass} value={editing.tier}
                      onChange={(e) => setEditing({ ...editing, tier: e.target.value as SponsorTier })}>
                {SPONSOR_TIER_ORDER.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tagline"><input className={inputClass} value={editing.tagline ?? ''}
            onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
            placeholder="Premier Platinum Sponsor" /></Field>
          <Field label="Description"><textarea className={`${inputClass} resize-none`} rows={2}
            value={editing.description ?? ''}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Website"><input className={inputClass} value={editing.websiteUrl ?? ''}
            onChange={(e) => setEditing({ ...editing, websiteUrl: e.target.value })}
            placeholder="https://" /></Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="accent-blue-600" checked={Boolean(editing.isPremier)}
                onChange={(e) => setEditing({ ...editing, isPremier: e.target.checked })} />
              Premier (largest treatment within the tier)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="accent-blue-600" checked={Boolean(editing.isPlaceholder)}
                onChange={(e) => setEditing({ ...editing, isPlaceholder: e.target.checked })} />
              Open slot (shown as an invitation)
            </label>
          </div>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Add sponsor' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Handshake} title="Sponsors"
        subtitle={`${sponsors.length} entries across ${new Set(sponsors.map((s) => s.tier)).size} tiers.`}
        action={{ label: 'New sponsor', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />
      {SPONSOR_TIER_ORDER.map((tier) => {
        const list = sponsors.filter((s) => s.tier === tier);
        if (!list.length) return null;
        return (
          <div key={tier} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wide">
              {tier} · {list.length}
            </div>
            <div className="divide-y divide-slate-100">
              {list.map((s) => (
                <div key={s.id} className="p-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {s.name}
                      {s.isPremier && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-600 text-white">Premier</span>}
                      {s.isPlaceholder && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-300">Open slot</span>}
                    </div>
                    {s.tagline && <div className="text-[11px] text-slate-500">{s.tagline}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => { setEditing({ ...s }); setIsNew(false); setError(null); }}
                            className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 cursor-pointer" title="Edit">
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <ConfirmDelete onConfirm={() => onDelete(s.id)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
