import { DietaryTag } from '../types';

/**
 * Presentation for dietary tags, shared by the dining planner, the digital
 * badge and the organizer catering report so a preference reads identically
 * wherever catering or service staff encounter it.
 *
 * Colors come from the Chadwick secondary palette via the Tailwind ramps
 * overridden in index.css.
 */
export const DIETARY_META: Record<DietaryTag, { label: string; short: string; className: string }> = {
  western:     { label: 'Western',      short: 'WEST', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  korean:      { label: 'Korean',       short: 'KOR',  className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  vegetarian:  { label: 'Vegetarian',   short: 'VEG',  className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  vegan:       { label: 'Vegan',        short: 'VGN',  className: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
  halal:       { label: 'Halal',        short: 'HAL',  className: 'bg-amber-50 text-amber-800 border-amber-300' },
  gluten_free: { label: 'Gluten-Free',  short: 'GF',   className: 'bg-amber-100 text-amber-900 border-amber-400' },
  nut_free:    { label: 'Nut-Free',     short: 'NF',   className: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export const dietaryLabel = (tag?: DietaryTag): string =>
  tag ? DIETARY_META[tag].label : 'No preference set';
