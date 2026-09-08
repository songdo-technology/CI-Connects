import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Users, User, Building2, CalendarDays, MapPin } from 'lucide-react';
import { UserProfile, Session, Room, Track, EventConfig, Sponsor } from '../types';
import { DIETARY_META } from '../lib/dietary';

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

/** Steps the first-name type down only as far as the name demands. */
const firstNameSize = (name: string) => {
  const n = name.length;
  if (n <= 5) return '4.4rem';
  if (n <= 7) return '3.7rem';
  if (n <= 10) return '3rem';
  if (n <= 13) return '2.4rem';
  return '2rem';
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

const ROLE_BAND: Record<UserProfile['role'], { label: string; bg: string }> = {
  attendee:  { label: 'ATTENDEE',  bg: '#002b54' },
  speaker:   { label: 'SPEAKER',   bg: '#b04318' },
  organizer: { label: 'ORGANIZER', bg: '#5e6513' },
  admin:     { label: 'ORGANIZER', bg: '#5e6513' },
  security:  { label: 'SECURITY',  bg: '#6b605a' },
};

export const PrintableBadge: React.FC<PrintableBadgeProps> = ({
  isOpen, onClose, event, profiles, currentUser, sessions, rooms, tracks, sponsors,
}) => {
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [side, setSide] = useState<'both' | 'front' | 'back'>('both');

  const batch = useMemo(
    () => (scope === 'me' ? [currentUser] : profiles),
    [scope, currentUser, profiles],
  );

  if (!isOpen) return null;

  const sessionsFor = (u: UserProfile) =>
    sessions
      .filter((s) => s.reservedUserIds.includes(u.id))
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes);

  // ---------------------------------------------------------------- Front
  const Front: React.FC<{ u: UserProfile }> = ({ u }) => {
    const { first, rest } = splitName(u.fullName);
    const mine = sessionsFor(u);
    const band = ROLE_BAND[u.role];

    return (
      <div className="badge-card">
        <div className="badge-band" style={{ background: band.bg }}>
          <span className="badge-band-org">CHADWICK INTERNATIONAL</span>
          <span className="badge-band-role">{band.label}</span>
        </div>

        <div className="badge-body">
          <div className="badge-name-block">
            <div className="badge-first" style={{ fontSize: firstNameSize(first) }}>{first}</div>
            {rest && <div className="badge-last">{rest}</div>}
          </div>

          <div className="badge-meta">
            <div className="badge-title">{u.title}</div>
            <div className="badge-org">{u.organization}</div>
          </div>

          <div className="badge-lower">
            <div className="badge-qr">
              <QRCodeSVG
                value={JSON.stringify({ t: 'ci-connects-badge', uid: u.id, evt: event.id })}
                size={92}
                level="M"
                bgColor="#ffffff"
                fgColor="#002b54"
              />
              <span className="badge-qr-caption">Scan to verify &amp; connect</span>
            </div>

            <div className="badge-sessions">
              <div className="badge-sessions-head">My Sessions</div>
              {mine.length === 0 ? (
                <div className="badge-session-empty">No sessions reserved</div>
              ) : (
                mine.slice(0, 4).map((s) => {
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
              {mine.length > 4 && (
                <div className="badge-session-more">+{mine.length - 4} more in the app</div>
              )}
            </div>
          </div>

          {u.dietaryTag && (
            <div className="badge-diet">
              <span className="badge-diet-label">DIETARY</span>
              <span className="badge-diet-value">{DIETARY_META[u.dietaryTag].label}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------------- Back
  const Back: React.FC = () => (
    <div className="badge-card badge-card--back">
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

      {sponsors.length > 0 && (
        <div className="badge-back-sponsors">
          <div className="badge-back-sponsors-head">With thanks to our partners</div>
          <div className="badge-back-sponsor-list">
            {sponsors.map((s) => (
              <div key={s.id} className="badge-back-sponsor">
                <span className="badge-back-sponsor-name">{s.name}</span>
                <span className="badge-back-sponsor-tier">{s.tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="badge-back-foot">
        <div className="badge-back-foot-row">
          <strong>Lost badge?</strong> Return to the registration desk.
        </div>
        <div className="badge-back-foot-row">
          This badge must be worn and visible at all times on campus.
        </div>
        <div className="badge-back-brand">CI Connects · The Chadwick International Event Management Platform</div>
      </div>
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
              <p className="text-xs text-blue-100/80">3.5 × 5.5 in — standard portrait lanyard insert</p>
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
          <div className="badge-sheet">
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
  grid-template-columns: repeat(auto-fill, 3.5in);
  gap: 0.25in;
  justify-content: center;
}

.badge-card {
  width: 3.5in;
  height: 5.5in;
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

.badge-body { flex: 1; padding: 0.2in 0.2in 0.16in; display: flex; flex-direction: column; }

.badge-name-block { text-align: center; margin-top: 0.14in; }
.badge-first {
  font-weight: 700; line-height: 0.98; letter-spacing: -0.02em;
  color: #002b54; word-break: break-word;
}
.badge-last {
  font-size: 1.05rem; font-weight: 600; color: #334155;
  margin-top: 0.05in; letter-spacing: 0.01em;
}

.badge-meta { text-align: center; margin-top: 0.12in; }
.badge-title { font-size: 8.5pt; font-weight: 600; color: #2a6791; line-height: 1.25; }
.badge-org   { font-size: 7.5pt; color: #64748b; margin-top: 0.02in; }

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
.badge-card--back { background: #002b54; color: #fff; border-color: #002b54; padding: 0.22in; }
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
