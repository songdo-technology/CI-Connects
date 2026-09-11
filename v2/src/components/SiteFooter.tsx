import React from 'react';
import { MapPin, Mail, Phone, TrainFront, Bus, Plane, ExternalLink, Heart } from 'lucide-react';
import { Mark } from './Mark';

/** Chadwick Schools' mission, quoted as written. */
const MISSION = 'Chadwick Schools develop global citizens with keen minds, exemplary character, self-knowledge, and the ability to lead.';
const CORE_VALUES = ['Respect', 'Responsibility', 'Honesty', 'Fairness', 'Compassion'];

const DIRECTIONS = [
  { icon: TrainFront, label: 'By subway from Seoul', body: 'Incheon Line 1 to Campus Town Station. From exit 4, a taxi takes about 10 minutes (₩4,000–5,000), or bus #6-1 or #103-1 takes 10–15.' },
  { icon: Plane, label: 'From Incheon Airport', body: 'A taxi is direct and takes 22–25 minutes. By bus, #303 or #303-1 from Terminal 1 Gate 13A to Songdo Hillstate (about 42 minutes), then a short taxi.' },
  { icon: Bus, label: 'By bus from Seoul', body: 'M6405 from south Seoul to GS Xai Apartments, or M6724 from north Seoul to The Sharp Expo Village.' },
];

/**
 * The foot of every page, public site and app alike — carried over from v1.
 *
 * It holds the three things a visitor to a school's event site needs and
 * rarely finds together: what the school stands for, how to physically get
 * to it, and who to ask when something does not work. The directions are
 * spelled out rather than left as a link: an educator landing at Incheon
 * should not have to leave the page to learn that Campus Town Station is a
 * ten-minute taxi away.
 */
export const SiteFooter: React.FC<{ contactEmail?: string }> = ({ contactEmail = 'songdo-technology@chadwickschool.org' }) => (
  <footer className="bg-blue-900 text-blue-100 mt-20">
    <div className="border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 py-14 text-center">
        <div className="eyebrow text-blue-200/80 mb-4">Our mission</div>
        <blockquote className="font-display text-xl sm:text-2xl lg:text-[1.75rem] font-medium leading-snug text-white max-w-3xl mx-auto [text-wrap:balance]">{MISSION}</blockquote>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
          {CORE_VALUES.map((v) => <span key={v} className="rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white">{v}</span>)}
        </div>
        <a href="https://www.chadwickinternational.org/about/our-mission" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors mt-6">
          Read the full mission and philosophy<ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>

    <div className="max-w-6xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.3fr_1fr]">
      <div>
        <div className="flex items-center gap-2.5">
          <Mark size={36} light />
          <div><div className="font-display font-bold text-white leading-tight">CI Connects</div><div className="text-[11px] text-blue-200/80">Chadwick International</div></div>
        </div>
        <p className="text-sm leading-relaxed text-blue-100/90 mt-5">The Chadwick International events platform — connecting the Chadwick community, and connecting Chadwick with the world.</p>
        <p className="text-xs leading-relaxed text-blue-200/60 mt-4">Every event, announced, run and remembered in one place.</p>
      </div>

      <div>
        <h3 className="flex items-center gap-2 eyebrow text-blue-200/80 mb-4"><MapPin className="w-3.5 h-3.5" />Find us</h3>
        <address className="not-italic text-sm leading-relaxed text-blue-100/90">Chadwick International<br />45, Art center-daero 97 beon-gil<br />Yeonsu-gu, Incheon 22002<br />South Korea</address>
        <p lang="ko" className="text-xs leading-relaxed text-blue-200/70 mt-3">인천시 연수구 아트센터대로 97번길 45<br />채드윅 국제학교</p>
        <a href="https://www.chadwickinternational.org/about/campus/directions-to-chadwick" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors mt-4">
          Full directions and campus map<ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div>
        <h3 className="eyebrow text-blue-200/80 mb-4">Getting here</h3>
        <ul className="space-y-4">
          {DIRECTIONS.map(({ icon: Icon, label, body }) => (
            <li key={label} className="flex gap-3">
              <Icon className="w-4 h-4 text-blue-200 shrink-0 mt-0.5" />
              <div><div className="text-sm font-semibold text-white">{label}</div><p className="text-xs leading-relaxed text-blue-100/80 mt-1">{body}</p></div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="eyebrow text-blue-200/80 mb-4">Questions</h3>
        <p className="text-sm leading-relaxed text-blue-100/90">Anything about an event, a registration or this platform — write to us and a person will answer.</p>
        <a href={`mailto:${contactEmail}`} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 transition-colors mt-4">
          <Mail className="w-4 h-4 text-blue-200 shrink-0" /><span className="text-xs font-semibold text-white break-all">{contactEmail}</span>
        </a>
        <a href="tel:+82322505000" className="flex items-center gap-2.5 text-xs text-blue-100/90 hover:text-white transition-colors mt-3"><Phone className="w-3.5 h-3.5 shrink-0" />+82 32 250 5000</a>
      </div>
    </div>

    <div className="border-t border-white/10">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-200/70">
        <span className="flex items-center gap-1.5 text-center sm:text-left"><Heart className="w-3.5 h-3.5 text-blue-200 shrink-0" />Built by Dion Norman and the CI Technology Team, for the Chadwick community.</span>
        <span>© {new Date().getFullYear()} Chadwick International</span>
      </div>
    </div>
  </footer>
);
