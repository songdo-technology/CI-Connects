/** The physical sizes a badge is printed at — the lanyard holders people
 *  actually wear. On screen the card is drawn at the same size (CSS px are
 *  1/96 in), so what you see is what comes out of the printer. */
export interface BadgeFormat { id: string; label: string; w: number; h: number; note: string }

export const BADGE_FORMATS: BadgeFormat[] = [
  { id: 'cr80', label: 'Card', w: 54, h: 86, note: '54 × 86 mm — ID-card size (CR80): rigid holders and badge reels.' },
  { id: 'a7', label: 'A7', w: 74, h: 105, note: '74 × 105 mm — the usual lanyard holder.' },
  { id: 'l35', label: '3.5 × 5.5 in', w: 88.9, h: 139.7, note: '89 × 140 mm — the larger conference insert.' },
];
export const DEFAULT_FORMAT_ID = 'a7';
export const formatById = (id: string | null | undefined) => BADGE_FORMATS.find((f) => f.id === id) ?? BADGE_FORMATS[1];

/** The badge is designed at this width in px and scaled to the format. */
export const BASE_W = 340;
export const mmToPx = (mm: number) => (mm * 96) / 25.4;

const KEY = 'ci2:badge-format';
export const rememberedFormat = (): BadgeFormat => { try { return formatById(localStorage.getItem(KEY)); } catch { return formatById(null); } };
export const rememberFormat = (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* private mode */ } };

/** How many fit on an A4 sheet (portrait, 10 mm margins, 4 mm gutters). */
export function sheetGrid(f: BadgeFormat): { cols: number; rows: number } {
  const usableW = 210 - 20, usableH = 297 - 20, gap = 4;
  return { cols: Math.max(1, Math.floor((usableW + gap) / (f.w + gap))), rows: Math.max(1, Math.floor((usableH + gap) / (f.h + gap))) };
}
