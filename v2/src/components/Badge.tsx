import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CircleCheck, Clock, Mic, X } from 'lucide-react';
import { Attendance, Event, Profile, ROLE_LABEL } from '../lib/types';
import { formatRange, formatClock } from '../lib/time';
import { reducedMotion } from '../lib/motion';
import { Avatar } from './ui';
import { Mark } from './Mark';
import { OrbitDiagram } from './Orbit';

/**
 * What a badge's code says: a link to the person, so a phone camera opens
 * something (an organiser's phone gets a check-in card; the person's own
 * phone, their badge) while the door scanners read the uid out of it.
 * Older badges said `ci2:<uid>`; `badgeUid` still understands those.
 */
export const badgeCode = (uid: string) => `${window.location.origin}/b/${uid}`;

/** The person a scanned badge belongs to, from either form of code. */
export function badgeUid(text: string): string | null {
  const t = text.trim();
  const m = /^ci2:([A-Za-z0-9_-]+)$/.exec(t) ?? /\/b\/([A-Za-z0-9_-]+)(?:[/?#]|$)/.exec(t);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : null;
}

/** A card that leans towards the pointer, the way a lanyard badge turns in
 *  the hand. Off for touch and for people who asked for less motion. */
function useTilt(max = 7) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      el.style.setProperty('--glare-x', `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${((y + 0.5) * 100).toFixed(1)}%`);
    };
    const leave = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [max]);
  return ref;
}

const roleLabel = (p: Profile, speaker: boolean) => (p.role === 'user' ? (speaker ? 'Speaker' : 'Participant') : ROLE_LABEL[p.role]);

/**
 * One person's badge for one event — the same card in the wallet, on the
 * event's badge page, on a phone at the door and on paper.
 *
 * A lanyard card: the event in the navy band, the person's name large
 * enough to read across a room, their school, what they are here as, and
 * the code that gets them through a door. The code is the person, not the
 * event, so the badge works at every event they are on.
 */
export const BadgeCard: React.FC<{
  event: Event; profile: Profile; speaker?: boolean; reserved?: number; arrived?: Attendance | null;
  size?: 'wallet' | 'full'; className?: string;
  /** Tapping the code — to enlarge it for a scanner. */
  onCodeClick?: () => void;
}> = ({ event, profile, speaker = false, reserved = 0, arrived = null, size = 'full', className = '', onCodeClick }) => {
  const tilt = useTilt(size === 'full' ? 7 : 5);
  const full = size === 'full';
  const role = roleLabel(profile, speaker);
  return (
    <div ref={tilt} className={`badge-tilt ${className}`} style={{ width: full ? 340 : 280, maxWidth: '100%' }}>
      <div className="badge-print relative rounded-[1.75rem] overflow-hidden bg-white border border-sand-200 shadow-[var(--shadow-pop)]">
        <div className="absolute left-1/2 -translate-x-1/2 top-3 w-14 h-2 rounded-full bg-black/30 z-10" aria-hidden="true" />
        <div className="relative bg-blue-900 text-white px-6 pt-8 pb-5 overflow-hidden">
          <div className="absolute -right-16 -top-20 w-60 h-60 opacity-25 text-blue-200" aria-hidden="true"><OrbitDiagram active={1} label={false} className="w-full h-full" /></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,.12),transparent_55%)]" aria-hidden="true" />
          <div className="relative flex items-center gap-2"><Mark size={20} light /><span className="text-[10px] uppercase tracking-[0.2em] text-blue-200/80">CI Connects</span></div>
          <div className={`relative font-display font-bold leading-tight mt-4 [text-wrap:balance] ${full ? 'text-2xl' : 'text-xl'}`}>{event.name}</div>
          <div className="relative text-[11px] text-blue-100/80 mt-1.5">{formatRange(event.startDate, event.endDate)} · {event.venueName}</div>
        </div>

        <div className={`${full ? 'px-6 pt-5' : 'px-5 pt-4'}`}>
          <div className="flex items-center gap-3">
            <Avatar name={profile.name} photoUrl={profile.photoUrl} size={full ? 56 : 44} className="ring-2 ring-white shadow-md" />
            <div className="min-w-0">
              <div className={`font-display font-bold text-ink-900 leading-tight truncate ${full ? 'text-2xl' : 'text-lg'}`}>{profile.name}</div>
              {(profile.title || profile.org) && <div className="text-sm text-ink-500 truncate">{[profile.title, profile.org].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className={`chip ${profile.role === 'user' ? 'bg-sand-100 text-ink-700 border border-sand-200' : 'bg-blue-900 text-white'}`}>{role}</span>
            {speaker && profile.role !== 'user' && <span className="chip bg-amber-100 text-amber-900"><Mic className="w-3 h-3" />Speaker</span>}
          </div>
          <div className={`flex items-center gap-4 ${full ? 'mt-5 pb-5' : 'mt-4 pb-4'}`}>
            {onCodeClick
              ? <button type="button" onClick={(e) => { e.preventDefault(); onCodeClick(); }} title="Enlarge the code" className="p-2 bg-white rounded-xl border border-sand-200 shrink-0 hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"><QRCodeSVG value={badgeCode(profile.id)} size={full ? 140 : 104} level="M" /></button>
              : <div className="p-2 bg-white rounded-xl border border-sand-200 shrink-0"><QRCodeSVG value={badgeCode(profile.id)} size={full ? 140 : 104} level="M" /></div>}
            <div className="text-xs text-ink-500 leading-relaxed min-w-0">
              <div className="font-semibold text-ink-900">Scan at the door</div>
              <div className="mt-0.5">{onCodeClick ? 'Tap the code to enlarge it.' : 'Any phone signed in as you shows the same code.'}</div>
              <div className="font-mono text-[10px] tracking-widest text-ink-300 mt-2 uppercase">{profile.id.slice(0, 8)}</div>
            </div>
          </div>
        </div>

        <div className={`px-6 py-2.5 text-[11px] border-t flex items-center justify-between gap-2 ${arrived ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-sand-50 text-ink-500 border-sand-200'}`}>
          <span className="inline-flex items-center gap-1.5">{arrived ? <><CircleCheck className="w-3.5 h-3.5" />Checked in {formatClock(arrived.at)}</> : <><Clock className="w-3.5 h-3.5" />Not checked in yet</>}</span>
          {reserved > 0 && <span>{reserved} seat{reserved === 1 ? '' : 's'} held</span>}
        </div>
        <div className="badge-glare absolute inset-0 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
};

/** The badge at door size: white screen, code as large as the phone allows.
 *  Tap anywhere to put it away. */
export const BadgeFullscreen: React.FC<{ profile: Profile; event: Event; onClose: () => void }> = ({ profile, event, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-label="Your badge" onClick={onClose} className="fixed inset-0 z-[110] bg-white flex flex-col items-center justify-center gap-6 px-6 cursor-pointer welcome-arrive">
      <button onClick={onClose} className="absolute top-4 right-4 btn-ghost btn-sm" aria-label="Close"><X className="w-5 h-5" /></button>
      <div className="eyebrow">{event.name}</div>
      <QRCodeSVG value={badgeCode(profile.id)} size={512} level="M" style={{ width: 'min(78vw, 56vh)', height: 'auto' }} />
      <div className="text-center">
        <div className="font-display font-bold text-2xl text-ink-900">{profile.name}</div>
        {profile.org && <div className="text-ink-500">{profile.org}</div>}
      </div>
      <div className="text-xs text-ink-300">Hold it up to the scanner · tap to close</div>
    </div>,
    document.body,
  );
};
