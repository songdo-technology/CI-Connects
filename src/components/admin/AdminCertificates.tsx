import React, { useMemo, useState } from 'react';
import {
  Award, Check, Loader2, AlertTriangle, Printer, Info, ShieldCheck, X,
} from 'lucide-react';
import {
  EventConfig, Session, UserProfile, AttendanceRecord, FeedbackEntry,
  Certificate, CertificateDesign,
} from '../../types';
import { BatchOperation } from '../../lib/data/store';
import {
  assessEligibility, buildCertificate, defaultCertificateDesign, formatHours,
} from '../../lib/certificates';
import { PrintableCertificate } from '../PrintableCertificate';
import { Field, inputClass, Notice } from './formKit';

interface AdminCertificatesProps {
  currentUser: UserProfile;
  events: EventConfig[];
  sessions: Session[];
  users: UserProfile[];
  attendance: AttendanceRecord[];
  feedback: FeedbackEntry[];
  certificates: Certificate[];
  onSaveEvent: (event: EventConfig, isNew: boolean) => Promise<void> | void;
  onCommit: (ops: BatchOperation[]) => Promise<void>;
}

/**
 * Designing and issuing certificates of professional learning.
 *
 * Off unless an organiser turns it on, per event. A parent evening or an open
 * house has nothing to certify, and issuing certificates for everything is how
 * they stop meaning anything.
 *
 * Nothing is issued in bulk without the list having been read. The hours on
 * these documents are submitted to licensing bodies in the school's name, so
 * the screen shows what each person actually attended, why anyone is excluded,
 * and never quietly rounds a gap away.
 */
