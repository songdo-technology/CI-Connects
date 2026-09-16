import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { Event } from '../lib/types';
import { useAuth } from '../lib/auth';
import { joinEvent, describeJoin } from '../lib/join';
import { Button, Field, Input, Select } from './ui';

/**
 * The event code, typed in. Organisers hand the code out — on the
 * invitation, a slide, the door — and this is where it goes: pick the event
 * (unless the page already knows it), enter the code, and the event opens.
 */
export const JoinByCode: React.FC<{ events: Event[]; fixed?: Event; contactEmail?: string }> = ({ events, fixed, contactEmail }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [eventId, setEventId] = useState(fixed?.id ?? events[0]?.id ?? '');
  useEffect(() => { if (!fixed && !events.some((e) => e.id === eventId)) setEventId(events[0]?.id ?? ''); }, [events, eventId, fixed]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = fixed ?? events.find((e) => e.id === eventId);
  if (!fixed && events.length === 0) return <p className="text-sm text-ink-500">There is no event open to join right now.</p>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !target) return;
    if (code.trim().length < 4) { setError('Enter the code you were given.'); return; }
    setBusy(true); setError(null);
    try { await joinEvent(profile, target.id, code); navigate(`/e/${target.slug}`); }
    catch (err) { setError(describeJoin(err)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="w-full max-w-md mx-auto text-left">
      <div className={`grid gap-3 ${fixed ? '' : 'sm:grid-cols-[minmax(0,1fr)_10rem]'}`}>
        {!fixed && (
          <Field label="Event"><Select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        )}
        <Field label="Event code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7F3PX" className="font-mono tracking-[0.2em] uppercase" autoComplete="off" spellCheck={false} /></Field>
      </div>
      {error && <p className="text-xs text-rose-700 mt-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <Button type="submit" busy={busy} disabled={!target}><KeyRound className="w-4 h-4" />Join{target ? ` ${target.name}` : ''}</Button>
        {contactEmail && <a href={`mailto:${contactEmail}`} className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2">No code? Write to {contactEmail}</a>}
      </div>
    </form>
  );
};
