import React, { useEffect, useRef, useState } from 'react';
import { Users, Building2, Handshake, Globe2 } from 'lucide-react';

/**
 * What the name means, made literal — carried over from v1.
 *
 * Four circles of connection, drawn as one diagram that rearranges itself
 * as you move between them: the satellites step outward rather than
 * popping, so the readings of the name are one idea and not four slogans.
 * It advances on its own until touched, then stops for good.
 */
interface Mode {
  id: string; short: string; icon: React.ElementType; headline: string; body: string; count: number; radius: number;
}

export const MODES: Mode[] = [
  { id: 'each-other', short: 'Each other', icon: Users, headline: 'with each other',
    body: 'Every gathering starts at home — faculty, students and families finding each other across divisions, subjects and years.',
    count: 12, radius: 70 },
  { id: 'chadwick', short: 'Chadwick Schools', icon: Building2, headline: 'with Chadwick Schools',
    body: 'Songdo and Palos Verdes share a founder, a mission and a set of values. Our events are where that becomes practice rather than history.',
    count: 4, radius: 95 },
  { id: 'korea', short: 'Educators in Korea', icon: Handshake, headline: 'with educators across Korea',
    body: 'Schools across the country, and work with the Ministry of Education — workshops delivered alongside local teachers, and KORCOS convened here.',
    count: 10, radius: 120 },
  { id: 'world', short: 'The global community', icon: Globe2, headline: 'with the global community',
    body: 'And beyond that: educators, schools and partners from around the world, convened in Songdo.',
    count: 18, radius: 144 },
];

const MAX_NODES = 18;
const CYCLE_MS = 5200;

export const OrbitDiagram: React.FC<{ active: number; className?: string; label?: boolean }> = ({ active, className = '', label = true }) => {
  const mode = MODES[active];
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden="true">
      <g transform="translate(160,160)">
        {MODES.map((m, i) => (
          <circle key={m.id} r={m.radius} fill="none" stroke="currentColor" strokeWidth={i === active ? 1.5 : 1}
            className={`text-blue-200 transition-opacity duration-700 ${i === active ? 'opacity-40' : 'opacity-10'}`}
            strokeDasharray={i === active ? undefined : '3 6'} />
        ))}
        <g className="orbit-spin">
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="140s" repeatCount="indefinite" />
        {Array.from({ length: MAX_NODES }, (_, i) => {
          const shown = i < mode.count;
          const angle = (360 / mode.count) * i - 90;
          return (
            <g key={i} style={{ transform: `rotate(${angle}deg) translateX(${mode.radius}px)`, transformOrigin: '0px 0px',
              transition: 'transform 800ms cubic-bezier(.4,0,.2,1), opacity 500ms', opacity: shown ? 1 : 0 }}>
              <circle r={5.5} className="fill-blue-200" />
              <circle r={11} className="fill-blue-200/20" />
            </g>
          );
        })}
        {Array.from({ length: MAX_NODES }, (_, i) => {
          const shown = i < mode.count;
          const angle = ((360 / mode.count) * i - 90) * (Math.PI / 180);
          return (
            <line key={`l${i}`} x1={0} y1={0} x2={Math.cos(angle) * mode.radius} y2={Math.sin(angle) * mode.radius}
              stroke="currentColor" strokeWidth={1} className="text-blue-200"
              style={{ opacity: shown ? 0.28 : 0, transition: 'all 800ms cubic-bezier(.4,0,.2,1)' }} />
          );
        })}
        </g>
        <circle r={46} className="fill-white/10" />
        <circle r={38} className="fill-white" />
        {label && (
          <>
            <text textAnchor="middle" y={-2} className="fill-blue-600 font-display font-bold" style={{ fontSize: '15px', letterSpacing: '-0.01em' }}>CI</text>
            <text textAnchor="middle" y={13} className="fill-blue-600 font-display font-bold" style={{ fontSize: '11px' }}>Connects</text>
          </>
        )}
      </g>
    </svg>
  );
};

/** The diagram with its sentence and the four choices, on a dark ground. */
export const ConnectsOrbit: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [active, setActive] = useState(0);
  const [taken, setTaken] = useState(false);
  const reducedMotion = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches).current;

  useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => { if (!document.hidden) setActive((i) => (i + 1) % MODES.length); }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const mode = MODES[active];
  return (
    <div className="w-full">
      <div className={`relative mx-auto w-full aspect-square ${compact ? 'max-w-[15rem]' : 'max-w-[24rem]'}`}>
        <div className="absolute inset-[8%] rounded-full bg-blue-400/25 blur-3xl breathe" />
        <OrbitDiagram active={active} className="relative w-full h-full" />
      </div>
      <div className="text-center mt-2">
        <div className={compact ? 'min-h-[6rem]' : 'min-h-[7rem]'}>
          <p key={mode.id} className="text-xl sm:text-2xl font-display font-bold text-white mb-2 rise">
            <span className="text-blue-200/70 font-medium">CI Connects </span>{mode.headline}
          </p>
          <p key={`${mode.id}-b`} className="text-sm sm:text-[15px] text-blue-100/80 leading-relaxed max-w-md mx-auto rise d1">{mode.body}</p>
        </div>
        <div className="inline-flex flex-wrap justify-center gap-1 mt-4 p-1 rounded-full bg-white/10 border border-white/15" role="tablist" aria-label="What CI Connects means">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            return (
              <button key={m.id} role="tab" aria-selected={i === active} onClick={() => { setTaken(true); setActive(i); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                  i === active ? 'bg-white text-blue-700 shadow' : 'text-blue-100 hover:bg-white/10'}`}>
                <Icon className="w-3.5 h-3.5" />{m.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