export const AdminCertificates: React.FC<AdminCertificatesProps> = ({
  currentUser, events, sessions, users, attendance, feedback, certificates,
  onSaveEvent, onCommit,
}) => {
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Certificate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const event = events.find((e) => e.id === eventId);
  const design = event?.certificate;

  const rows = useMemo(() => {
    if (!event || !design?.enabled) return [];
    return assessEligibility({
      event, design, sessions, attendance, users, feedback, certificates,
    });
  }, [event, design, sessions, attendance, users, feedback, certificates]);

  const eligible = rows.filter((r) => r.qualifies && !r.existing);
  const issued = rows.filter((r) => r.existing);
  const blocked = rows.filter((r) => !r.qualifies);

  const patch = (changes: Partial<CertificateDesign>) => {
    if (!event) return;
    const base = design ?? defaultCertificateDesign(event);
    void onSaveEvent({ ...event, certificate: { ...base, ...changes } }, false);
  };

  const issue = async (which: typeof eligible) => {
    if (!event || which.length === 0) return;
    setBusy(true); setError(null);
    try {
      const made = which.map((e) => buildCertificate(event, e, currentUser.id));
      await onCommit(made.map((c) => ({ op: 'create', key: 'certificates', item: c } as BatchOperation)));
      setPicked(new Set());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async (c: Certificate) => {
    setBusy(true); setError(null);
    try {
      // Marked, never deleted: a code already printed on somebody's document
      // has to keep answering, and the honest answer is "revoked".
      await onCommit([{
        op: 'update', key: 'certificates', id: c.id,
        patch: { revokedAt: new Date().toISOString() },
      } as BatchOperation]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Award className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Certificates of professional learning</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Teachers submit these for licence renewal, so the hours have to be defensible.
          They are counted from door scans, never from bookings.
        </p>
        <Field label="Event">
          <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
      </div>

      {!event ? null : !design?.enabled ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <Award className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {event.name} issues no certificates
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            Which is right for anything without professional learning to certify — a
            parent evening, an open house, a student showcase. Certificates mean
            something because they are not issued for everything.
          </p>
          <button
            onClick={() => patch(defaultCertificateDesign(event))}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Turn certificates on for this event
          </button>
        </div>
      ) : (
        <>
          {/* ---------- Design ---------- */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-900">How it reads</h4>
              <button
                onClick={() => patch({ enabled: false })}
                className="text-[11px] font-semibold text-slate-500 hover:text-amber-700 cursor-pointer"
              >
                Turn off for this event
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title">
                <input className={inputClass} value={design.title}
                       onChange={(e) => patch({ title: e.target.value })} />
              </Field>
              <Field label="Issued by">
                <input className={inputClass} value={design.issuerName}
                       onChange={(e) => patch({ issuerName: e.target.value })} />
              </Field>
            </div>

            <Field label="Statement" hint="Printed under the name.">
              <input className={inputClass} value={design.bodyText ?? ''}
                     onChange={(e) => patch({ bodyText: e.target.value })}
                     placeholder={`for participation in ${event.name}`} />
            </Field>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="How hours are counted">
                <select className={inputClass} value={design.hoursPolicy}
                        onChange={(e) => patch({ hoursPolicy: e.target.value as 'fixed' | 'attended' })}>
                  <option value="attended">From sessions actually attended</option>
                  <option value="fixed">The same for everyone</option>
                </select>
              </Field>
              <Field label={design.hoursPolicy === 'fixed' ? 'Hours awarded' : 'Maximum hours'}
                     hint={design.hoursPolicy === 'fixed' ? undefined : 'Caps what the day can award.'}>
                <input type="number" min={0} step={0.25} className={inputClass} value={design.hours}
                       onChange={(e) => patch({ hours: Number(e.target.value) })} />
              </Field>
              <Field label="Minimum sessions">
                <input type="number" min={0} className={inputClass} value={design.minSessions}
                       onChange={(e) => patch({ minSessions: Number(e.target.value) })} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Signed by">
                <input className={inputClass} value={design.signatoryName}
                       onChange={(e) => patch({ signatoryName: e.target.value })}
                       placeholder="Ted Hill" />
              </Field>
              <Field label="Their title">
                <input className={inputClass} value={design.signatoryTitle}
                       onChange={(e) => patch({ signatoryTitle: e.target.value })} />
              </Field>
            </div>

            <Field label="Accreditation note" hint="Optional. Printed small, for wording a licensing body requires.">
              <input className={inputClass} value={design.accreditationNote ?? ''}
                     onChange={(e) => patch({ accreditationNote: e.target.value })} />
            </Field>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" className="accent-blue-600 mt-0.5"
                     checked={Boolean(design.requireFeedback)}
                     onChange={(e) => patch({ requireFeedback: e.target.checked })} />
              <span>
                <span className="text-sm text-slate-700">Require feedback before releasing</span>
                <span className="block text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  Withholding a document somebody needs for their licence until they rate
                  the event is coercive, and it distorts the feedback you get back. Most
                  events should leave this off and simply ask.
                </span>
              </span>
            </label>
          </div>

          {error && <Notice>{error}</Notice>}

          {/* ---------- Who qualifies ---------- */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-sm font-bold text-slate-900">
                  {eligible.length} ready to issue
                </span>
                {issued.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-800">
                    {issued.length} already issued
                  </span>
                )}
                {blocked.length > 0 && (
                  <span className="text-xs font-semibold text-amber-800">
                    {blocked.length} do not qualify
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {issued.length > 0 && (
                  <button
                    onClick={() => setPrinting(issued.map((r) => r.existing!))}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print all {issued.length}
                  </button>
                )}
                <button
                  onClick={() => issue(picked.size ? eligible.filter((e) => picked.has(e.user.id)) : eligible)}
                  disabled={busy || eligible.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                  Issue {picked.size || eligible.length}
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-slate-400 italic">
                  Nobody has scanned into a session for this event yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hours come from door scans, so certificates become available as the
                  event runs.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.user.id} className="px-5 py-3 flex items-center gap-3">
                    {r.qualifies && !r.existing && (
                      <input
                        type="checkbox"
                        className="accent-blue-600 shrink-0"
                        checked={picked.has(r.user.id)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(r.user.id); else next.delete(r.user.id);
                          setPicked(next);
                        }}
                      />
                    )}
                    <img src={r.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {r.user.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.sessionsAttended} session{r.sessionsAttended === 1 ? '' : 's'}
                        {' · '}{formatHours(r.hours)} h
                        {r.gaveFeedback && ' · feedback given'}
                      </div>
                      {r.reason && (
                        <div className="flex items-start gap-1.5 text-[11px] text-amber-800 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                          {r.reason}
                        </div>
                      )}
                    </div>
                    {r.existing && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] text-slate-400 hidden sm:block">
                          {r.existing.id}
                        </span>
                        {r.existing.revokedAt ? (
                          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
                            Revoked
                          </span>
                        ) : (
                          <>
                            <button onClick={() => setPrinting([r.existing!])}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => revoke(r.existing!)} title="Revoke"
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:border-amber-500 hover:text-amber-700 transition-colors cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Each certificate carries a code and a QR pointing at a public page anyone
              can check — a licensing body does not need an account. Revoking marks a
              code rather than deleting it, so a certificate already printed keeps
              answering, honestly.
            </p>
          </div>
        </>
      )}

      {printing && design && (
        <PrintableCertificate certificates={printing} design={design}
                              onClose={() => setPrinting(null)} />
      )}
    </div>
  );
};
