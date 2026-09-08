import React, { useState } from 'react';
import { Monitor, Copy, Check, ExternalLink, Building2 } from 'lucide-react';
import { EventConfig, Room, Session } from '../types';

interface SignageDirectoryProps {
  event: EventConfig;
  rooms: Room[];
  sessions: Session[];
}

/**
 * Setup sheet for whoever configures the displays. Lists one castable URL per
 * room so a CI Vision operator can copy them into Live Cast destinations
 * without needing to know how the app is routed.
 *
 * Reachable at `?signage=index`.
 */
export const SignageDirectory: React.FC<SignageDirectoryProps> = ({ event, rooms, sessions }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const origin = window.location.origin;
  const urlFor = (roomId: string) => `${origin}/?signage=${roomId}`;

  const copy = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(roomId));
      setCopied(roomId);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard may be blocked; the URL is shown in full below regardless. */
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-blue-200" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Room Signage URLs</h1>
        </div>
        <p className="text-sm text-slate-500 mb-8 max-w-2xl leading-relaxed">
          One castable display per room for <strong>{event.name}</strong>. Point a CI
          Vision Live Cast destination at the URL for that room — the display
          resolves the correct session from the clock and needs no sign-in, so a
          screen can be left running for the whole event.
        </p>

        <div className="space-y-3">
          {rooms.map((room) => {
            const count = sessions.filter((s) => s.roomId === room.id).length;
            return (
              <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900 truncate">{room.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {room.floorLabel} · capacity {room.capacity} · {count} session{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copy(room.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      {copied === room.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === room.id ? 'Copied' : 'Copy URL'}
                    </button>
                    <a
                      href={urlFor(room.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Preview
                    </a>
                  </div>
                </div>
                <code className="block mt-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 break-all">
                  {urlFor(room.id)}
                </code>
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-5 rounded-2xl bg-white border border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm mb-2">Previewing another time</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Append <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">&amp;t=HH:MM</code>{' '}
            to any URL above to render the display as it will appear at that moment —
            useful for checking a screen before the day starts. For example{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 break-all">
              {urlFor(rooms[0]?.id ?? 'room')}&amp;t=09:30
            </code>
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <Building2 className="w-3.5 h-3.5" />
          CI Connects · The Chadwick International Event Management Platform
        </div>
      </div>
    </div>
  );
};
