import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UserPlus, X, Check, Copy, MailCheck, Clock } from 'lucide-react';
import {
  Invite, UserProfile, UserRole, EventConfig, generateAccessCode,
} from '../../types';
import { ROLE_LABEL } from '../../lib/permissions';
import { buildInvitePayload } from '../../lib/badge';
import { Field, inputClass, Notice, SectionHeader, ConfirmDelete } from './formKit';

interface AdminGuestsProps {
  invites: Invite[];
  profiles: UserProfile[];
  events: EventConfig[];
  currentUser: UserProfile;
  onSave: (invite: Invite, isNew: boolean) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

const GUEST_ROLES: UserRole[] = ['attendee', 'speaker', 'sponsor'];

/**
 * Guest invitations.
 *
 * External attendees have no Chadwick account, so they are recorded here
 * first. On their first sign-in the invitation is adopted — the name,
 * organisation and role recorded here become their profile, instead of them
 * arriving as an anonymous attendee somebody then has to fix up.
 *
 * The access code is a human confirmation, not the security. Authentication is
 * the emailed sign-in link, because a six-character code cannot be verified in
 * a browser without publishing every code to it.
 *
 * Each invitation carries a QR immediately, before the guest has ever signed
 * in — badges are printed the week before an event, and the scanner resolves an
 * invitation to whoever eventually claims it.
 */
export const AdminGuests: React.FC<AdminGuestsProps> = ({
  invites, profiles, events, currentUser, onSave, onDelete,
}) => {
  const [editing, setEditing] = useState<Invite | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const eventId = events.find((e) => e.isFeatured)?.id ?? events[0]?.id;

  const rows = useMemo(
    () => [...invites].sort((a, b) => (b.invitedAt ?? '').localeCompare(a.invitedAt ?? '')),
    [invites]);

  const blank = (): Invite => ({
    id: `inv-${Date.now()}`,
    email: '', fullName: '', organization: '', title: '',
    role: 'attendee',
    accessCode: generateAccessCode(),
    eventId,
    invitedBy: currentUser.id,
    invitedAt: new Date().toISOString(),
  });

  const save = async () => {
    if (!editing) return;
    const email = editing.email.trim().toLowerCase();
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (email.endsWith('@chadwickschool.org')) {
      setError('Chadwick accounts sign in with Google and need no invitation.');
      return;
    }
    if (!editing.fullName.trim()) { setError('Enter the guest’s name.'); return; }
    const clash = invites.find((i) => i.email.toLowerCase() === email && i.id !== editing.id);
    if (clash) { setError(`${email} has already been invited.`); return; }

    try { await onSave({ ...editing, email }, isNew); setEditing(null); setError(null); }
    catch (e) { setError((e as Error).message); }
  };

  const copy = async (invite: Invite) => {
    const text =
      `You are invited to ${events.find((e) => e.id === invite.eventId)?.name ?? 'a Chadwick event'}.\n\n` +
      `Sign in at ${window.location.origin} using this email address: ${invite.email}\n` +
      `Choose "I'm attending as a guest" and we will email you a one-tap sign-in link.\n\n` +
      `Your access code is ${invite.accessCode} — keep it for the registration desk.`;
    try { await navigator.clipboard.writeText(text); setCopied(invite.id); setTimeout(() => setCopied(null), 2000); }
    catch { /* clipboard blocked; the text is on screen */ }
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'Invite a guest' : `Editing: ${editing.fullName || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email" hint="Where the sign-in link is sent. This is their identity.">
              <input className={inputClass} type="email" value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                placeholder="name@theirschool.org" />
            </Field>
            <Field label="Full name">
              <input className={inputClass} value={editing.fullName}
                onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Organisation">
              <input className={inputClass} value={editing.organization}
                onChange={(e) => setEditing({ ...editing, organization: e.target.value })}
                placeholder="Seoul Foreign School" />
            </Field>
            <Field label="Title" hint="Optional.">
              <input className={inputClass} value={editing.title ?? ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Role" hint="What they arrive as.">
              <select className={inputClass} value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRole })}>
                {GUEST_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Event">
            <select className={inputClass} value={editing.eventId ?? ''}
              onChange={(e) => setEditing({ ...editing, eventId: e.target.value || undefined })}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-600">Access code</div>
              <div className="text-2xl font-bold tracking-[0.2em] text-slate-900 mt-0.5">
                {editing.accessCode}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-snug">
                For the registration desk to confirm identity. Sign-in itself is the
                emailed link — a short code cannot be checked securely in a browser.
              </p>
            </div>
            <button
              onClick={() => setEditing({ ...editing, accessCode: generateAccessCode() })}
              className="shrink-0 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-600 cursor-pointer"
            >
              Regenerate
            </button>
          </div>

          {error && <Notice>{error}</Notice>}
          <div className="flex gap-2">
            <button onClick={save} className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer">
              {isNew ? 'Create invitation' : 'Save changes'}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={UserPlus} title="Guest invitations"
        subtitle={`${rows.length} invited · ${rows.filter((i) => i.claimedAt).length} signed in. Chadwick accounts need no invitation — they sign in with Google.`}
        action={{ label: 'Invite a guest', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />

      <div className="grid sm:grid-cols-2 gap-4">
        {rows.length === 0 && (
          <p className="sm:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400 italic">
            No guests invited yet.
          </p>
        )}
        {rows.map((i) => {
          const claimed = Boolean(i.claimedAt);
          const person = profiles.find((p) => p.email.toLowerCase() === i.email.toLowerCase());
          return (
            <div key={i.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4">
              <div className="shrink-0">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <QRCodeSVG
                    value={buildInvitePayload(i.id, i.eventId ?? '')}
                    size={72} level="M" bgColor="#ffffff" fgColor="#002b54"
                  />
                </div>
                <div className="text-[10px] text-center text-slate-400 mt-1">Scan at door</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 truncate">{i.fullName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                    {ROLE_LABEL[i.role]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">{i.email}</div>
                <div className="text-[11px] text-slate-400 truncate">{i.organization}</div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold tracking-widest text-slate-800">
                    {i.accessCode}
                  </span>
                  {claimed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      <MailCheck className="w-3 h-3" /> Signed in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <Clock className="w-3 h-3" /> Not yet
                    </span>
                  )}
                  {person?.checkedIn && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                      At venue
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    onClick={() => copy(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-blue-600 cursor-pointer"
                  >
                    {copied === i.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copied === i.id ? 'Copied' : 'Copy invite text'}
                  </button>
                  <ConfirmDelete onConfirm={() => onDelete(i.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
