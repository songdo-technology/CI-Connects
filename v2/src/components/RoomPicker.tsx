import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Facility, Room } from '../lib/types';
import { roomLabel, roomWhere, facilityLabel, facilityWhere, searchFacilities, norm } from '../lib/rooms';

export type RoomChoice = { room: Room } | { facility: Facility };

const Item: React.FC<{ active: boolean; label: string; where?: string; onPick: () => void }> = ({ active, label, where, onPick }) => (
  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick}
    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 ${active ? 'bg-blue-50' : 'hover:bg-sand-100'}`}>
    <span className="text-sm font-semibold text-ink-900 truncate">{label}</span>
    {where && <span className="text-[11px] text-ink-500 truncate ml-auto shrink-0 max-w-[55%]">{where}</span>}
  </button>
);

/**
 * Where a session happens, found by typing: the rooms already in this
 * event first, then every room on campus by its number or name. Choosing
 * a campus room hands it back so the event can adopt it.
 */
export const RoomPicker: React.FC<{ rooms: Room[]; facilities: Facility[]; value: string; onChoose: (c: RoomChoice) => void }> = ({ rooms, facilities, value, onChoose }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const selected = rooms.find((r) => r.id === value);
  const inEvent = useMemo(() => {
    const t = norm(q);
    return rooms.filter((r) => !t || norm(roomLabel(r)).includes(t)).slice(0, 8);
  }, [rooms, q]);
  const campus = useMemo(() => {
    const taken = new Set(rooms.map((r) => r.facilityId).filter(Boolean));
    return searchFacilities(facilities, q, 10).filter((f) => !taken.has(f.id));
  }, [facilities, rooms, q]);
  const options: RoomChoice[] = [...inEvent.map((room) => ({ room })), ...campus.map((facility) => ({ facility }))];
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const choose = (c: RoomChoice) => { onChoose(c); setOpen(false); setQ(''); };
  return (
    <div ref={box} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input className="input pl-9" value={open ? q : selected ? roomLabel(selected) : ''} placeholder="Number or name — B-201, Library, Main Theater…"
          onFocus={() => { setOpen(true); setQ(''); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, Math.max(options.length - 1, 0))); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (options[hi]) choose(options[hi]); }
            else if (e.key === 'Escape') setOpen(false);
          }} />
      </div>
      {selected && !open && roomWhere(selected) && <div className="text-[11px] text-ink-500 mt-1 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{roomWhere(selected)}</div>}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 card p-1 max-h-72 overflow-y-auto shadow-[var(--shadow-pop)]">
          {options.length === 0 && <div className="px-3 py-2 text-sm text-ink-500">{q ? 'Nothing matches — try the number on the door, or part of the name.' : 'Type a room number or name.'}</div>}
          {inEvent.length > 0 && <div className="eyebrow px-3 pt-2 pb-1">In this event</div>}
          {inEvent.map((r, i) => <Item key={r.id} active={hi === i} label={roomLabel(r)} where={roomWhere(r)} onPick={() => choose({ room: r })} />)}
          {campus.length > 0 && <div className="eyebrow px-3 pt-2 pb-1">On campus</div>}
          {campus.map((f, j) => <Item key={f.id} active={hi === inEvent.length + j} label={facilityLabel(f)} where={facilityWhere(f)} onPick={() => choose({ facility: f })} />)}
        </div>
      )}
    </div>
  );
};
