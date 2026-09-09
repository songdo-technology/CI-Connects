import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Building2, Loader2, Search, ArrowRight,
} from 'lucide-react';
import { Certificate } from '../types';
import { fetchCertificate } from '../lib/certificateLookup';
import { normaliseCode, formatHours } from '../lib/certificates';

interface VerifyCertificateProps {
  code: string;
  onOpenHub: () => void;
}

/**
 * The page a licensing body lands on.
 *
 * No account, no sign-in, no cookie banner: somebody in a registrar's office
 * has a piece of paper and one question — is this real, and what does it say.
 * Everything here answers that and stops.
 *
 * A wrong code and a revoked one are distinguished, because they mean opposite
 * things. "We have no record of this" is a possible forgery; "this was issued
 * and then withdrawn" is a fact about a real certificate, and reporting the
 * second as the first would be a false accusation.
 */
export const VerifyCertificate: React.FC<VerifyCertificateProps> = ({ code, onOpenHub }) => {
  const [typed, setTyped] = useState(code);
  const [looking, setLooking] = useState(Boolean(code));
  const [result, setResult] = useState<Certificate | null>(null);
  const [checked, setChecked] = useState(false);

  const look = async (raw: string) => {
    const normalised = normaliseCode(raw);
    setLooking(true); setChecked(false);
    setResult(normalised ? await fetchCertificate(normalised) : null);
    setLooking(false); setChecked(true);
  };

  useEffect(() => { if (code) void look(code); /* eslint-disable-next-line */ }, [code]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={onOpenHub} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-blue-200" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-900 leading-tight">CI Connects</div>
              <div className="text-[11px] text-slate-500 group-hover:text-blue-700 transition-colors">
                Chadwick International
              </div>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1.5">
          Verify a certificate
        </h1>
        <p className="text-sm text-slate-500 mb-7 leading-relaxed">
          Enter the code printed on a Chadwick International certificate of professional
          learning. No account is needed.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-8">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void look(typed); }}
            placeholder="CI-XXXX-XXXX-XXXX"
            spellCheck={false}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 font-mono tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={() => void look(typed)}
            disabled={looking || !typed.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Check
          </button>
        </div>

        {checked && result && !result.revokedAt && (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white overflow-hidden">
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-bold">Genuine certificate</span>
            </div>
            <dl className="p-6 space-y-4">
              {([
                ['Awarded to', result.fullName],
                ['Organisation', result.organization || '—'],
                ['Event', result.eventName],
                ['Dates', result.eventDates],
                ['Professional learning hours', `${formatHours(result.hours)} hours`],
                ['Sessions attended', String(result.sessionsAttended)],
                ['Issued', new Date(result.issuedAt).toLocaleDateString('en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Code', result.id],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-baseline gap-x-4">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:w-56 shrink-0">
                    {label}
                  </dt>
                  <dd className={`text-slate-900 ${
                    label === 'Awarded to' ? 'text-lg font-bold'
                    : label === 'Professional learning hours' ? 'font-bold'
                    : label === 'Code' ? 'font-mono text-sm' : 'text-sm'
                  }`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="px-6 pb-6 text-[11px] text-slate-400 leading-relaxed">
              Issued by Chadwick International, Songdo. Hours are counted from attendance
              recorded at the door of each session, not from registrations.
            </p>
          </div>
        )}

        {checked && result?.revokedAt && (
          <div className="rounded-2xl border-2 border-amber-500 bg-white overflow-hidden">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-bold">This certificate has been withdrawn</span>
            </div>
            <div className="p-6 text-sm text-slate-700 leading-relaxed">
              A certificate with this code was issued to <strong>{result.fullName}</strong> for{' '}
              {result.eventName}, and has since been withdrawn by the issuer on{' '}
              {new Date(result.revokedAt).toLocaleDateString('en-GB',
                { day: 'numeric', month: 'long', year: 'numeric' })}.
              It should not be accepted as evidence of professional learning.
            </div>
          </div>
        )}

        {checked && !result && (
          <div className="rounded-2xl border-2 border-slate-300 bg-white overflow-hidden">
            <div className="px-6 py-4 bg-slate-700 text-white flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-bold">No certificate with that code</span>
            </div>
            <div className="p-6 text-sm text-slate-600 leading-relaxed">
              Nothing here matches. Codes look like <span className="font-mono">CI-A4KM-7PQX-3TWY</span> —
              worth checking for a mistyped character before drawing any conclusion. If the
              code is right and this persists, write to{' '}
              <a href="mailto:songdo-technology@chadwickschool.org"
                 className="font-semibold text-blue-700 hover:underline">
                songdo-technology@chadwickschool.org
              </a>.
            </div>
          </div>
        )}

        <button onClick={onOpenHub}
                className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 transition-colors cursor-pointer">
          Chadwick International events
          <ArrowRight className="w-3 h-3" />
        </button>
      </main>
    </div>
  );
};
