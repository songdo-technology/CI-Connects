import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import { Certificate, CertificateDesign } from '../types';
import { formatHours, verificationUrl } from '../lib/certificates';

interface PrintableCertificateProps {
  certificates: Certificate[];
  design: CertificateDesign;
  onClose: () => void;
}

/**
 * The certificate itself, laid out for A4 landscape.
 *
 * Printed through the browser rather than generated with a PDF library: "Save
 * as PDF" is in every print dialogue, it produces real selectable text rather
 * than an image, and it keeps the document's appearance in CSS where it can be
 * changed without a build.
 *
 * The QR and the code carry the same verification address. A registrar with
 * the paper in front of them can scan it, and a registrar with a photocopy can
 * type it — both have happened to every school that has ever issued these.
 */
export const PrintableCertificate: React.FC<PrintableCertificateProps> = ({
  certificates, design, onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:bg-white print:backdrop-blur-none print:static print:overflow-visible">
      <style>{PRINT_CSS}</style>

      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="font-bold text-slate-900">
            {certificates.length === 1
              ? certificates[0].fullName
              : `${certificates.length} certificates`}
          </h3>
          <p className="text-[11px] text-slate-500">
            A4 landscape. Use “Save as PDF” in the print dialogue, and turn on background
            graphics or the border will not print.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer">
            <Printer className="w-4 h-4" />
            Print or save as PDF
          </button>
          <button onClick={onClose}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 print:p-0 space-y-6 print:space-y-0">
        {certificates.map((c) => (
          <div key={c.id} className="cert-sheet">
            <div className="cert-frame">
              <div className="cert-head">
                <div className="cert-issuer">{design.issuerName}</div>
                <h1 className="cert-title">{design.title}</h1>
              </div>

              <div className="cert-body">
                <div className="cert-lead">This is to certify that</div>
                <div className="cert-name">{c.fullName}</div>
                {c.organization && <div className="cert-org">{c.organization}</div>}

                <div className="cert-statement">
                  {design.bodyText || `for participation in ${c.eventName}`}
                </div>
                <div className="cert-dates">{c.eventDates}</div>

                <div className="cert-hours">
                  <span className="cert-hours-value">{formatHours(c.hours)}</span>
                  <span className="cert-hours-label">
                    professional learning hour{c.hours === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="cert-sessions">
                  Across {c.sessionsAttended} session{c.sessionsAttended === 1 ? '' : 's'} attended
                </div>
                {design.accreditationNote && (
                  <div className="cert-accred">{design.accreditationNote}</div>
                )}
              </div>

              <div className="cert-foot">
                <div className="cert-sign">
                  <div className="cert-sign-line" />
                  <div className="cert-sign-name">{design.signatoryName || ' '}</div>
                  <div className="cert-sign-title">{design.signatoryTitle}</div>
                </div>

                {/* Both forms of the same address: scannable, and readable when
                    this arrives as a photocopy in a registrar's inbox. */}
                <div className="cert-verify">
                  <QRCodeSVG value={verificationUrl(c.id)} size={78} level="M"
                             bgColor="#ffffff" fgColor="#002b54" />
                  <div className="cert-verify-text">
                    <div className="cert-verify-label">Verify this certificate</div>
                    <div className="cert-verify-code">{c.id}</div>
                    <div className="cert-verify-url">
                      {verificationUrl(c.id).replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                </div>

                <div className="cert-issued">
                  <div className="cert-sign-line" />
                  <div className="cert-sign-name">
                    {new Date(c.issuedAt).toLocaleDateString('en-GB',
                      { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="cert-sign-title">Date of issue</div>
                </div>
              </div>

              {c.revokedAt && (
                <div className="cert-revoked">
                  <ShieldCheck className="w-4 h-4" /> This certificate has been revoked
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }

.cert-sheet {
  width: 11.69in; height: 8.27in;
  margin: 0 auto; background: #fff;
  padding: 0.5in;
  box-sizing: border-box;
  font-family: "Gill Sans Std", "Gill Sans MT", "Gill Sans", Helvetica, Arial, sans-serif;
  color: #0f172a;
  break-inside: avoid; page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

.cert-frame {
  height: 100%; box-sizing: border-box;
  border: 2px solid #002b54;
  /* A second, inset rule. One line reads as a table border; two read as a
     document somebody meant to print. */
  outline: 1px solid #002b54; outline-offset: 5px;
  padding: 0.42in 0.6in;
  display: flex; flex-direction: column; text-align: center;
}

.cert-head { border-bottom: 1px solid #e2e8f0; padding-bottom: 0.16in; }
.cert-issuer {
  font-size: 10pt; font-weight: 700; letter-spacing: 0.22em;
  text-transform: uppercase; color: #2a6791;
}
.cert-title {
  font-size: 21pt; font-weight: 700; color: #002b54;
  margin: 0.07in 0 0; letter-spacing: -0.01em;
}

.cert-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.cert-lead { font-size: 10.5pt; color: #64748b; }
.cert-name {
  font-size: 34pt; font-weight: 700; color: #002b54;
  line-height: 1.1; margin: 0.06in 0 0.02in; letter-spacing: -0.015em;
}
.cert-org { font-size: 11pt; color: #475569; }
.cert-statement {
  font-size: 12pt; color: #334155; line-height: 1.45;
  margin: 0.16in auto 0.03in; max-width: 7.4in;
}
.cert-dates { font-size: 10.5pt; color: #64748b; }

.cert-hours {
  margin-top: 0.2in; display: flex; align-items: baseline;
  justify-content: center; gap: 0.09in;
}
.cert-hours-value { font-size: 27pt; font-weight: 700; color: #b04318; line-height: 1; }
.cert-hours-label {
  font-size: 10.5pt; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.11em; color: #334155;
}
.cert-sessions { font-size: 9pt; color: #94a3b8; margin-top: 0.04in; }
.cert-accred {
  font-size: 8.5pt; color: #64748b; margin-top: 0.1in;
  max-width: 6.6in; margin-left: auto; margin-right: auto; line-height: 1.4;
}

.cert-foot {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 0.4in; padding-top: 0.2in;
}
.cert-sign, .cert-issued { width: 2.5in; }
.cert-sign-line { border-top: 1px solid #94a3b8; margin-bottom: 0.06in; }
.cert-sign-name { font-size: 10.5pt; font-weight: 600; color: #0f172a; }
.cert-sign-title { font-size: 8.5pt; color: #64748b; }

.cert-verify { display: flex; align-items: center; gap: 0.11in; text-align: left; }
.cert-verify-label {
  font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: #94a3b8;
}
.cert-verify-code {
  font-size: 11pt; font-weight: 700; color: #002b54;
  font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.02em;
}
.cert-verify-url { font-size: 7.5pt; color: #64748b; }

.cert-revoked {
  margin-top: 0.12in; display: flex; align-items: center; justify-content: center;
  gap: 0.07in; font-size: 10pt; font-weight: 700; color: #b04318;
}

@media screen {
  .cert-sheet {
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.18);
    border-radius: 6px;
    /* A4 landscape is wider than most screens; scale to fit rather than
       forcing a horizontal scroll to read the middle of the page. */
    transform: scale(min(1, calc((100vw - 3rem) / 11.69in)));
    transform-origin: top center;
  }
}
`;
