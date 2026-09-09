import React, { useState } from 'react';
import {
  Building2, ArrowRight, Mail, KeyRound, AlertCircle, CalendarDays, Users,
  QrCode, UtensilsCrossed, Chrome,
} from 'lucide-react';
import { UserProfile, AuthMethod } from '../types';
import { useAuth } from '../lib/AuthProvider';
import { ALLOWED_EMAIL_DOMAIN as ALLOWED_DOMAIN } from '../lib/firebase';
import { describeAuthProblem } from '../lib/auth';

interface LandingPageProps {
  profiles: UserProfile[];
  onSignIn: (user: UserProfile, method: AuthMethod) => void;
  onBack: () => void;
  /** What the visitor is going back to — the hub, or one event by name. */
  backLabel: string;
}

/**
 * Sign-in surface. Two doors into the same platform:
 *
 *  - Chadwick staff and students authenticate with Workspace SSO.
 *  - External guests redeem the access code emailed with their invitation,
 *    since they have no Chadwick account to sign in with.
 *
 * Both doors are real when Firebase is configured: Google for Workspace
 * accounts, an emailed single-use link for everyone else. The seeded-directory
 * fallback below survives only for `auth.live === false` — the design preview
 * build, where the flow has to be walkable without sending real mail.
 */


export const LandingPage: React.FC<LandingPageProps> = ({ profiles, onSignIn, onBack, backLabel }) => {
  const auth = useAuth();
  const [mode, setMode] = useState<'choose' | 'guest' | 'password'>('choose');
  /** Signing in to an account they have, or making one. */
  const [passwordMode, setPasswordMode] = useState<'in' | 'up'>('up');
  const [pw, setPw] = useState({ email: '', password: '', fullName: '' });
  const [reset, setReset] = useState(false);
  const [ssoPickerOpen, setSsoPickerOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const chadwickAccounts = profiles.filter((p) => p.email.endsWith('@chadwickschool.org'));
  const guestAccounts = profiles.filter((p) => !p.email.endsWith('@chadwickschool.org'));

  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = pw.email.trim().toLowerCase();
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return setError('That is a Chadwick address — use "Continue with Chadwick Google" instead.');
    }
    if (passwordMode === 'up') {
      if (!pw.fullName.trim()) return setError('Enter your name — it appears on your badge.');
      if (pw.password.length < 8) return setError('Use at least eight characters.');
    }
    setBusy(true);
    try {
      if (passwordMode === 'up') await auth.createAccount(email, pw.password, pw.fullName);
      else await auth.signInWithPassword(email, pw.password);
    } catch { /* the message is already on screen via auth.error */ }
    finally { setBusy(false); }
  };

  const handleReset = async () => {
    const email = pw.email.trim().toLowerCase();
    if (!email.includes('@')) return setError('Enter your email address first.');
    setBusy(true);
    try { await auth.resetPassword(email); setReset(true); }
    catch { /* surfaced via auth.error */ }
    finally { setBusy(false); }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const email = guestEmail.trim().toLowerCase();
    if (!email) return setError('Enter the email address your invitation was sent to.');
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return setError('That is a Chadwick address — use "Continue with Chadwick Google" instead.');
    }
    if (!auth.live) {
      // Demo build: fall back to the seeded directory so the flow is walkable
      // without sending real mail.
      const match = guestAccounts.find((p) => p.email.toLowerCase() === email);
      if (!match) return setError('No invitation found for that address.');
      return onSignIn(match, 'guest_code');
    }

    setBusy(true);
    try {
      await auth.sendGuestLink(email);
      setSent(true);
    } catch (err) {
      setError(describeAuthProblem(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* ---------- Welcome panel ---------- */}
      <div className="lg:w-[55%] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white px-6 sm:px-10 lg:px-16 py-12 lg:py-16 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-blue-200/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-200" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-blue-100 uppercase">
              Chadwick International
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5">
            Welcome to <span className="text-blue-200">CI Connects</span>
          </h1>

          <p className="text-lg sm:text-xl text-blue-50/90 leading-relaxed mb-4">
            Bringing our community together — our own event management platform,
            built at Chadwick, for Chadwick.
          </p>
          <p className="text-sm text-blue-100/70 leading-relaxed mb-10">
            Plan your schedule, reserve your seat, choose your meals, and meet the
            people behind the work. Everything for the day, in one place.
          </p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-md">
            {[
              { icon: CalendarDays, label: 'Build your agenda' },
              { icon: QrCode, label: 'Badge & check-in' },
              { icon: UtensilsCrossed, label: 'Choose your meals' },
              { icon: Users, label: 'Connect with colleagues' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-blue-50/90">
                <Icon className="w-4 h-4 text-blue-200 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Sign-in panel ---------- */}
      <div className="lg:w-[45%] flex items-center justify-center px-6 sm:px-10 py-12 lg:py-16">
        <div className="w-full max-w-md">
          {mode === 'choose' ? (
            <>
              <button
                onClick={onBack}
                className="text-xs font-semibold text-slate-500 hover:text-blue-700 mb-5 cursor-pointer"
              >
                ← Back to {backLabel}
              </button>
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Sign in</h2>
              <p className="text-sm text-slate-500 mb-8">
                Use your Chadwick account, or the invitation sent to your email.
              </p>

              {/* Chadwick SSO */}
              <button
                onClick={() => (auth.live ? auth.signIn() : setSsoPickerOpen((v) => !v))}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-[13px] font-bold text-blue-600 shrink-0">
                    G
                  </span>
                  Continue with Chadwick Google
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <p className="text-[11px] text-slate-400 mt-2 px-1">
                For staff, faculty and students with an @chadwickschool.org account.
              </p>

              {auth.error && (
                <div className="mt-3 flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">{auth.error}</p>
                </div>
              )}

              {!auth.live && ssoPickerOpen && (
                <div className="mt-3 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Choose an account
                  </div>
                  {chadwickAccounts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSignIn(p, 'google_sso')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</div>
                        <div className="text-xs text-slate-500 truncate">{p.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 my-7">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                  Not at Chadwick?
                </span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Three routes rather than one, because the group outside the
                  school is not uniform: some have a Google account and some
                  work somewhere that does not use one, and telling a teacher
                  to open an account with a company in order to read a set of
                  slides is a strange thing for a school to require. */}
              <div className="space-y-2">
                {([
                  ['google', 'Continue with a personal Google account', Chrome,
                   () => void auth.signIn('any')],
                  ['password', 'Create an account with a password', KeyRound,
                   () => { setMode('password'); setPasswordMode('up'); }],
                  ['link', 'Email me a sign-in link instead', Mail,
                   () => setMode('guest')],
                ] as const).map(([key, label, Icon, run]) => (
                  <button
                    key={key}
                    onClick={run}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl bg-white border-2 border-slate-200 text-slate-800 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3 text-left">
                      <Icon className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                      {label}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-400 mt-3 px-1 leading-relaxed">
                An account is free and gets you a profile, the materials from events you
                attend, and your certificates. Registering for a particular conference
                needs an invitation code, which you redeem once you are in.
              </p>
            </>
          ) : mode === 'password' ? (
            <>
              <button
                onClick={() => { setMode('choose'); setReset(false); }}
                className="text-xs font-semibold text-slate-500 hover:text-blue-700 mb-5 cursor-pointer"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
                {passwordMode === 'up' ? 'Create your account' : 'Sign in'}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                {passwordMode === 'up'
                  ? 'Free, and yours to keep — your profile, certificates and the materials from anything you attend.'
                  : 'Welcome back.'}
              </p>

              <form onSubmit={handlePassword} className="space-y-4">
                {passwordMode === 'up' && (
                  <div>
                    <label htmlFor="pw-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Full name
                    </label>
                    <input id="pw-name" value={pw.fullName}
                           onChange={(e) => setPw({ ...pw, fullName: e.target.value })}
                           placeholder="Jenny Lee"
                           className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  </div>
                )}
                <div>
                  <label htmlFor="pw-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Email
                  </label>
                  <input id="pw-email" type="email" value={pw.email}
                         onChange={(e) => setPw({ ...pw, email: e.target.value })}
                         placeholder="you@yourschool.org"
                         className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label htmlFor="pw-pass" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Password
                  </label>
                  <input id="pw-pass" type="password" value={pw.password}
                         onChange={(e) => setPw({ ...pw, password: e.target.value })}
                         placeholder={passwordMode === 'up' ? 'At least eight characters' : ''}
                         className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>

                {(error || auth.error) && (
                  <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">{error ?? auth.error}</p>
                  </div>
                )}
                {reset && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
                    If that address has an account, a reset link is on its way.
                  </p>
                )}

                <button type="submit" disabled={busy}
                        className="w-full px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                  {busy ? 'Working…' : passwordMode === 'up' ? 'Create account' : 'Sign in'}
                </button>
              </form>

              <div className="flex items-center justify-between gap-3 mt-4">
                <button
                  onClick={() => { setPasswordMode(passwordMode === 'up' ? 'in' : 'up'); setError(null); }}
                  className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  {passwordMode === 'up' ? 'I already have an account' : 'Create an account instead'}
                </button>
                {passwordMode === 'in' && (
                  <button onClick={handleReset}
                          className="text-xs text-slate-500 hover:text-blue-700 cursor-pointer">
                    Forgotten password?
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode('choose'); setError(null); }}
                className="text-xs font-semibold text-slate-500 hover:text-blue-700 mb-5 cursor-pointer"
              >
                ← Back to sign-in options
              </button>

              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Guest access</h2>
              <p className="text-sm text-slate-500 mb-7">
                Enter the email your invitation was sent to, along with the access
                code it contained.
              </p>

              <form onSubmit={handleGuestSubmit} className="space-y-4">
                <div>
                  <label htmlFor="guest-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Invitation email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="guest-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="you@yourschool.org"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  We email you a one-tap sign-in link — no password to create or
                  remember. An account lets you keep a profile, reach materials from
                  events you attended, and hold your certificates. Registering for a
                  particular conference needs an invitation, which you can redeem once
                  you are in.
                </p>

                {error && (
                  <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full px-5 py-3.5 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {busy ? 'Sending…' : auth.live ? 'Email me a sign-in link' : 'Continue'}
                </button>
              </form>

              {sent && (
                <div className="mt-5 px-4 py-4 rounded-xl bg-emerald-50 border border-emerald-300">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 mb-1">
                    <Mail className="w-4 h-4" />
                    Check your inbox
                  </div>
                  <p className="text-xs text-emerald-900/80 leading-relaxed">
                    We sent a sign-in link to <strong>{guestEmail.trim().toLowerCase()}</strong>.
                    Open it on any device to finish signing in. It may take a
                    minute, and it is worth checking spam.
                  </p>
                </div>
              )}
            </>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed mt-8 text-center">
            {auth.live
              ? 'Sign-in is handled by Google. CI Connects never sees your password.'
              : 'Demo build — sign-in is simulated and no credentials are collected or transmitted.'}
          </p>
        </div>
      </div>
    </div>
  );
};
