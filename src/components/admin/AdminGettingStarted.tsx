import React from 'react';
import { Check, Circle, ArrowRight, Rocket } from 'lucide-react';
import { EventConfig, Session, Room, Invite, registrationState } from '../../types';

interface AdminGettingStartedProps {
  events: EventConfig[];
  sessions: Session[];
  rooms: Room[];
  invites: Invite[];
  onCreateEvent: () => void;
  onGo: (section: 'rooms' | 'import' | 'guests' | 'events') => void;
}

/**
 * The path from a demonstration to a real event.
 *
 * The platform arrives full of illustrative content, which answers "what is
 * this" and then quietly becomes the obstacle to "how do I use it" — an
 * organiser opens the events list, finds eleven samples, and has no signal
 * about where their own work begins.
 *
 * Every step here is measured against the data rather than ticked off by
 * hand, so it cannot claim progress that does not exist, and it disappears
 * once there is a real published event with a programme. Sample events are
 * excluded from every count: they are useful for testing and they are not
 * evidence that anything has been set up.
 */
export const AdminGettingStarted: React.FC<AdminGettingStartedProps> = ({
  events, sessions, rooms, invites, onCreateEvent, onGo,
}) => {
  const real = events.filter((e) => !e.isTemplate);
  const realIds = new Set(real.map((e) => e.id));
  const realSessions = sessions.filter((s) => realIds.has(s.eventId));
  const realInvites = invites.filter((i) => realIds.has(i.eventId));
  const published = real.filter((e) => e.status !== 'draft');
  const openForRegistration = published.filter((e) => registrationState(e).state === 'open');

  const steps = [
    {
      done: real.length > 0,
      label: 'Create a real event',
      detail: real.length > 0
        ? `${real.length} real event${real.length === 1 ? '' : 's'} — ${real.map((e) => e.name).join(', ')}`
        : 'Everything here is still sample content.',
      action: 'New event',
      run: onCreateEvent,
    },
    {
      done: rooms.length > 0,
      label: 'Confirm your rooms',
      detail: rooms.length > 0
        ? `${rooms.length} rooms defined. They are shared across every event.`
        : 'Add the spaces you actually use, once.',
      action: 'Rooms',
      run: () => onGo('rooms'),
    },
    {
      done: realSessions.length > 0,
      label: 'Add the programme',
      detail: realSessions.length > 0
        ? `${realSessions.length} sessions on your real event${real.length === 1 ? '' : 's'}.`
        : 'Import a spreadsheet, paste an agenda, or approve what speakers propose.',
      action: 'Import',
      run: () => onGo('import'),
    },
    {
      done: realInvites.length > 0,
      label: 'Invite people from outside Chadwick',
      detail: realInvites.length > 0
        ? `${realInvites.length} guests invited.`
        : 'Chadwick accounts need no invitation — they sign in with Google.',
      action: 'Guests',
      run: () => onGo('guests'),
    },
    {
      done: openForRegistration.length > 0,
      label: 'Publish it and open registration',
      detail: openForRegistration.length > 0
        ? `${openForRegistration.length} open for registration now.`
        : published.length > 0
          ? 'Published, but registration has not opened yet.'
          : 'New events start as drafts, invisible on the public hub until you publish.',
      action: 'Events',
      run: () => onGo('events'),
    },
  ];

  const complete = steps.filter((s) => s.done).length;
  // Nothing left to guide. Reappears on its own if a step is later undone.
  if (complete === steps.length) return null;

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-600 overflow-hidden mb-6">
      <div className="px-5 py-4 bg-blue-600 text-white">
        <div className="flex items-center gap-2.5 mb-1">
          <Rocket className="w-4.5 h-4.5 text-blue-200" />
          <h3 className="font-bold">Setting up your first real event</h3>
        </div>
        <p className="text-xs text-blue-100/85">
          {complete} of {steps.length} done. The sample catalogue stays where it is —
          it is useful for testing, and none of it counts towards these.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {steps.map((s) => (
          <div key={s.label} className="px-5 py-3.5 flex items-center gap-3.5">
            {s.done
              ? <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </span>
              : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-bold ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {s.label}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.detail}</div>
            </div>
            {!s.done && (
              <button
                onClick={s.run}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {s.action}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
