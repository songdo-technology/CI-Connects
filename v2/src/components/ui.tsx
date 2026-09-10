import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { X, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button: React.FC<{
  variant?: Variant; size?: 'sm' | 'md'; to?: string; type?: 'button' | 'submit';
  onClick?: () => void; disabled?: boolean; className?: string; title?: string;
  children: React.ReactNode; busy?: boolean;
}> = ({ variant = 'primary', size = 'md', to, type = 'button', onClick, disabled, className = '', title, children, busy }) => {
  const cls = `btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`;
  if (to) return <Link to={to} className={cls} title={title}>{children}</Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={cls} title={title}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
};

export const Card: React.FC<{ className?: string; children: React.ReactNode; as?: 'div' | 'section' | 'article' }> =
  ({ className = '', children, as: Tag = 'div' }) => <Tag className={`card ${className}`}>{children}</Tag>;

export const PageHeader: React.FC<{
  eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; className?: string;
}> = ({ eyebrow, title, description, actions, className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 ${className}`}>
    <div className="min-w-0">
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">{title}</h1>
      {description && <p className="text-sm text-ink-500 mt-1.5 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'rose' | 'navy';
const TONE: Record<Tone, string> = {
  neutral: 'bg-sand-200 text-ink-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  rose: 'bg-rose-100 text-rose-800',
  navy: 'bg-blue-600 text-white',
};
export const Chip: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string; title?: string }> =
  ({ tone = 'neutral', children, className = '', title }) => <span title={title} className={`chip ${TONE[tone]} ${className}`}>{children}</span>;

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string; htmlFor?: string }> =
  ({ label, hint, children, className = '', htmlFor }) => (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-500 mt-1">{hint}</p>}
    </div>
  );

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...props} className={`input ${props.className ?? ''}`} />;
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...props} className={`input min-h-24 ${props.className ?? ''}`} />;
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...props} className={`input ${props.className ?? ''}`} />;

export const Empty: React.FC<{ icon?: React.ElementType; title: string; body?: string; action?: React.ReactNode }> =
  ({ icon: Icon, title, body, action }) => (
    <div className="card p-10 text-center">
      {Icon && <div className="w-11 h-11 rounded-xl bg-sand-100 border border-sand-200 inline-flex items-center justify-center mb-3"><Icon className="w-5 h-5 text-ink-500" /></div>}
      <h3 className="font-semibold text-ink-900">{title}</h3>
      {body && <p className="text-sm text-ink-500 mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

export const Notice: React.FC<{ tone?: 'info' | 'warn' | 'error' | 'success'; children: React.ReactNode; className?: string }> =
  ({ tone = 'info', children, className = '' }) => {
    const cls = {
      info: 'bg-blue-50 border-blue-200 text-blue-900',
      warn: 'bg-amber-50 border-amber-200 text-amber-900',
      error: 'bg-rose-50 border-rose-200 text-rose-900',
      success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    }[tone];
    return <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls} ${className}`}>{children}</div>;
  };

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div className="flex items-center justify-center py-16 text-ink-500 text-sm gap-2">
    <Loader2 className="w-4 h-4 animate-spin" /> {label}…
  </div>
);

export const Avatar: React.FC<{ name: string; photoUrl?: string; size?: number; className?: string }> =
  ({ name, photoUrl, size = 32, className = '' }) => {
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
    if (photoUrl) return <img src={photoUrl} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className={`rounded-full object-cover shrink-0 ${className}`} />;
    return (
      <div style={{ width: size, height: size, fontSize: size * 0.38 }}
           className={`rounded-full bg-blue-600 text-white font-semibold inline-flex items-center justify-center shrink-0 ${className}`}>
        {initials}
      </div>
    );
  };

/** A side panel for detail and forms. Closes on Escape and on the scrim. */
export const Drawer: React.FC<{ open: boolean; onClose: () => void; title?: string; children?: React.ReactNode; wide?: boolean }> =
  ({ open, onClose, title, children, wide }) => {
    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
        <div className={`relative h-full bg-white shadow-[var(--shadow-pop)] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} flex flex-col`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-sand-200">
            <h2 className="font-semibold text-ink-900 truncate">{title}</h2>
            <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </div>
    );
  };

export const Stat: React.FC<{ value: string | number; label: string; note?: string }> = ({ value, label, note }) => (
  <div className="card p-4">
    <div className="text-2xl font-bold tabular-nums text-ink-900 leading-none">{value}</div>
    <div className="text-xs font-semibold text-ink-700 mt-2">{label}</div>
    {note && <div className="text-[11px] text-ink-500 mt-0.5">{note}</div>}
  </div>
);

/** A row of tabs as links, for sub-navigation under a page header. */
export const SubNav: React.FC<{ items: { to: string; label: string; end?: boolean }[] }> = ({ items }) => (
  <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
    {items.map((it) => (
      <NavTab key={it.to} to={it.to} end={it.end}>{it.label}</NavTab>
    ))}
  </nav>
);

import { NavLink } from 'react-router';
const NavTab: React.FC<{ to: string; end?: boolean; children: React.ReactNode }> = ({ to, end, children }) => (
  <NavLink to={to} end={end}
    className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
      isActive ? 'bg-white text-blue-700 border border-sand-200 shadow-[var(--shadow-card)]' : 'text-ink-500 hover:text-ink-900 hover:bg-sand-200/70'}`}>
    {children}
  </NavLink>
);
