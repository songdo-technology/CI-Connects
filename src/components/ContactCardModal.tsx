import React, { useState } from 'react';
import { X, Mail, Linkedin, Building2, ShieldOff, Copy, Check, MessageSquare, Download } from 'lucide-react';
import { UserProfile } from '../types';
import { DIETARY_META } from '../lib/dietary';

interface ContactCardModalProps {
  profile: UserProfile | null;
  onClose: () => void;
  onMessage: (userId: string) => void;
  /** Security staff see identity verification rather than contact details. */
  viewerIsSecurity?: boolean;
}

/**
 * What another person sees after scanning someone's badge QR.
 *
 * Two different readings of the same badge:
 *   - An attendee scanning a peer gets a contact card, but ONLY if that
 *     person opted in via `shareContactOnScan`. Consent is checked here
 *     rather than at the QR, so revoking it takes effect immediately.
 *   - Security staff get identity and admission status instead of personal
 *     contact details, which is what they actually need to do the job.
 */
export const ContactCardModal: React.FC<ContactCardModalProps> = ({
  profile, onClose, onMessage, viewerIsSecurity = false,
}) => {
  const [copied, setCopied] = useState(false);
  if (!profile) return null;

  const consented = profile.shareContactOnScan;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard can be unavailable (permissions, insecure context) — the
         address is shown on screen regardless, so this is non-fatal. */
    }
  };

  const downloadVCard = () => {
    const vcard = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `FN:${profile.fullName}`,
      `TITLE:${profile.title}`,
      `ORG:${profile.organization};${profile.department}`,
      `EMAIL;TYPE=WORK:${profile.email}`,
      profile.linkedInUrl ? `URL:${profile.linkedInUrl}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\n');

    const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.fullName.replace(/\s+/g, '-')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Card header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
          <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4">
            <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight truncate">{profile.fullName}</h3>
              <p className="text-sm text-blue-100/90 truncate">{profile.title}</p>
              <p className="text-xs text-blue-200/70 truncate flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3 shrink-0" />
                {profile.organization}
              </p>
            </div>
          </div>
        </div>

        {viewerIsSecurity ? (
          /* ---- Security view: admission status, not contact details ---- */
          <div className="p-5 space-y-3">
            <div className={`rounded-xl border-2 p-4 ${profile.checkedIn ? 'bg-emerald-50 border-emerald-400' : 'bg-amber-50 border-amber-500'}`}>
              <div className="text-xs font-bold uppercase tracking-wide mb-1 text-slate-600">Admission status</div>
              <div className={`text-lg font-bold ${profile.checkedIn ? 'text-emerald-900' : 'text-amber-900'}`}>
                {profile.checkedIn ? 'Admitted to venue' : 'Not checked in'}
              </div>
              {profile.checkedInAt && (
                <div className="text-xs text-slate-600 mt-1">Checked in at {profile.checkedInAt}</div>
              )}
            </div>
            <dl className="text-sm divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {[
                ['Attendee type', profile.userType.replace(/_/g, ' ')],
                ['Role', profile.role],
                ['Department', profile.department],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500 text-xs">{k}</dt>
                  <dd className="font-semibold text-slate-800 text-xs capitalize text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Security view shows identity and admission only. Personal contact
              details are not disclosed here.
            </p>
          </div>
        ) : consented ? (
          /* ---- Peer view: full contact card ---- */
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">{profile.bio}</p>

            {profile.dietaryTag && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Dietary</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${DIETARY_META[profile.dietaryTag].className}`}>
                  {DIETARY_META[profile.dietaryTag].label}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={copyEmail}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-600 transition-colors text-left cursor-pointer"
              >
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate flex-1">{profile.email}</span>
                {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-300 shrink-0" />}
              </button>

              {profile.linkedInUrl && (
                <a
                  href={profile.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-600 transition-colors"
                >
                  <Linkedin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm text-slate-700 truncate flex-1">LinkedIn profile</span>
                </a>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { onMessage(profile.id); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
              <button
                onClick={downloadVCard}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        ) : (
          /* ---- Peer view, consent withheld ---- */
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <ShieldOff className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="font-bold text-slate-800 mb-1.5">Contact details not shared</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              {profile.fullName.split(' ')[0]} has not enabled contact sharing on
              their badge. You can still reach them through the colleague directory
              if they are listed there.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
