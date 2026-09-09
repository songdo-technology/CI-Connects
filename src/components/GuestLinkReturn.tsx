import React, { useEffect, useState } from 'react';
import { Building2, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';

/**
 * Catches a guest returning from their emailed sign-in link.
 *
 * The link arrives as a fresh page load carrying credentials in the URL, so
 * this has to run before any sign-in form renders — otherwise the guest is
 * shown a form asking them to do the thing they have just done.
 *
 * It redeems automatically when this browser is the one that asked for the
 * link. Opening the link on a different device is common — requested on a
 * laptop, opened on a phone — and there the address cannot be recovered from
 * local storage, so it is asked for once.
 */
export const GuestLinkReturn: React.FC = () => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);

  useEffect(() => {
    if (auth.guestEmailHint) {
      setBusy(true);
      auth.completeGuestLink()
        .catch((e: Error) => { setError(e.message); setNeedsEmail(true); })
        .finally(() => setBusy(false));
    } else {
      setNeedsEmail(true);
    }
    // Runs once: redeeming twice would consume an already-used link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await auth.completeGuestLink(email.trim().toLowerCase()); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Signing you in</h1>
            <p className="text-xs text-slate-500">CI Connects · guest access</p>
          </div>
        </div>

        {busy && !needsEmail && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            Verifying your link…
          </div>
        )}

        {needsEmail && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Confirm the email address this link was sent to. We ask because
              you opened it on a different device from the one that requested it.
            </p>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourschool.org"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
