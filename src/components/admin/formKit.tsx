import React from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

/**
 * Shared form primitives for the admin editors.
 *
 * Four editors — programme, rooms, dining, sponsors — with the same shape of
 * work. Keeping the field chrome here means a change to how a label or an
 * error reads happens once rather than four times, and the editors stay short
 * enough to read as domain logic rather than markup.
 */

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ' +
  'disabled:bg-slate-50 disabled:text-slate-400';

export const Field: React.FC<{
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, className = '', children }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{hint}</p>}
  </div>
);

export const Notice: React.FC<{ tone?: 'warn' | 'info'; children: React.ReactNode }> = ({
  tone = 'warn', children,
}) => (
  <div className={`flex items-start gap-2 px-3.5 py-3 rounded-lg border ${
    tone === 'warn'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-blue-50 border-blue-200 text-blue-900'
  }`}>
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
    <div className="text-xs leading-relaxed">{children}</div>
  </div>
);

export const SectionHeader: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, subtitle, action }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-500 leading-relaxed">{subtitle}</p>}
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        {action.label}
      </button>
    )}
  </div>
);

/** Delete control that asks once. Destructive actions in an admin console are
 *  the ones most worth a deliberate second beat. */
export const ConfirmDelete: React.FC<{
  onConfirm: () => void;
  label?: string;
}> = ({ onConfirm, label = 'Delete' }) => {
  const [armed, setArmed] = React.useState(false);
  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        title={label}
        className="p-2 rounded-lg border border-slate-200 hover:border-amber-600 transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => { onConfirm(); setArmed(false); }}
        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
      >
        Confirm
      </button>
      <button
        onClick={() => setArmed(false)}
        className="px-2 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
};

/** Minutes-from-midnight for a "09:00 AM" style string, so times entered in
 *  the editor stay sortable and comparable for clash detection. */
export function toMinutes(display: string): number {
  const m = display.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return 0;
  let h = Number(m[1]);
  const mins = Number(m[2]);
  const suffix = m[3]?.toUpperCase();
  if (suffix === 'PM' && h !== 12) h += 12;
  if (suffix === 'AM' && h === 12) h = 0;
  return h * 60 + mins;
}

/** "14:30" (what <input type="time"> gives) to "02:30 PM" (what the app shows). */
export function toDisplayTime(value24: string): string {
  const [hStr, mStr] = value24.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${mStr} ${suffix}`;
}

/** The inverse, for populating <input type="time"> from stored display text. */
export function toInputTime(display: string): string {
  const mins = toMinutes(display);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
