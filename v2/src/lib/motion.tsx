import React, { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { useLocation } from 'react-router';
import { Mark } from '../components/Mark';

/**
 * The feel of the thing — the same vocabulary as the portfolio site:
 * inertia scrolling, elements that rise as they arrive, a cursor that
 * answers, numbers that count, a marquee, a curtain on first load.
 * All of it steps aside for prefers-reduced-motion and for touch.
 */
export const reducedMotion = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
const finePointer = () => typeof window !== 'undefined' && (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false);

let lenis: Lenis | null = null;

/** Subscribe to scrolling however it happens — the window, or Lenis. */
export const onScroll = (cb: () => void): (() => void) => {
  window.addEventListener('scroll', cb, { passive: true });
  lenis?.on('scroll', cb);
  return () => { window.removeEventListener('scroll', cb); lenis?.off('scroll', cb); };
};

/** Smooth scrolling for the document, and back to the top on every route. */
export const MotionRoot: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (reducedMotion()) return;
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis?.destroy(); lenis = null; };
  }, []);
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/** Rises into place when it scrolls into view. With `stagger`, its children
 *  rise one after another instead. Visible from the start when motion is
 *  reduced or observers are unavailable. */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number; stagger?: number; style?: React.CSSProperties }> =
  ({ children, className = '', delay = 0, stagger, style }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(() => reducedMotion() || typeof IntersectionObserver === 'undefined');
    useEffect(() => {
      const el = ref.current; if (!el || inView) return;
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
      }, { rootMargin: '0px 0px -8% 0px' });
      io.observe(el);
      return () => io.disconnect();
    }, [inView]);
    const vars = { ...style, transitionDelay: delay ? `${delay}s` : undefined, ['--stagger' as string]: stagger != null ? `${stagger}s` : undefined } as React.CSSProperties;
    return (
      <div ref={ref} style={vars} className={`${stagger != null ? 'stagger' : 'fade-up'} ${inView ? 'in' : ''} ${className}`}>
        {children}
      </div>
    );
  };

/** A number that counts up to its value when it scrolls into view. */
export const CountUp: React.FC<{ value: number; duration?: number; className?: string; suffix?: string }> = ({ value, duration = 1.4, className, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const started = useRef(reducedMotion());
  useEffect(() => {
    const el = ref.current; if (!el || started.current) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || started.current) return;
      started.current = true; io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / (duration * 1000));
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);
  useEffect(() => { if (started.current) setShown(value); }, [value]);
  return <span ref={ref} className={className}>{shown}{suffix}</span>;
};

/** The route's content, arriving. Keyed on the part of the path that names
 *  the screen, so a layout's own chrome stays put while its pane changes. */
export const PageTransition: React.FC<{ children: React.ReactNode; depth?: number; className?: string }> = ({ children, depth, className = '' }) => {
  const { pathname } = useLocation();
  const key = depth ? pathname.split('/').slice(0, depth + 1).join('/') : pathname;
  return <div key={key} className={`page-in ${className}`}>{children}</div>;
};

/** A cursor that answers: a dot that trails the pointer, opens over anything
 *  clickable, and carries a word over elements with data-cursor. Desktop only. */
export const Cursor: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!finePointer() || reducedMotion()) return;
    const el = ref.current; if (!el) return;
    document.body.classList.add('has-cursor');
    let tx = -100, ty = -100, cx = -100, cy = -100, raf = 0;
    const move = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; el.style.opacity = '1'; };
    const loop = () => { cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18; el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`; raf = requestAnimationFrame(loop); };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      el.classList.toggle('is-link', Boolean(t.closest?.('a, button, [role="button"], select, input, textarea, label, summary')));
      const lab = t.closest?.('[data-cursor]') as HTMLElement | null;
      if (lab && labelRef.current) { labelRef.current.textContent = lab.dataset.cursor ?? ''; el.classList.add('is-label'); }
      else el.classList.remove('is-label');
    };
    const leave = () => { el.style.opacity = '0'; };
    const enter = () => { el.style.opacity = '1'; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', over);
    document.addEventListener('mouseleave', leave);
    document.addEventListener('mouseenter', enter);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseover', over);
      document.removeEventListener('mouseleave', leave); document.removeEventListener('mouseenter', enter);
      cancelAnimationFrame(raf); document.body.classList.remove('has-cursor');
    };
  }, []);
  return <div ref={ref} className="cursor" aria-hidden="true"><span ref={labelRef} /></div>;
};

/** Film grain over everything, faint. */
export const Grain: React.FC = () => <div className="grain" aria-hidden="true" />;

/** One line of words that never ends. */
export const Marquee: React.FC<{ items: string[]; className?: string }> = ({ items, className = '' }) => (
  <div className={`marquee ${className}`} aria-hidden="true">
    <div className="marquee__track">
      {[...items, ...items].map((t, i) => <span key={i}>{t}<i /></span>)}
    </div>
  </div>
);

/** The curtain: counts to a hundred and lifts. Once per browser session. */
export const Preloader: React.FC = () => {
  const [state, setState] = useState<'run' | 'leave' | 'gone'>(() => {
    try { return sessionStorage.getItem('ci2:loaded') || reducedMotion() ? 'gone' : 'run'; } catch { return 'run'; }
  });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (state !== 'run') return;
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setN(Math.round(100 * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setState('leave');
        window.setTimeout(() => { setState('gone'); try { sessionStorage.setItem('ci2:loaded', '1'); } catch { /* ignore */ } }, 900);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);
  if (state === 'gone') return null;
  return (
    <div className={`loader ${state === 'leave' ? 'loader--leave' : ''}`} aria-hidden="true">
      <Mark size={56} light />
      <div className="loader__count">{n}</div>
    </div>
  );
};

/** Moves an element against the scroll, gently. Returns the ref to attach. */
export const useParallax = (amount = 0.22) => {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current; if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.transform = `translate3d(0, ${window.scrollY * amount}px, 0) scale(1.08)`; });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [amount]);
  return ref;
};

/** Drifts an element a little toward the pointer. Returns the ref to attach. */
export const useMouseParallax = (strength = 24) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion() || !finePointer()) return;
    const el = ref.current; if (!el) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const move = (e: MouseEvent) => { tx = (e.clientX / window.innerWidth - 0.5) * strength * 2; ty = (e.clientY / window.innerHeight - 0.5) * strength * 2; };
    const loop = () => { cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; raf = requestAnimationFrame(loop); };
    window.addEventListener('mousemove', move); raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(raf); };
  }, [strength]);
  return ref;
};
