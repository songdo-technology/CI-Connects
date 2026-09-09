import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Users, User, Building2, CalendarDays, MapPin } from 'lucide-react';
import {
  UserProfile, Session, Room, Track, EventConfig, Sponsor, MealService, SponsorTier,
} from '../types';
import { DIETARY_META } from '../lib/dietary';
import { LANYARD_SIZES, LanyardSize, badgeScale, buildBadgePayload } from '../lib/badge';

interface PrintableBadgeProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventConfig;
  profiles: UserProfile[];
  currentUser: UserProfile;
  sessions: Session[];
  rooms: Room[];
  tracks: Track[];
  sponsors: Sponsor[];
  mealServices: MealService[];
}

/**
 * Print-ready conference badges, sized 3.5in x 5.5in — the standard portrait
 * lanyard insert, so printed sheets drop straight into off-the-shelf holders.
 *
 * Two design constraints drove the layout:
 *
 *  1. The first name must be legible across a room, because that is what a
 *     badge is actually for. It gets the largest type on the card and its size
 *     steps down only as far as the longest name requires.
 *  2. Front and back are separate cards laid out in the same grid position, so
 *     duplex printing lines them up. Printed single-sided, they fold along the
 *     centre and laminate back-to-back.
 *
 * Print fidelity relies on `print-color-adjust: exact`; without it most
 * browsers drop the navy panel and the badge prints as white paper.
 */

/**
 * A line of text shrunk until it fits its column on one line.
 *
 * The previous version guessed a size from the character count, which cannot
 * work: "Illia" and "Wilhelmina" differ by five characters but far more than
 * five characters' worth of width, and the same ladder has to serve a CR80 and
 * a 4x6. Names that guessed wrong wrapped mid-word — "Timo / thy" — on a card
 * somebody was about to laminate.
 *
 * So it measures instead. A binary search over font size, comparing the text's
 * natural width against the space actually available, converges in seven cheap
 * reflows and is exact for any name in any font at any card size.
 *
 * The size is written straight to the node rather than held in React state:
 * the search runs several sizes per pass, and routing each through a render
 * would flash the intermediate ones on screen.
 */
/**
 * A card body that shrinks its whole contents until they fit the card.
 *
 * Cards are a fixed physical size and their contents are not: a delegate with
 * six reserved sessions, three meal choices and a long job title needs more
 * room than one with none, and a CR80 is a third the area of a 4x6. Tuning
 * each size by hand only holds until somebody books another session — and the
 * failure mode is silent, because the card clips at its own border and looks
 * deliberate. Measured here, the badge printed 266px of sponsor banners past
 * the bottom edge of a CR80 and gave no sign of it.
 *
 * Scaling is uniform and only ever downward, so proportions and the type
 * hierarchy survive; the card just gets a little denser. The QR stays on the
 * card, which is the part that has to be true.
 */
const FitBox: React.FC<{ className: string; children: React.ReactNode }> = ({
  className, children,
}) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const fit = () => {
      // Measure unscaled, or each pass would compound the last one's scale.
      i.style.transform = 'none';
      const natural = i.scrollHeight;
      // clientHeight includes padding, but the content lives inside it. Using
      // it directly over-stated the room by exactly the padding, and the card
      // overshot its own bottom edge by the bottom pad — enough to take the
      // corner off a QR code.
      const box = getComputedStyle(o);
      const available = o.clientHeight
        - parseFloat(box.paddingTop || '0')
        - parseFloat(box.paddingBottom || '0');
      if (!natural || available <= 0) return;
      const ratio = Math.min(1, available / natural);
      i.style.transform = ratio < 1 ? `scale(${ratio.toFixed(4)})` : 'none';
    };

    fit();
    document.fonts?.ready.then(fit).catch(() => { /* no font loading API */ });
    const observer = new ResizeObserver(fit);
    observer.observe(o);
    return () => observer.disconnect();
  });

  return (
    <div ref={outer} className={className}>
      {/* Scaled from the top centre, so the inner width never changes and the
          name's own fitting is not disturbed into a feedback loop. */}
      <div ref={inner} className="badge-fit-inner">{children}</div>
    </div>
  );
};

