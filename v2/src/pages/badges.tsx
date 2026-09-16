import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { IdCardLanyard } from 'lucide-react';
import { Event, Profile } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch } from '../lib/hooks';
import { isStaff, canSeeEvent } from '../lib/roles';
import { eventPhase } from '../lib/time';
import { Reveal } from '../lib/motion';
import { BadgeCard } from '../components/Badge';
import { Empty, PageHeader, Spinner } from '../components/ui';

/** One event's badge in the wallet, with what the wallet needs from that
 *  event: seats held, whether the person speaks, whether they have arrived. */
const WalletBadge: React.FC<{ event: Event; profile: Profile }> = ({ event, profile }) => {
  const sessions = useWatch('sessions', [{ field: 'eventId', op: '==', value: event.id }]);
  const attendance = useWatch('attendance', [{ field: 'eventId', op: '==', value: event.id }, { field: 'userId', op: '==', value: profile.id }]);
  const me = profile.name.trim().toLowerCase();
  const reserved = sessions.items.filter((s) => s.reservedUserIds.includes(profile.id)).length;
  const speaker = sessions.items.some((s) => s.speakers.some((p) => p.name.trim().toLowerCase() === me));
  const arrived = attendance.items.find((a) => a.sessionId === null) ?? null;
  return (
    <Link to={`/e/${event.slug}/badge`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-[1.75rem]" title={`Your ${event.name} badge`}>
      <BadgeCard event={event} profile={profile} speaker={speaker} reserved={reserved} arrived={arrived} size="wallet" />
    </Link>
  );
};

/**
 * Everyone's own badges — one per event they are on. Made the moment a
 * person is listed for an event; nothing to request.
 */
export const BadgesPage: React.FC = () => {
  const { profile, invitedEventIds } = useAuth();
  const staff = isStaff(profile);
  const published = useWatch('events', [{ field: 'status', op: '==', value: 'published' }], !staff);
  const all = useWatch('events', [], staff);
  const events = staff ? all.items : published.items;
  const ready = staff ? all.ready : published.ready;
  const mine = useMemo(() => {
    const rank = (e: Event) => (eventPhase(e.startDate, e.endDate) === 'past' ? 1 : 0);
    return events.filter((e) => canSeeEvent(profile, e.id, invitedEventIds))
      .sort((a, b) => rank(a) - rank(b) || (rank(a) ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)));
  }, [events, profile, invitedEventIds]);
  if (!profile) return null;
  return (
    <div className="max-w-6xl mx-auto px-5 py-6 lg:py-8">
      <PageHeader title="Your badges" description="One for every event you are on. Show the code at the entrance and at each room — it works from any phone signed in as you." />
      {!ready ? <Spinner /> : mine.length === 0 ? (
        <Empty icon={IdCardLanyard} title="No badges yet" body="A badge appears here the moment an organiser lists you for an event." />
      ) : (
        <Reveal stagger={0.08} className="flex flex-wrap gap-6">
          {mine.map((e) => <WalletBadge key={e.id} event={e} profile={profile} />)}
        </Reveal>
      )}
    </div>
  );
};
