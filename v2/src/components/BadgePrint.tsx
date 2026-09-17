import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCard, BadgeData } from './Badge';
import { BadgeFormat, sheetGrid } from '../lib/badgeFormats';

export type PrintLayout = 'one' | 'a4';

/**
 * What goes to the printer. Rendered only while printing, into its own root
 * that the print stylesheet shows instead of the page.
 *
 * Two layouts. *One per page*: each badge's front on one page and its back
 * on the next, centred — a duplex printer (flip on the long edge) puts the
 * back exactly behind the front; a card printer takes them as they come.
 * *A4 sheets*: as many as fit, fronts on one sheet and backs on the next
 * with the columns mirrored, so the same duplex flip lines each back up
 * with its front.
 */
export const BadgePrintSheet: React.FC<{ badges: BadgeData[]; format: BadgeFormat; layout: PrintLayout; onDone: () => void }> = ({ badges, format, layout, onDone }) => {
  useEffect(() => {
    document.body.classList.add('badge-printing');
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    const t = window.setTimeout(() => window.print(), 400);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', done); document.body.classList.remove('badge-printing'); };
  }, [onDone]);
  const withBack = badges.some((b) => b.sponsors.length > 0);
  const card = (b: BadgeData, flipped: boolean) => <BadgeCard event={b.event} profile={b.profile} sponsors={b.sponsors} speaker={b.speaker} format={format} print flipped={flipped} />;
  let pages: React.ReactNode[] = [];
  if (layout === 'one') {
    pages = badges.flatMap((b, i) => [
      <div key={`${i}-f`} className="print-page">{card(b, false)}</div>,
      ...(withBack ? [<div key={`${i}-b`} className="print-page">{b.sponsors.length > 0 ? card(b, true) : <div style={{ width: `${format.w}mm`, height: `${format.h}mm` }} />}</div>] : []),
    ]);
  } else {
    const { cols, rows } = sheetGrid(format); const per = cols * rows;
    for (let i = 0; i < badges.length; i += per) {
      const chunk = badges.slice(i, i + per);
      const grid = (back: boolean) => (
        <div key={`${i}-${back ? 'b' : 'f'}`} className="print-page print-sheet" style={{ gridTemplateColumns: `repeat(${cols}, ${format.w}mm)`, direction: back ? 'rtl' : 'ltr' }}>
          {chunk.map((b, j) => <div key={j} style={{ width: `${format.w}mm`, height: `${format.h}mm` }}>{back ? (b.sponsors.length > 0 ? card(b, true) : null) : card(b, false)}</div>)}
        </div>
      );
      pages.push(grid(false)); if (withBack) pages.push(grid(true));
    }
  }
  return createPortal(<div id="badge-print-root">{pages}</div>, document.body);
};
