import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  UserPlus, X, Check, Copy, MailCheck, Clock, ShieldCheck, RefreshCw, Loader2,
} from 'lucide-react';
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
  /** Rewrites every access-code lookup. The repair for invitations created
   *  before codes were checkable, or brought in through a spreadsheet. */
  onRepublishCodes: () => Promise<number>;
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
  invites, profiles, events, currentUser, onSave, onDelete, onRepublishCodes,
}) => {
  const [editing, setEditing] = useState<Invite | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<number | null>(null);

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

  /**
   * The message an organiser sends.
   *
   * Firebase's own email is a bare "click to sign in" and cannot carry any of
   * this, so the instructions have to travel in the invitation. It is written
   * to be pasted whole and to answer, in order, the questions a first-time
   * attendee actually has: where do I go, how do I get in, and what do you
   * need from me.
   */
  const inviteText = (invite: Invite) => {
    const event = events.find((e) => e.id === invite.eventId);
    const eventUrl = event
      ? `${window.location.origin}/?event=${event.slug}`
      : window.location.origin;

    return [
      `You are invited to ${event?.name ?? 'a Chadwick International event'}.`,
      event?.dateLabel ? `${event.dateLabel} · ${event.venueName}` : '',
      '',
      `Event details and full programme: ${eventUrl}`,
      '',
      'HOW TO SIGN IN',
      `1. Go to ${window.location.origin}`,
      '2. Choose "I\'m attending as a guest"',
      `3. Enter this email address: ${invite.email}`,
      '4. We will email you a one-tap sign-in link — no password to create or remember.',
      '',
      `Your access code is ${invite.accessCode}. Keep it for the registration desk.`,
      '',
      'PLEASE COMPLETE YOUR PROFILE',
      'Once signed in, open "My Profile". A few minutes here makes the event work',
      'better for you and for everyone trying to find you.',
      '',
      '• Full name — your first and last name.',
      '• Preferred name — what you actually go by. This is printed large on your',
      '  badge, so "Alex" rather than "Alexandra" if that is what you answer to.',
      '• School or organisation — printed on your badge under your name.',
      '• Your role or job title.',
      '• A professional photo — head and shoulders, plain background. It appears on',
      '  your badge and in the colleague directory.',
      '• LinkedIn, X or any other links you are happy for colleagues to have. These',
      '  become clickable in the directory, which is how most people follow up',
      '  afterwards.',
      '',
      'You can also reserve sessions, choose your meals, and control who may',
      'contact you — all from the same place.',
      '',
      'See you there.',
    ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
  };

  const copy = async (invite: Invite) => {
    try {
      await navigator.clipboard.writeText(inviteText(invite));
      setCopied(invite.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; fall back to showing the text to copy by hand.
      setPreview(invite.id);
    }
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

  const republish = async () => {
    setPublishing(true);
    try { setPublished(await onRepublishCodes()); }
    finally { setPublishing(false); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader icon={UserPlus} title="Guest invitations"
        subtitle={`${rows.length} invited · ${rows.filter((i) => i.claimedAt).length} signed in. Chadwick accounts need no invitation — they sign in with Google.`}
        action={{ label: 'Invite a guest', onClick: () => { setEditing(blank()); setIsNew(true); setError(null); } }} />

      {/* An invitation whose code cannot be checked is one nobody can use, and
          nothing else in the platform would show that. Republishing is
          idempotent, so running it when unsure costs nothing. */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
        <p className="text-[11px] text-slate-500 leading-relaxed flex-1 min-w-[16rem]">
          Guests sign in with their invited address <em>and</em> this code — nobody can
          register for an event they were not added to. Run this after importing
          invitations from a spreadsheet, or if a guest reports their code being refused.
        </p>
        <button
          onClick={republish}
          disabled={publishing || rows.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-[11px] font-semibold hover:border-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {published !== null ? `${published} codes published` : 'Republish access codes'}
        </button>
      </div>

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
                  <button
                    onClick={() => setPreview(preview === i.id ? null : i.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-blue-600 cursor-pointer"
                  >
                    {preview === i.id ? 'Hide' : 'Preview'}
                  </button>
                  <ConfirmDelete onConfirm={() => onDelete(i.id)} />
                </div>

                {preview === i.id && (
                  <pre className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] leading-relaxed text-slate-700 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">
                    {inviteText(i)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
