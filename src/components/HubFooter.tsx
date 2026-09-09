import React from 'react';
import {
  Building2, MapPin, Mail, Phone, TrainFront, Bus, Plane, ExternalLink, Heart,
} from 'lucide-react';

/**
 * The footer of the public site.
 *
 * It carries the three things a visitor to a school's event site actually
 * needs and rarely finds together: what the school stands for, how to physically
 * get to it, and who to ask when something does not work.
 *
 * The directions are spelled out rather than left as a link. A visiting educator
 * planning a trip from Seoul or landing at Incheon should not have to leave the
 * event page to learn that Campus Town Station is a ten-minute taxi away.
 */

/** Chadwick Schools' mission, quoted as written. */
const MISSION =
  'Chadwick Schools develop global citizens with keen minds, exemplary character, '
  + 'self-knowledge, and the ability to lead.';

const CORE_VALUES = ['Respect', 'Responsibility', 'Honesty', 'Fairness', 'Compassion'];

const DIRECTIONS = [
  {
    icon: TrainFront,
    label: 'By subway from Seoul',
    body: 'Incheon Line 1 to Campus Town Station. From exit 4, a taxi takes about '
      + '10 minutes (₩4,000–5,000), or bus #6-1 or #103-1 takes 10–15.',
  },
  {
    icon: Plane,
    label: 'From Incheon Airport',
    body: 'A taxi is direct and takes 22–25 minutes. By bus, #303 or #303-1 from '
      + 'Terminal 1 Gate 13A to Songdo Hillstate (about 42 minutes), then a short taxi.',
  },
  {
    icon: Bus,
    label: 'By bus from Seoul',
    body: 'M6405 from south Seoul to GS Xai Apartments, or M6724 from north Seoul '
      + 'to The Sharp Expo Village.',
  },
];

export const HubFooter: React.FC<{ eventCount: number }> = ({ eventCount }) => (
  <footer className="bg-blue-600 text-blue-100">
    {/* ---------- Mission ---------- */}
    <div className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-4">
          Our mission
        </div>
        <blockquote className="text-xl sm:text-2xl lg:text-[1.75rem] font-light leading-snug text-white max-w-4xl mx-auto mb-7">
          {MISSION}
        </blockquote>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CORE_VALUES.map((v) => (
            <span
              key={v}
              className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-blue-50"
            >
              {v}
            </span>
          ))}
        </div>
        <a
          href="https://www.chadwickinternational.org/about/our-mission"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-6 text-xs font-semibold text-blue-200 hover:text-white transition-colors"
        >
          Read the full mission and philosophy
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>

    {/* ---------- Columns ---------- */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 lg:grid-cols-4">
      {/* Brand */}
      <div className="lg:col-span-1">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Building2 className="w-4.5 h-4.5 text-blue-200" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">CI Connects</div>
            <div className="text-[11px] text-blue-300">Chadwick International</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-blue-200/90">
          The Chadwick International events platform — connecting the Chadwick
          community, and connecting Chadwick with the world.
        </p>
        <p className="text-xs leading-relaxed text-blue-300/70 mt-4">
          {eventCount} events catalogued: announced, run and remembered in one place.
        </p>
      </div>

      {/* Where we are */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
          <MapPin className="w-3.5 h-3.5" />
          Find us
        </h3>
        <address className="not-italic text-sm leading-relaxed text-blue-100/90 mb-3">
          Chadwick International
          <br />
          45, Art center-daero 97 beon-gil
          <br />
          Yeonsu-gu, Incheon 22002
          <br />
          South Korea
        </address>
        <p lang="ko" className="text-xs leading-relaxed text-blue-300/80 mb-4">
          인천시 연수구 아트센터대로 97번길 45
          <br />
          채드윅 국제학교
        </p>
        <a
          href="https://www.chadwickinternational.org/about/campus/directions-to-chadwick"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors"
        >
          Full directions and campus map
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Getting here */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
          Getting here
        </h3>
        <div className="space-y-4">
          {DIRECTIONS.map(({ icon: Icon, label, body }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-blue-50 mb-0.5">{label}</div>
                <p className="text-xs leading-relaxed text-blue-200/75">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">
          Questions
        </h3>
        <p className="text-sm leading-relaxed text-blue-200/90 mb-4">
          Anything about an event, a registration or this platform — write to us and a
          person will answer.
        </p>
        <a
          href="mailto:songdo-technology@chadwickschool.org"
          className="flex items-center gap-2.5 p-3 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition-colors mb-3 group"
        >
          <Mail className="w-4 h-4 text-blue-200 shrink-0" />
          <span className="text-xs font-semibold text-white break-all">
            songdo-technology@chadwickschool.org
          </span>
        </a>
        <a
          href="tel:+82322505000"
          className="flex items-center gap-2.5 text-xs text-blue-200/90 hover:text-white transition-colors"
        >
          <Phone className="w-3.5 h-3.5 shrink-0" />
          +82 32 250 5000
        </a>
      </div>
    </div>

    {/* ---------- Credit ---------- */}
    <div className="border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-300/80">
        <span className="flex items-center gap-1.5 text-center sm:text-left">
          <Heart className="w-3.5 h-3.5 text-blue-300 shrink-0" />
          Built by Dion Norman and the CI Technology Team, for the Chadwick community.
        </span>
        <span>© {new Date().getFullYear()} Chadwick International</span>
      </div>
    </div>
  </footer>
);
