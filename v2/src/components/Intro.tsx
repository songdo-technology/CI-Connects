import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { reducedMotion } from '../lib/motion';

// Wall-clock time drives the launch even when frames are scarce (a background
// tab, a throttled preview); otherwise GSAP pads each slow frame and the
// sequence crawls. The portfolio does the same.
gsap.ticker.lagSmoothing(0);

/**
 * The launch.
 *
 * Twelve people arrive from everywhere and take their places around one
 * centre; the ring draws itself; the name lands. Then the mark flies to
 * where the logo lives and the curtain lifts on the site underneath. Once
 * per browser session, and a click or Escape ends it early.
 */
const KEY = 'ci2:intro';
let done = (() => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } })();
const listeners = new Set<() => void>();

/** True once the launch has played (or was skipped, or never applied). */
export const useIntroDone = () => {
  const [v, setV] = useState(done || reducedMotion());
  useEffect(() => { const f = () => setV(true); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return v;
};
const finish = () => { done = true; try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } listeners.forEach((f) => f()); };

const N = 12; const R = 70; const C = 160;
const TARGETS = Array.from({ length: N }, (_, i) => {
  const a = (((360 / N) * i - 90) * Math.PI) / 180;
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
});

export const Intro: React.FC = () => {
  const [show, setShow] = useState(() => !done && !reducedMotion());
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!show) { if (!done) finish(); return; }
    const el = root.current, s = svg.current;
    if (!el || !s) return;
    const dots = s.querySelectorAll<SVGCircleElement>('.dot');
    const pings = s.querySelectorAll<SVGCircleElement>('.ping');
    const spokes = s.querySelectorAll<SVGLineElement>('.spoke');
    const ring = s.querySelector<SVGCircleElement>('.ring');
    const disc = s.querySelector<SVGGElement>('.disc');
    const titles = el.querySelectorAll<HTMLElement>('.t');
    const line = el.querySelector<HTMLElement>('.line');
    const tag = el.querySelector<HTMLElement>('.tag');
    const mark = el.querySelector<HTMLElement>('.mark');
    if (!ring || !disc || !line || !tag || !mark) return;

    // Scatter: every dot starts far out, on its own bearing.
    dots.forEach((d) => {
      const ang = Math.random() * Math.PI * 2; const dist = 240 + Math.random() * 260;
      gsap.set(d, { attr: { cx: C + Math.cos(ang) * dist, cy: C + Math.sin(ang) * dist, r: 0.5 }, opacity: 0 });
    });
    const circ = 2 * Math.PI * R;
    gsap.set(ring, { strokeDasharray: circ, strokeDashoffset: circ });
    gsap.set(disc, { scale: 0, svgOrigin: `${C} ${C}` });
    gsap.set(spokes, { opacity: 0 });
    gsap.set(titles, { yPercent: 115 });
    gsap.set(line, { scaleX: 0 });
    gsap.set(tag, { opacity: 0, y: 8 });

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    dots.forEach((d, i) => tl.to(d, { attr: { cx: TARGETS[i].x, cy: TARGETS[i].y, r: 6 }, opacity: 1, duration: 1.15 }, 0.15 + i * 0.05));
    pings.forEach((p, i) => tl.fromTo(p, { attr: { r: 6 }, opacity: 0.8 }, { attr: { r: 30 }, opacity: 0, duration: 0.8, ease: 'power2.out' }, 1.0 + i * 0.05));
    tl.to(disc, { scale: 1, duration: 1.0, ease: 'back.out(1.7)' }, 0.55);
    tl.to(ring, { strokeDashoffset: 0, duration: 1.1 }, 1.0);
    tl.to(spokes, { opacity: 0.3, duration: 0.5, stagger: 0.02 }, 1.5);
    tl.to(titles, { yPercent: 0, duration: 0.9, stagger: 0.14 }, 1.7);
    tl.to(line, { scaleX: 1, duration: 0.8 }, 1.95);
    tl.to(tag, { opacity: 1, y: 0, duration: 0.7 }, 2.3);

    // Launch: the mark takes the logo's place, the words step aside, the
    // curtain lifts on the page that was there all along.
    tl.add(() => {
      const nav = document.querySelector('[data-nav-mark]') as HTMLElement | null;
      if (!nav) return;
      const a = mark.getBoundingClientRect(), b = nav.getBoundingClientRect();
      gsap.to(mark, {
        x: b.left + b.width / 2 - (a.left + a.width / 2),
        y: b.top + b.height / 2 - (a.top + a.height / 2),
        scale: b.width / a.width, duration: 1.05, ease: 'expo.inOut',
      });
    }, 3.3);
    tl.to([...titles, line, tag], { opacity: 0, y: -12, duration: 0.45, ease: 'power2.in' }, 3.3);
    tl.to(el, { backgroundColor: 'rgba(0, 21, 39, 0)', duration: 1.0, ease: 'expo.inOut' }, 3.45);
    tl.to(mark, { opacity: 0, duration: 0.25 }, 4.2);
    tl.add(() => { finish(); setShow(false); }, 4.45);

    const skip = () => tl.progress(1);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') skip(); };
    el.addEventListener('click', skip);
    window.addEventListener('keydown', onKey);
    // Whatever happens to the frames, the site opens within six seconds.
    const guard = window.setTimeout(() => { if (!done) { finish(); setShow(false); } }, 6000);
    return () => { tl.kill(); window.clearTimeout(guard); el.removeEventListener('click', skip); window.removeEventListener('keydown', onKey); };
  }, [show]);

  if (!show) return null;
  return (
    <div ref={root} className="intro" role="presentation" aria-hidden="true">
      <div className="intro__stage">
        <div className="mark">
          <svg ref={svg} viewBox="0 0 320 320" className="w-[min(58vw,20rem)] h-auto overflow-visible">
            {TARGETS.map((t, i) => <line key={`s${i}`} className="spoke" x1={C} y1={C} x2={t.x} y2={t.y} stroke="#ACD4F1" strokeWidth="1" />)}
            <circle className="ring" cx={C} cy={C} r={R} fill="none" stroke="#ACD4F1" strokeOpacity="0.55" strokeWidth="1.5" />
            {TARGETS.map((t, i) => <circle key={`p${i}`} className="ping" cx={t.x} cy={t.y} r="6" fill="none" stroke="#ACD4F1" strokeWidth="1.5" opacity="0" />)}
            {TARGETS.map((_, i) => <circle key={`d${i}`} className="dot" cx={C} cy={C} r="6" fill="#ACD4F1" />)}
            <g className="disc">
              <circle cx={C} cy={C} r="46" fill="rgba(255,255,255,0.1)" />
              <circle cx={C} cy={C} r="38" fill="#ffffff" />
              <circle cx={C} cy={C} r="13" fill="#002B54" />
            </g>
          </svg>
        </div>
        <div className="intro__title">
          <span className="clip"><span className="t">CI</span></span>
          <span className="line" />
          <span className="clip"><span className="t">Connects</span></span>
        </div>
        <div className="tag">Chadwick International · Events</div>
      </div>
    </div>
  );
};
