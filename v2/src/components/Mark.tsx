import React from 'react';

/** The CI Connects mark: one centre, a ring of people. Navy on light
 *  surfaces; white on navy when `light` is set. */
export const Mark: React.FC<{ size?: number; className?: string; light?: boolean; navTarget?: boolean }> = ({ size = 32, className = '', light, navTarget }) => {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    return { x: 32 + 19 * Math.cos(a), y: 32 + 19 * Math.sin(a) };
  });
  const bg = light ? '#ffffff' : '#002B54';
  const ring = light ? '#002B54' : '#ACD4F1';
  const centre = light ? '#002B54' : '#ffffff';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden="true" data-nav-mark={navTarget ? '' : undefined}>
      <circle cx="32" cy="32" r="30" fill={bg} />
      <circle cx="32" cy="32" r="19" fill="none" stroke={ring} strokeOpacity="0.45" strokeWidth="1.2" />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="2.7" fill={ring} />)}
      <circle cx="32" cy="32" r="9.5" fill={centre} />
    </svg>
  );
};

export const Wordmark: React.FC<{ light?: boolean; subtitle?: string; size?: number; navTarget?: boolean }> = ({ light, subtitle = 'Chadwick International', size = 34, navTarget }) => (
  <span className="flex items-center gap-2.5 min-w-0">
    <Mark size={size} light={light} navTarget={navTarget} />
    <span className="leading-tight min-w-0">
      <span className={`block font-display font-bold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>CI Connects</span>
      {subtitle && <span className={`block text-[11px] ${light ? 'text-white/60' : 'text-ink-500'}`}>{subtitle}</span>}
    </span>
  </span>
);