const FitLine: React.FC<{
  text: string;
  /** Upper bound, in inches. The line never grows past this. */
  maxIn: number;
  /** Lower bound. Below this a name is unreadable across a room, so it is
   *  better to let it touch the edges than to shrink it into illegibility. */
  minIn: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ text, maxIn, minIn, className, style }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const fit = () => {
      const available = parent.clientWidth;
      if (!available) return;

      let lo = minIn;
      let hi = maxIn;
      let best = minIn;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}in`;
        // scrollWidth is the text's natural width because the line cannot wrap.
        if (el.scrollWidth <= available) { best = mid; lo = mid; } else { hi = mid; }
      }
      el.style.fontSize = `${best.toFixed(4)}in`;
    };

    fit();

    // Web fonts change every metric this depends on, and they land after the
    // first paint. Without this the card is measured in the fallback face and
    // is wrong in the one it actually prints in.
    document.fonts?.ready.then(fit).catch(() => { /* no font loading API */ });

    // The card is laid out in a responsive grid, so its column can change width.
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [text, maxIn, minIn]);

  return (
    <div ref={ref} className={className} style={{ whiteSpace: 'nowrap', ...style }}>
      {text}
    </div>
  );
};

/** Honorifics and job titles that precede a name. Stripping these matters:
 *  without it "Officer Jin-Ho Park" prints a badge reading "Officer". */
const HONORIFICS =
  /^(Dr|Prof|Mr|Mrs|Ms|Mx|Rev|Fr|Sr|Capt|Sgt|Lt|Officer|Coach|Principal|Director|Chief)\.?\s+/i;

const splitName = (fullName: string) => {
  let cleaned = fullName.trim();
  // Loop: a name may carry more than one prefix, e.g. "Dr. Prof. Ada Lovelace".
  while (HONORIFICS.test(cleaned)) cleaned = cleaned.replace(HONORIFICS, '');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  // If a name is nothing but honorifics, fall back rather than render empty.
  if (parts.length === 0) return { first: fullName, rest: '' };
  return { first: parts[0], rest: parts.slice(1).join(' ') };
};

/** Sponsor prominence on the reverse. The size gradient is what a sponsor is
 *  actually buying, so it has to survive onto the printed card, not only the
 *  website. */
const SPONSOR_BANNER: Record<SponsorTier, { font: number; weight: number }> = {
  Host:      { font: 7.5, weight: 700 },
  Platinum:  { font: 11,  weight: 700 },
  Gold:      { font: 8,   weight: 700 },
  Silver:    { font: 6.5, weight: 600 },
  Bronze:    { font: 6,   weight: 600 },
  Exhibitor: { font: 5,   weight: 500 },
};

const ROLE_BAND: Record<UserProfile['role'], { label: string; bg: string }> = {
  attendee:        { label: 'ATTENDEE',  bg: '#002b54' },
  speaker:         { label: 'SPEAKER',   bg: '#b04318' },
  sponsor:         { label: 'SPONSOR',   bg: '#2a6791' },
  event_organizer: { label: 'ORGANISER', bg: '#5e6513' },
  technical_admin: { label: 'ORGANISER', bg: '#5e6513' },
  front_desk:      { label: 'FRONT DESK', bg: '#6b605a' },
};

export const PrintableBadge: React.FC<PrintableBadgeProps> = ({
  isOpen, onClose, event, profiles, currentUser, sessions, rooms, tracks, sponsors, mealServices,
}) => {
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [side, setSide] = useState<'both' | 'front' | 'back'>('both');
  const [size, setSize] = useState<LanyardSize>(
    LANYARD_SIZES.find((s) => s.id === 'conference-35') ?? LANYARD_SIZES[0],
  );
  const scale = badgeScale(size);

  const batch = useMemo(
    () => (scope === 'me' ? [currentUser] : profiles),
    [scope, currentUser, profiles],
  );

  if (!isOpen) return null;

  /** Every meal this person has chosen, with the option they picked. */
  const mealsFor = (u: UserProfile) =>
    mealServices
      .filter((m) => m.selections[u.id])
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes)
      .map((m) => ({ service: m, option: m.options.find((o) => o.id === m.selections[u.id]) }))
      .filter((x) => x.option);

  const sessionsFor = (u: UserProfile) =>
    sessions
      .filter((s) => s.reservedUserIds.includes(u.id))
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes);

  // ---------------------------------------------------------------- Front
  const Front: React.FC<{ u: UserProfile }> = ({ u }) => {
    // Preferred name wins outright: the badge exists to be read across a room,
    // and "Bill" is what he answers to even when the record says "William".
    const parsed = splitName(u.fullName);
    const first = u.preferredName?.trim() || parsed.first;
    const rest = u.preferredName?.trim() ? u.fullName : parsed.rest;
    const mine = sessionsFor(u);
    const band = ROLE_BAND[u.role];
    const meals = mealsFor(u);
    // A sponsor delegate wears the company they represent, not a department.
    const org = u.role === 'sponsor'
      ? sponsors.find((s) => s.id === u.sponsorId)?.name ?? u.organization
      : u.organization;

    return (
      <div className="badge-card">
        <div className="badge-band" style={{ background: band.bg }}>
          <span className="badge-band-org">CHADWICK INTERNATIONAL</span>
          <span className="badge-band-role">{band.label}</span>
        </div>

        <FitBox className="badge-body">
          <div className="badge-identity">
            {/* Whatever the profile holds — a generated initials mark today, a
                real photo once someone uploads one. */}
            {scale.showPhoto && <img className="badge-photo" src={u.avatarUrl} alt="" />}
          <div className="badge-name-block">
            <FitLine
              className="badge-first"
              text={first}
              maxIn={scale.firstNameMax}
              minIn={scale.firstNameMax * 0.34}
            />
            {rest && (
              <FitLine
                className="badge-last"
                text={rest}
                maxIn={scale.firstNameMax * 0.34}
                minIn={scale.firstNameMax * 0.15}
              />
            )}
          </div>
          </div>

          <div className="badge-meta">
            <FitLine
              className="badge-org"
              text={org}
              maxIn={scale.firstNameMax * 0.20}
              minIn={scale.firstNameMax * 0.11}
            />
            {u.title && <div className="badge-title">{u.title}</div>}
          </div>

          <div className="badge-lower">
            <div className="badge-qr">
              <QRCodeSVG
                value={buildBadgePayload(u, event.id, undefined, 'print')}
                size={Math.round(scale.qr * 96)}
                level="M"
                bgColor="#ffffff"
                fgColor="#002b54"
              />
              <span className="badge-qr-caption">Scan to check in</span>
            </div>

            {scale.showSessions && (
            <div className="badge-sessions">
              <div className="badge-sessions-head">My Sessions</div>
              {mine.length === 0 ? (
                <div className="badge-session-empty">No sessions reserved</div>
              ) : (
                mine.map((s) => {
                  const room = rooms.find((r) => r.id === s.roomId);
                  const track = tracks.find((t) => t.id === s.trackId);
                  return (
                    <div key={s.id} className="badge-session">
                      <span className="badge-session-dot" style={{ background: track?.colorHex ?? '#002b54' }} />
                      <span className="badge-session-time">D{s.day} {s.startTime.replace(/\s?[AP]M/, '')}</span>
                      <span className="badge-session-room">{room?.name.split('(')[0].trim() ?? '—'}</span>
                    </div>
                  );
                })
              )}
            </div>
            )}
          </div>

          {scale.showSessions && meals.length > 0 && (
            <div className="badge-meals">
              <div className="badge-sessions-head">Meals</div>
              {meals.map(({ service, option }) => (
                <div key={service.id} className="badge-meal">
                  <span className="badge-meal-name">{service.name}</span>
                  <span className="badge-meal-choice">{DIETARY_META[option!.dietary].short}</span>
                </div>
              ))}
            </div>
          )}

          {u.dietaryTag && scale.showDietary && (
            <div className="badge-diet">
              <span className="badge-diet-label">DIETARY</span>
              <span className="badge-diet-value">{DIETARY_META[u.dietaryTag].label}</span>
            </div>
          )}
        </FitBox>
      </div>
    );
  };

  // ----------------------------------------------------------------- Back
  const Back: React.FC = () => (
    <div className="badge-card badge-card--back">
      <FitBox className="badge-back-body">
      <div className="badge-back-top">
        <div className="badge-back-crest">CI</div>
        <div className="badge-back-school">Chadwick International</div>
        <div className="badge-back-event">{event.name}</div>
        <div className="badge-back-dates">{event.dateLabel}</div>
      </div>

      <div className="badge-back-venue">
        <div className="badge-back-venue-name">{event.venueName}</div>
        <div className="badge-back-venue-addr">{event.venueAddress}</div>
      </div>

      <div className="badge-back-sponsors">
        {(['Platinum', 'Gold', 'Silver', 'Bronze', 'Exhibitor'] as SponsorTier[]).map((tier) => {
          const list = sponsors.filter((s) => s.tier === tier && !s.isPlaceholder);
          if (!list.length) return null;
          const spec = SPONSOR_BANNER[tier];
          return (
            <div key={tier} className="badge-back-tier">
              <div className="badge-back-tier-label">{tier}</div>
              <div className={`badge-back-tier-list badge-back-tier-list--${tier.toLowerCase()}`}>
                {list.map((s) => (
                  <span
                    key={s.id}
                    className="badge-back-sponsor"
                    style={{ fontSize: `${spec.font}pt`, fontWeight: spec.weight }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="badge-back-foot">
        <div className="badge-back-foot-row">
          <strong>Lost badge?</strong> Return to the registration desk.
        </div>
        <div className="badge-back-foot-row">
          This badge must be worn and visible at all times on campus.
        </div>
        <div className="badge-back-brand">CI Connects · The Chadwick International Event Management Platform</div>
      </div>
      </FitBox>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:backdrop-blur-none">
      <style>{PRINT_CSS}</style>

      <div className="bg-slate-100 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:bg-white">
        {/* Toolbar — hidden when printing */}
        <div className="print:hidden px-5 py-4 bg-blue-600 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-blue-200" />
            <div>
              <h3 className="font-bold text-base leading-tight">Printable Badges</h3>
              <p className="text-xs text-blue-100/80">{size.label} · {size.width}″ × {size.height}″ — {size.note}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="print:hidden px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Print</span>
            {([['me', 'Just me', User], ['all', `All ${profiles.length}`, Users]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  scope === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Size</span>
            <select
              value={size.id}
              onChange={(e) => setSize(LANYARD_SIZES.find((s) => s.id === e.target.value)!)}
              title={size.note}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {LANYARD_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.width}″ × {s.height}″
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Sides</span>
            {([['both', 'Front & back'], ['front', 'Front only'], ['back', 'Back only']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSide(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  side === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print {scope === 'all' ? `${profiles.length} badges` : 'badge'}
          </button>
        </div>

        <div className="print:hidden px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 shrink-0">
          In the print dialog, enable <strong>Background graphics</strong> so the navy
          panels print. For double-sided badges choose <strong>Flip on short edge</strong>.
        </div>

        {/* Sheet */}
        <div className="overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <div
            className="badge-sheet"
            style={{
              ['--card-w' as string]: `${size.width}in`,
              ['--card-h' as string]: `${size.height}in`,
              ['--card-pad' as string]: `${scale.padding}in`,
            }}
          >
            {batch.map((u) => (
              <React.Fragment key={u.id}>
                {side !== 'back' && <Front u={u} />}
                {side !== 'front' && <Back />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const PRINT_CSS = `
