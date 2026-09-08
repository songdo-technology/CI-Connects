import React from 'react';
import { Sparkles, ArrowRight, Store } from 'lucide-react';
import { Sponsor, SponsorTier, SPONSOR_TIER_ORDER } from '../types';

interface SponsorWallProps {
  sponsors: Sponsor[];
  onEnquire?: () => void;
}

/**
 * The sponsor wall for an event's public page.
 *
 * Prominence falls sharply from tier to tier — Platinum gets a full card with
 * a description, Gold a compact card, Silver and Bronze a name plate, and
 * Exhibitors a single line. That gradient is not decoration: it is what a
 * prospective sponsor is actually buying, so showing it honestly is a better
 * pitch than any amount of copy about "packages".
 *
 * Open slots render as invitations rather than being hidden, because an empty
 * Silver row is the clearest possible call for one.
 */

const TIER_LABEL: Record<SponsorTier, string> = {
  Host: 'Hosted by',
  Platinum: 'Platinum Sponsors',
  Gold: 'Gold Sponsors',
  Silver: 'Silver Sponsors',
  Bronze: 'Bronze Sponsors',
  Exhibitor: 'Exhibitors',
};

export const SponsorWall: React.FC<SponsorWallProps> = ({ sponsors, onEnquire }) => {
  const byTier = (tier: SponsorTier) => sponsors.filter((s) => s.tier === tier);

  const Placeholder: React.FC<{ label: string; big?: boolean }> = ({ label, big }) => (
    <div
      className={`rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 flex flex-col items-center justify-center text-center ${
        big ? 'p-6 min-h-[7rem]' : 'p-4 min-h-[4.5rem]'
      }`}
    >
      <span className="text-sm font-semibold text-slate-400">Your organisation here</span>
      <span className="text-[11px] text-slate-400 mt-0.5">{label}</span>
    </div>
  );

  return (
    <div className="space-y-12">
      {SPONSOR_TIER_ORDER.map((tier) => {
        const list = byTier(tier);
        if (list.length === 0) return null;

        // ---- Host ----
        if (tier === 'Host') {
          return (
            <div key={tier} className="text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                {TIER_LABEL[tier]}
              </div>
              {list.map((s) => (
                <div key={s.id}>
                  <div className="text-2xl font-bold text-blue-700">{s.name}</div>
                  {s.description && (
                    <p className="text-sm text-slate-500 mt-1">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          );
        }

        // ---- Platinum: full cards, premier first and widest ----
        if (tier === 'Platinum') {
          const premier = list.find((s) => s.isPremier);
          const rest = list.filter((s) => !s.isPremier);
          return (
            <div key={tier}>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-5 text-center">
                {TIER_LABEL[tier]}
              </div>

              {premier && (
                <div className="rounded-2xl border-2 border-blue-600 bg-white p-8 mb-4 text-center relative overflow-hidden">
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Premier
                  </span>
                  <div className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">{premier.name}</div>
                  {premier.tagline && (
                    <div className="text-sm font-semibold text-blue-700 mb-2">{premier.tagline}</div>
                  )}
                  {premier.description && (
                    <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
                      {premier.description}
                    </p>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {rest.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                    <div className="text-xl font-bold text-slate-900">{s.name}</div>
                    {s.tagline && <div className="text-xs font-semibold text-blue-700 mt-1">{s.tagline}</div>}
                    {s.description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{s.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // ---- Exhibitors: a single dense row ----
        if (tier === 'Exhibitor') {
          return (
            <div key={tier}>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 text-center flex items-center justify-center gap-2">
                <Store className="w-3.5 h-3.5" />
                {TIER_LABEL[tier]}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {list.map((s) => (
                  <span key={s.id} className="text-sm font-medium text-slate-500">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // ---- Gold / Silver / Bronze: name plates, shrinking by tier ----
        const cols =
          tier === 'Gold' ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3 lg:grid-cols-4';
        const size = tier === 'Gold' ? 'text-base' : 'text-sm';
        return (
          <div key={tier}>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">
              {TIER_LABEL[tier]}
            </div>
            <div className={`grid grid-cols-2 ${cols} gap-3`}>
              {list.map((s) =>
                s.isPlaceholder ? (
                  <Placeholder key={s.id} label={`${tier} tier`} big={tier === 'Gold'} />
                ) : (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-5 flex items-center justify-center text-center"
                  >
                    <span className={`${size} font-bold text-slate-800`}>{s.name}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}

      {onEnquire && (
        <div className="rounded-2xl bg-blue-600 text-white p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">Sponsor the Mission Conference</h3>
          <p className="text-sm text-blue-100/90 max-w-xl mx-auto leading-relaxed mb-6">
            Platinum partners headline a keynote and are credited on every room
            display for the session they support. Gold, Silver and Bronze tiers
            carry placement across the programme, the printed badge and the
            attendee portal.
          </p>
          <button
            onClick={onEnquire}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-blue-800 font-bold hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Request the sponsorship pack
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
