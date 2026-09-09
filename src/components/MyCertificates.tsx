import React, { useState } from 'react';
import {
  Award, Printer, Link2, Check, Linkedin, MessageSquareHeart, ArrowRight, Clock,
} from 'lucide-react';
import { Certificate, EventConfig, UserProfile } from '../types';
import { formatHours, verificationUrl } from '../lib/certificates';
import { PrintableCertificate } from './PrintableCertificate';

interface MyCertificatesProps {
  currentUser: UserProfile;
  certificates: Certificate[];
  events: EventConfig[];
  /** Whether this person has already left feedback for a given event. */
  gaveFeedbackFor: (eventId: string) => boolean;
  onGiveFeedback: () => void;
}

/**
 * What somebody takes away.
 *
 * Two things happen after an event and they are related but not conditional:
 * the organisers would like feedback, and the attendee has earned a record of
 * their hours. The prompt for the first sits above the second and is not a
 * gate on it — a teacher who needs these hours for a licence renewal should
 * not have to praise the event to get them.
 *
 * The share link is the verification address rather than a file, because that
 * is what a LinkedIn credential entry or an email to a registrar wants: an
 * address that keeps answering, from the institution that issued it.
 */
export const MyCertificates: React.FC<MyCertificatesProps> = ({
  currentUser, certificates, events, gaveFeedbackFor, onGiveFeedback,
}) => {
  const [printing, setPrinting] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mine = certificates
    .filter((c) => c.userId === currentUser.id && !c.revokedAt)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const copy = async (c: Certificate) => {
    try {
      await navigator.clipboard.writeText(verificationUrl(c.id));
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2200);
    } catch { /* clipboard blocked; the address is on screen to copy by hand */ }
  };

  if (mine.length === 0) return null;

  const design = (c: Certificate) =>
    events.find((e) => e.id === c.eventId)?.certificate;

  return (
    <div className="space-y-4">
      {mine.map((c) => {
        const needsFeedback = !gaveFeedbackFor(c.eventId);
        return (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {needsFeedback && (
              <button
                onClick={onGiveFeedback}
                className="w-full text-left px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3 hover:bg-amber-100/70 transition-colors cursor-pointer"
              >
                <MessageSquareHeart className="w-4 h-4 text-amber-700 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-amber-900">
                    Share your glows and grows from {c.eventName}
                  </div>
                  <div className="text-[11px] text-amber-800/85">
                    It shapes the next one. Your certificate below is yours either way.
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
              </button>
            )}

            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">{c.eventName}</div>
                  <div className="text-[11px] text-slate-500">
                    {c.eventDates} · {c.sessionsAttended} session
                    {c.sessionsAttended === 1 ? '' : 's'} attended
                  </div>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
                    {formatHours(c.hours)}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">hours</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  Verification code
                </div>
                <div className="font-mono text-sm font-bold text-slate-800 break-all">{c.id}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Anyone can check this at {verificationUrl(c.id).replace(/^https?:\/\//, '')} — no
                  account needed.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPrinting(c)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print or save as PDF
                </button>
                <button
                  onClick={() => copy(c)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  {copied === c.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                  {copied === c.id ? 'Link copied' : 'Copy share link'}
                </button>
                {/* LinkedIn's own "add a credential" form, pre-filled. The
                    verification URL is what makes the entry checkable. */}
                <a
                  href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${
                    encodeURIComponent(c.eventName)}&organizationName=${
                    encodeURIComponent('Chadwick International')}&issueYear=${
                    new Date(c.issuedAt).getFullYear()}&issueMonth=${
                    new Date(c.issuedAt).getMonth() + 1}&certId=${
                    encodeURIComponent(c.id)}&certUrl=${encodeURIComponent(verificationUrl(c.id))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-700 hover:text-blue-700 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5 text-blue-700" />
                  Add to LinkedIn
                </a>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-3">
                <Clock className="w-3 h-3" />
                Issued {new Date(c.issuedAt).toLocaleDateString('en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        );
      })}

      {printing && design(printing) && (
        <PrintableCertificate certificates={[printing]} design={design(printing)!}
                              onClose={() => setPrinting(null)} />
      )}
    </div>
  );
};
