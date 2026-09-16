import React, { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useWatch } from '../lib/hooks';
import { isStaff, canSeeEvent } from '../lib/roles';
import { joinEvent, describeJoin } from '../lib/join';
import { formatRange } from '../lib/time';
import { JoinByCode } from '../components/Join';
import { Button, Card, Empty, Notice, Spinner } from '../components/ui';

/** What an invitation link opens: `/join/<eventId>?c=<code>`. Signed in,
 *  with the code in the link, it joins on its own and goes to the event. */
export const JoinPage: React.FC = () => {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const code = (params.get('c') ?? '').trim();
  const { profile, invitedEventIds } = useAuth();
  const staff = isStaff(profile);
  const filters = [{ field: 'id', op: '==' as const, value: eventId }, ...(staff ? [] : [{ field: 'status', op: '==' as const, value: 'published' }])];
  const { items, ready } = useWatch('events', filters, Boolean(eventId));
  const event = items[0] ?? null;
  const allowed = event ? canSeeEvent(profile, event.id, invitedEventIds) : false;
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile || !event || allowed || !code || state !== 'idle') return;
    setState('busy');
    joinEvent(profile, event.id, code).then(() => setState('idle')).catch((e) => { setState('error'); setError(describeJoin(e)); });
  }, [profile, event, allowed, code, state]);
  if (!ready) return <Spinner />;
  if (!event) return <div className="max-w-md mx-auto"><Empty icon={KeyRound} title="No such event" body="The link may be old, or the event is not published yet." action={<Button to="/dashboard">Dashboard</Button>} /></div>;
  if (allowed) return <Navigate to={`/e/${event.slug}`} replace />;
  return (
    <div className="max-w-md mx-auto">
      <Card className="p-6">
        <div className="eyebrow mb-1">Joining</div>
        <h2 className="font-display font-bold text-2xl text-ink-900">{event.name}</h2>
        <div className="text-sm text-ink-500 mt-1">{formatRange(event.startDate, event.endDate)} · {event.venueName}</div>
        <div className="mt-5">
          {state === 'busy'
            ? <div className="flex items-center gap-2 text-sm text-ink-500"><Spinner />Checking your code…</div>
            : <>{error && <Notice tone="error" className="mb-3">{error}</Notice>}<JoinByCode events={[event]} fixed={event} /></>}
        </div>
      </Card>
    </div>
  );
};
