import React, { useEffect, useRef, useState } from 'react';
import { Users, Building2, Globe2 } from 'lucide-react';

/**
 * What the name means, made literal.
 *
 * "CI Connects" is a claim, and a claim on a landing page is worth very little
 * unless you can see it. Three circles of connection — our own community, the
 * wider Chadwick family, the world — are drawn as one diagram that rearranges
 * itself as you move between them, so the three readings of the name are one
 * continuous idea rather than three slogans.
 *
 * It advances on its own until touched, then stops for good: someone who has
 * chosen a panel is reading it, and moving it out from under them is the whole
 * reason people dislike carousels.
 */

interface Mode {
  id: string;
  short: string;
  icon: React.ElementType;
  /** Completes the sentence "CI Connects…". */
  headline: string;
  body: string;
  /** How many satellites are drawn, and how far out they sit. */
  count: number;
  radius: number;
}

const MODES: Mode[] = [
  {
    id: 'each-other',
    short: 'with each other',
    icon: Users,
    headline: 'with each other',
    body: 'Every gathering starts at home — faculty, students and families finding '
      + 'each other across divisions, subjects and years.',
    count: 12,
    radius: 74,
  },
  {
    id: 'chadwick',
    short: 'with Chadwick Schools',
    icon: Building2,
    headline: 'with Chadwick Schools',
    body: 'Songdo and Palos Verdes share a founder, a mission and a set of values. '
      + 'Our events are where that becomes practice rather than history.',
    count: 4,
    radius: 108,
  },
  {
    id: 'world',
    short: 'with the global community',
    icon: Globe2,
    headline: 'with the global community',
    body: 'Educators, schools and partners from across Korea and around the world, '
      + 'convened here in Songdo.',
    count: 16,
    radius: 140,
  },
];

/** Every satellite slot that any mode can use, so nodes move rather than pop. */
const MAX_NODES = 16;
const CYCLE_MS = 5200;

export const ConnectsStatement: React.FC = () => {
  const [active, setActive] = useState(0);
  /** Set the moment someone chooses for themselves. Auto-advance never resumes. */
  const [taken, setTaken] = useState(false);

  const reducedMotion = useRef(
    typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ).current;

  useEffect(() => {
    if (taken || reducedMotion) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((i) => (i + 1) % MODES.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [taken, reducedMotion]);

  const mode = MODES[active];

  const choose = (i: number) => { setTaken(true); setActive(i); };

  return (
    <div className="w-full">
      {/* ---------- The diagram ---------- */}
      <div className="relative mx-auto w-full max-w-[22rem] aspect-square">
        <svg viewBox="0 0 320 320" className="w-full h-full" aria-hidden="true">
          <g transform="translate(160,160)">
            {/* Orbit guides: one per circle of connection, the active one lit. */}
            {MODES.map((m, i) => (
              <circle
                key={m.id}
                r={m.radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={i === active ? 1.5 : 1}
                className={`text-blue-200 transition-opacity duration-700 ${
                  i === active ? 'opacity-40' : 'opacity-10'
                }`}
                strokeDasharray={i === active ? undefined : '3 6'}
              />
            ))}

            {/* Spokes and satellites. Held in fixed slots and moved, so a change
                of circle reads as the same people stepping outward. */}
            {Array.from({ length: MAX_NODES }, (_, i) => {
              const shown = i < mode.count;
              const angle = (360 / mode.count) * i - 90;
              return (
                <g
                  key={i}
                  style={{
                    transform: `rotate(${angle}deg) translateX(${mode.radius}px)`,
                    transformOrigin: '0px 0px',
                    transition: 'transform 800ms cubic-bezier(.4,0,.2,1), opacity 500ms',
                    opacity: shown ? 1 : 0,
                  }}
                >
                  <circle r={5.5} className="fill-blue-200" />
                  <circle r={11} className="fill-blue-200/20" />
                </g>
              );
            })}

            {/* Lines drawn after the nodes so they sit under the centre disc. */}
            {Array.from({ length: MAX_NODES }, (_, i) => {
              const shown = i < mode.count;
              const angle = ((360 / mode.count) * i - 90) * (Math.PI / 180);
              return (
                <line
                  key={`l${i}`}
                  x1={0}
                  y1={0}
                  x2={Math.cos(angle) * mode.radius}
                  y2={Math.sin(angle) * mode.radius}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="text-blue-200"
                  style={{
                    opacity: shown ? 0.28 : 0,
                    transition: 'all 800ms cubic-bezier(.4,0,.2,1)',
                  }}
                />
              );
            })}

            <circle r={46} className="fill-white/10" />
            <circle r={38} className="fill-white" />
            <text
              textAnchor="middle"
              y={-2}
              className="fill-blue-600 font-bold"
              style={{ fontSize: '15px', letterSpacing: '-0.01em' }}
            >
              CI
            </text>
            <text
              textAnchor="middle"
              y={13}
              className="fill-blue-600 font-bold"
              style={{ fontSize: '11px' }}
            >
              Connects
            </text>
          </g>
        </svg>
      </div>

      {/* ---------- The sentence ---------- */}
      <div className="text-center mt-2">
        {/* Fixed height so the buttons below never jump between panels. */}
        <div className="min-h-[6.5rem]">
          <p className="text-lg sm:text-xl font-bold text-white mb-2">
            <span className="text-blue-200/70 font-normal">CI Connects </span>
            {mode.headline}
          </p>
          <p className="text-sm text-blue-100/75 leading-relaxed max-w-md mx-auto">
            {mode.body}
          </p>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-2 mt-4"
          role="tablist"
          aria-label="What CI Connects means"
        >
          {MODES.map((m, i) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => choose(i)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  i === active
                    ? 'bg-white text-blue-700 border-white'
                    : 'bg-white/5 text-blue-100 border-white/20 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
