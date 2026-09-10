import React, { useMemo, useState } from 'react';
import { Search, Check, Loader2, KeyRound, ShieldCheck } from 'lucide-react';
import { EventConfig, UserProfile } from '../../types';
import { ROLE_LABEL, can } from '../../lib/permissions';
import { SectionHeader, Notice } from './formKit';

interface AdminAccessProps {
  users: UserProfile[];
  events: EventConfig[];
  currentUser: UserProfile;
  onGrantAccess: (userId: string, eventId: string, granted: boolean) => Promise<void> | void;
}

/**
 * Who may see which event.
 *
 * A programme is shown to the people an organiser has put on the event's
 * list, and to nobody else — not to every account, and not to the public
 * page. This is the list. Organisers and administrators see every event
 * without being on it.
 *
 * Two other roads lead here without a click on this screen: an invitation
 * made under Guests grants its event when that address first signs in, and
 * an access code redeemed by the person does the same.
 */
export const AdminAccess: React.FC<AdminAccessProps> = ({ users, events, currentUser, onGrantAccess }) => {
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => [...events].sort((a, b) =>
    Number(Boolean(a.isTemplate)) - Number(Boolean(b.isTemplate)) || a.startDate.localeCompare(b.startDate)),
    [events]);
  const shown = eventFilter === 'all' ? ordered : ordered.filter((e) => e.id === eventFilter);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !can(u, 'events:create'))
      .filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        || (u.organization ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [users, query]);

  const toggle = async (u: UserProfile, e: EventConfig) => {
    const key = `${u.id}:${e.id}`;
    const granted = !(u.eventAccess ?? []).includes(e.id);
    setBusy(key); setError(null);
    try { await onGrantAccess(u.id, e.id, granted); }
    catch (err) { setError((err as Error).message || 'That change was not saved.'); }
    finally { setBusy(null); }
  };

  const organisers = users.filter((u) => can(u, 'events:create')).length;

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={ShieldCheck}
        title="Access"
        subtitle="Who may see which event's programme. Tick a person under an event to put them on its list; organisers and administrators see every event."
      />

      <Notice tone="info">
        <span className="inline-flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />
        Invitations made under <strong>Guests</strong> grant their event automatically when that address signs in,
        and a redeemed access code does the same. {organisers} organiser{organisers === 1 ? '' : 's'} see everything without a tick.</span>
      </Notice>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search people by name, email or organisation"
                 className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600">
          <option value="all">All events</option>
          {ordered.map((e) => <option key={e.id} value={e.id}>{e.shortName}{e.isTemplate ? ' (sample)' : ''}</option>)}
        </select>
      </div>

      {error && <Notice tone="warn">{error}</Notice>}

      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
            <tr>
              <th className="p-3 font-semibold">Person</th>
              {shown.map((e) => (
                <th key={e.id} className="p-3 font-semibold text-center whitespace-nowrap">
                  {e.shortName}
                  {e.isTemplate && <span className="block text-[10px] font-normal text-slate-400">sample</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {people.length === 0 && (
              <tr><td colSpan={shown.length + 1} className="p-6 text-center text-slate-500">
                Nobody matches. People appear here once they have signed in at least once; to add someone who has not, invite them under Guests.
              </td></tr>
            )}
            {people.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{u.fullName}</div>
                      <div className="text-xs text-slate-500 truncate">{u.email} · {ROLE_LABEL[u.role]}{u.organization ? ` · ${u.organization}` : ''}</div>
                    </div>
                  </div>
                </td>
                {shown.map((e) => {
                  const on = (u.eventAccess ?? []).includes(e.id);
                  const key = `${u.id}:${e.id}`;
                  return (
                    <td key={e.id} className="p-3 text-center">
                      <button
                        onClick={() => void toggle(u, e)}
                        disabled={busy === key || u.id === currentUser.id}
                        title={on ? `Remove from ${e.shortName}` : `Add to ${e.shortName}`}
                        aria-pressed={on}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer disabled:cursor-default ${
                          on ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                             : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                        }`}
                      >
                        {busy === key ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Check className="w-4 h-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