.badge-sheet {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--card-w));
  gap: 0.25in;
  justify-content: center;
}

.badge-card {
  width: var(--card-w);
  height: var(--card-h);
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 0.14in;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: "Gill Sans Std", "Gill Sans MT", "Gill Sans", Helvetica, Arial, sans-serif;
  color: #0f172a;
  break-inside: avoid;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ---- Front ---- */
.badge-band {
  padding: 0.13in 0.18in;
  display: flex; align-items: center; justify-content: space-between;
  color: #fff;
}
.badge-band-org  { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.09em; }
.badge-band-role { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.11em;
                   background: rgba(255,255,255,.22); padding: 0.02in 0.09in; border-radius: 999px; }

.badge-body { flex: 1; padding: var(--card-pad); overflow: hidden; }
.badge-back-body { flex: 1; overflow: hidden; }
/* min-height so a sparse card still pushes its footer to the bottom, while a
   full one is free to exceed the box and be scaled back down to fit it. */
.badge-fit-inner {
  display: flex; flex-direction: column; min-height: 100%;
  transform-origin: top center;
}

.badge-name-block { text-align: center; margin-top: 0.02in; width: 100%; }
.badge-first {
  font-weight: 700; line-height: 1.02; letter-spacing: -0.02em;
  color: #002b54;
  /* Never wrap and never clip: FitLine guarantees it fits on one line. */
  white-space: nowrap;
}
.badge-last {
  font-weight: 600; color: #334155;
  margin-top: 0.04in; letter-spacing: 0.01em; white-space: nowrap;
}

.badge-meta {
  text-align: center; margin-top: 0.09in; padding-top: 0.08in;
  border-top: 1px solid #e8edf3;
}
.badge-title { font-size: 8.5pt; font-weight: 600; color: #2a6791; line-height: 1.25; }
.badge-org   { color: #64748b; margin-top: 0.02in; white-space: nowrap; font-weight: 600; }

.badge-lower {
  margin-top: auto; display: flex; gap: 0.14in; align-items: flex-start;
  border-top: 1px solid #e2e8f0; padding-top: 0.14in;
}
.badge-qr { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.badge-qr-caption { font-size: 5.5pt; color: #94a3b8; margin-top: 0.04in; text-align: center; max-width: 1in; }

.badge-sessions { flex: 1; min-width: 0; }
.badge-sessions-head {
  font-size: 6pt; font-weight: 700; letter-spacing: 0.1em;
  color: #94a3b8; margin-bottom: 0.05in;
}
.badge-session { display: flex; align-items: center; gap: 0.05in; margin-bottom: 0.035in; }
.badge-session-dot { width: 0.05in; height: 0.05in; border-radius: 999px; flex-shrink: 0; }
.badge-session-time { font-size: 6.5pt; font-weight: 700; color: #334155; flex-shrink: 0; }
.badge-session-room {
  font-size: 6.5pt; color: #64748b; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.badge-session-empty, .badge-session-more { font-size: 6pt; color: #94a3b8; font-style: italic; }

.badge-diet {
  margin-top: 0.1in; display: flex; align-items: center; gap: 0.06in;
  border-top: 1px dashed #e2e8f0; padding-top: 0.08in;
}
.badge-diet-label { font-size: 5.5pt; font-weight: 700; letter-spacing: 0.1em; color: #94a3b8; }
.badge-diet-value { font-size: 7pt; font-weight: 700; color: #002b54; }

/* ---- Back ---- */
.badge-card--back { background: #002b54; color: #fff; border-color: #002b54; padding: var(--card-pad); }
.badge-back-top { text-align: center; }
.badge-back-crest {
  width: 0.5in; height: 0.5in; margin: 0 auto 0.1in; border-radius: 0.1in;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  display: flex; align-items: center; justify-content: center;
  font-size: 12pt; font-weight: 700; color: #acd4f1;
}
.badge-back-school { font-size: 10pt; font-weight: 700; letter-spacing: 0.02em; }
.badge-back-event  { font-size: 8.5pt; color: #acd4f1; margin-top: 0.07in; line-height: 1.3; }
.badge-back-dates  { font-size: 7pt; color: rgba(255,255,255,.62); margin-top: 0.04in; }

.badge-back-venue {
  margin-top: 0.16in; padding: 0.1in; border-radius: 0.07in;
  background: rgba(255,255,255,.08); text-align: center;
}
.badge-back-venue-name { font-size: 7.5pt; font-weight: 700; }
.badge-back-venue-addr { font-size: 6pt; color: rgba(255,255,255,.6); margin-top: 0.03in; line-height: 1.35; }

.badge-back-sponsors { margin-top: 0.16in; flex: 1; }
.badge-back-sponsors-head {
  font-size: 6pt; font-weight: 700; letter-spacing: 0.1em;
  color: rgba(255,255,255,.5); text-align: center; margin-bottom: 0.08in;
}
.badge-back-sponsor-list { display: flex; flex-direction: column; gap: 0.055in; }
.badge-back-sponsor {
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.08in;
  border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 0.04in;
}
.badge-back-sponsor-name { font-size: 7pt; font-weight: 600; }
.badge-back-sponsor-tier { font-size: 5.5pt; color: rgba(255,255,255,.45); letter-spacing: 0.06em; text-transform: uppercase; }

/* The photo sits above the name rather than beside it.
   Side by side, the photo took more than a third of the card and the first
   name was left a narrow column — which forced the type down to a size you
   could not read from arm's length, let alone across a room. Stacked, the
   name gets the full width of the card and roughly twice the type size. */
.badge-identity {
  display: flex; flex-direction: column; align-items: stretch;
  text-align: center;
}
.badge-photo {
  width: 0.54in; height: 0.54in; border-radius: 50%; object-fit: cover;
  margin: 0 auto 0.06in; display: block;
  border: 1.5px solid #fff; box-shadow: 0 0 0 1px #cbd5e1;
}
.badge-meals { margin-top: 0.07in; }
.badge-meal { display: flex; align-items: baseline; justify-content: space-between; gap: 0.06in; margin-bottom: 0.02in; }
.badge-meal-name   { font-size: 6pt; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge-meal-choice { font-size: 6pt; font-weight: 700; color: #002b54; flex-shrink: 0; }

.badge-back-tier { margin-bottom: 0.07in; }
.badge-back-tier-label {
  font-size: 4.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255,255,255,.4); margin-bottom: 0.02in;
}
.badge-back-tier-list {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline;
  gap: 0.02in 0.08in;
}
.badge-back-tier-list--platinum { flex-direction: column; gap: 0.015in; }
.badge-back-sponsor { color: #fff; line-height: 1.2; }
.badge-back-tier-list--silver .badge-back-sponsor,
.badge-back-tier-list--bronze .badge-back-sponsor { color: rgba(255,255,255,.85); }
.badge-back-tier-list--exhibitor .badge-back-sponsor { color: rgba(255,255,255,.6); }

.badge-back-foot { margin-top: auto; text-align: center; padding-top: 0.12in; }
.badge-back-foot-row { font-size: 5.5pt; color: rgba(255,255,255,.55); line-height: 1.5; }
.badge-back-brand {
  font-size: 5pt; color: rgba(255,255,255,.35); margin-top: 0.08in;
  border-top: 1px solid rgba(255,255,255,.12); padding-top: 0.06in;
}

@media print {
  @page { size: letter portrait; margin: 0.3in; }
  html, body { background: #fff !important; }
  /* Hide the app behind the print sheet without unmounting it. */
  body > #root > div:not(.fixed) { display: none !important; }
  .badge-sheet { gap: 0.2in; }
  .badge-card { border-color: #94a3b8; }
}
`;
