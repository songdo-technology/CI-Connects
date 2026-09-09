import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { EventConfig, eventStatus } from '../types';

interface EventCalendarProps {
  events: EventConfig[];
  onOpenEvent: (slug: string) => void;
}

/**
 * A year of events on a month grid.
 *
 * Multi-day events are drawn on every day they span rather than only their
 * start, because someone scanning October for a free Saturday needs to see
 * that the 16th is taken too.
 *
 * Colour is by status, not by category: on a calendar the question is "can I
 * still get into this", and a category palette would say nothing about that
 * while spending every hue. Each entry also carries a text label, so status is
 * never conveyed by colour alone.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_STYLE = {
  live:     { dot: '#5e6513', label: 'Now' },
  upcoming: { dot: '#2a6791', label: 'Upcoming' },
  past:     { dot: '#94a3b8', label: 'Done' },
} as const;

/** Local-date key, avoiding the UTC shift that toISOString introduces. */
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const EventCalendar: React.FC<EventCalendarProps> = ({ events, onOpenEvent }) => {
  const today = new Date();

  // Open on the month of the next thing happening, not on today — an empty
  // grid is a worse first impression than a populated one a month away.
  const [cursor, setCursor] = useState(() => {
    const next = events
      .filter((e) => eventStatus(e) !== 'past')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const d = next ? new Date(next.startDate + 'T00:00:00') : today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  /** Every day an event occupies, mapped to the events on it. */
  const byDay = useMemo(() => {
    const map = new Map<string, EventConfig[]>();
    for (const e of events) {
      if (!e.startDate || !e.endDate) continue;
      const start = new Date(e.startDate + 'T00:00:00');
      const end = new Date(e.endDate + 'T00:00:00');
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = key(d);
        map.set(k, [...(map.get(k) ?? []), e]);
      }
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Monday-first, which is how a school week is read.
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthEvents = useMemo(() => {
    const seen = new Set<string>();
    return grid
      .filter((d): d is Date => d !== null)
      .flatMap((d) => byDay.get(key(d)) ?? [])
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  }, [grid, byDay]);

  const shift = (by: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + by, 1));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shift(-1)} aria-label="Previous month"
                  className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-600 transition-colors cursor-pointer">
            Today
          </button>
          <button onClick={() => shift(1)} aria-label="Next month"
                  className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DOW.map((d) => (
            <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const on = byDay.get(key(d)) ?? [];
            const isToday = key(d) === key(today);
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg border p-1 flex flex-col ${
                  isToday ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100'
                }`}
              >
                <div className={`text-[11px] leading-none mb-0.5 ${
                  isToday ? 'font-bold text-blue-700' : 'text-slate-400'
                }`}>
                  {d.getDate()}
                </div>
                <div className="flex-1 min-h-0 space-y-0.5 overflow-hidden">
                  {on.slice(0, 2).map((e) => {
                    const style = STATUS_STYLE[eventStatus(e)];
                    return (
                      <button
                        key={e.id}
                        onClick={() => onOpenEvent(e.slug)}
                        title={`${e.name} — ${style.label}`}
                        className="w-full flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: style.dot }} />
                        <span className="text-[9px] text-slate-600 truncate leading-tight">
                          {e.shortName}
                        </span>
                      </button>
                    );
                  })}
                  {on.length > 2 && (
                    <div className="text-[9px] text-slate-400 px-1">+{on.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {monthEvents.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          {monthEvents.map((e) => {
            const style = STATUS_STYLE[eventStatus(e)];
            return (
              <button
                key={e.id}
                onClick={() => onOpenEvent(e.slug)}
                className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: style.dot }} />
                <span className="text-sm font-semibold text-slate-800 truncate flex-1">{e.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                  {style.label}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{e.dateLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
