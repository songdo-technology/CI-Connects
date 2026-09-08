import React, { useEffect, useMemo, useState } from 'react';
import {
  Monitor, Radio, Copy, Check, ExternalLink, X, Clock, AlertTriangle,
} from 'lucide-react';
import { Room, Session, EventConfig } from '../types';
import {
  SignageBroadcast, SignageBroadcastKind, BROADCAST_KIND_META,
  publishBroadcast, subscribeBroadcast,
} from '../lib/signage';

interface SignageControlProps {
  event: EventConfig;
  rooms: Room[];
  sessions: Session[];
}

/**
 * Organizer control for the room displays.
 *
 * The preview wall renders each display in a real iframe, scaled down rather
 * than mocked up, so what an organizer approves here is literally the page that
 * will be cast. A mock would drift from the real display the first time either
 * changed.
 */

const DURATIONS: { label: string; minutes: number | null }[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: 'Until cleared', minutes: null },
];

/** Preview tiles render a real 1280x800 display page scaled to fit the card. */
const PREVIEW_W = 1280;
const PREVIEW_H = 800;

/**
 * Measures an element and returns the factor needed to scale a PREVIEW_W-wide
 * page into it. Measured rather than assumed because the tile width depends on
 * the grid, which depends on the viewport.
 */
const useFitScale = () => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / PREVIEW_W);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, scale };
};

/** One preview tile: a live, non-interactive iframe of the actual display. */
const PreviewTile: React.FC<{ src: string; reloadKey: string }> = ({ src, reloadKey }) => {
  const { ref, scale } = useFitScale();
  return (
    <div
      ref={ref}
      className="relative bg-slate-950 overflow-hidden"
      style={{ aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}
    >
      <iframe
        key={reloadKey}
        src={src}
        title="Display preview"
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="absolute top-0 left-0 origin-top-left border-0 pointer-events-none"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
};

export const SignageControl: React.FC<SignageControlProps> = ({ event, rooms, sessions }) => {
  const [active, setActive] = useState<SignageBroadcast | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [kind, setKind] = useState<SignageBroadcastKind>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<number | null>(15);
  const [targetAll, setTargetAll] = useState(true);
  const [targetRooms, setTargetRooms] = useState<string[]>([]);

  const [previewTime, setPreviewTime] = useState('');

  useEffect(() => subscribeBroadcast(setActive), []);

  const origin = window.location.origin;
  const urlFor = (roomId: string, withTime = true) =>
    `${origin}/?signage=${roomId}` +
    (withTime && /^\d{1,2}:\d{2}$/.test(previewTime) ? `&t=${previewTime}` : '');

  const copy = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(roomId, false));
      setCopied(roomId);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard unavailable — the URL is printed on the card anyway. */
    }
  };

  const canSend = title.trim().length > 0 && (targetAll || targetRooms.length > 0);

  const send = () => {
    if (!canSend) return;
    publishBroadcast({
      id: `bc-${Date.now()}`,
      kind,
      title: title.trim(),
      message: message.trim(),
      createdAt: Date.now(),
      expiresAt: duration === null ? null : Date.now() + duration * 60_000,
      targetRoomIds: targetAll ? null : targetRooms,
    });
    setTitle('');
    setMessage('');
  };

  const clear = () => publishBroadcast(null);

  const toggleRoom = (id: string) =>
    setTargetRooms((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const expiryLabel = useMemo(() => {
    if (!active) return '';
    if (active.expiresAt === null) return 'until cleared';
    const mins = Math.max(0, Math.round((active.expiresAt - Date.now()) / 60_000));
    return `${mins} min remaining`;
  }, [active]);

  return (
    <div className="space-y-5">
      {/* ---------------- Active takeover ---------------- */}
      {active && (
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ background: BROADCAST_KIND_META[active.kind].bg, color: '#fff' }}
        >
          <div className="min-w-0">
            <div
              className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1"
              style={{ color: BROADCAST_KIND_META[active.kind].accent }}
            >
              Live on {active.targetRoomIds === null
                ? `all ${rooms.length} displays`
                : `${active.targetRoomIds.length} display${active.targetRoomIds.length === 1 ? '' : 's'}`} · {expiryLabel}
            </div>
            <div className="text-lg font-bold truncate">{active.title}</div>
            {active.message && <div className="text-sm opacity-80 truncate">{active.message}</div>}
          </div>
          <button
            onClick={clear}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-sm font-semibold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            Clear takeover
          </button>
        </div>
      )}

      {/* ---------------- Composer ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Radio className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Push to displays</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Takes over the chosen screens immediately. The room's current session
          stays visible along the bottom, so nobody loses track of where they are.
        </p>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Headline</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lunch is now served in the Dining Commons"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Supporting line <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Sessions resume at 1:30 PM."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Style</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BROADCAST_KIND_META) as SignageBroadcastKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer ${
                      kind === k ? 'text-white border-transparent' : 'text-slate-600 border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    style={kind === k ? { background: BROADCAST_KIND_META[k].bg } : undefined}
                  >
                    {BROADCAST_KIND_META[k].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => setDuration(d.minutes)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      duration === d.minutes
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Send to</label>
              <div className="flex gap-2 mb-2.5">
                <button
                  onClick={() => setTargetAll(true)}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    targetAll ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                  }`}
                >
                  All {rooms.length} displays
                </button>
                <button
                  onClick={() => setTargetAll(false)}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    !targetAll ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
                  }`}
                >
                  Selected rooms
                </button>
              </div>

              {!targetAll && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {rooms.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:border-blue-600 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={targetRooms.includes(r.id)}
                        onChange={() => toggleRoom(r.id)}
                        className="accent-blue-600"
                      />
                      <span className="text-xs font-medium text-slate-700 truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={send}
              disabled={!canSend}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              Push to displays
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Prototype reach:</strong> takeovers travel between browser
            windows on <em>this machine</em> only. That is enough to drive several
            screens from one player and to test the whole flow, but a display on
            another device will not receive them until the platform has a shared
            backend.
          </p>
        </div>
      </div>

      {/* ---------------- Preview wall ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Monitor className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Display preview wall</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live previews of the real display pages — what you see is what gets cast.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              value={previewTime}
              onChange={(e) => setPreviewTime(e.target.value)}
              placeholder="Now (HH:MM)"
              className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const count = sessions.filter((s) => s.roomId === room.id).length;
            return (
              <div key={room.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <PreviewTile src={urlFor(room.id)} reloadKey={`${room.id}-${previewTime}`} />
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{room.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {room.floorLabel} · {count} session{count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copy(room.id)}
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer"
                      title="Copy cast URL"
                    >
                      {copied === room.id
                        ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                        : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                    <a
                      href={urlFor(room.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors"
                      title="Open full screen"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed mt-4">
          Cast URLs need no sign-in, so a CI Vision Live Cast destination can point
          straight at one. Open <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">{origin}/?signage=index</code>{' '}
          for the full setup sheet, or append <code className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">&amp;t=HH:MM</code>{' '}
          to preview any moment of {event.shortName}.
        </p>
      </div>
    </div>
  );
};
