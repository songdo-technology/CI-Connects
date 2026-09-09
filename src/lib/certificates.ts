import {
  Certificate, CertificateDesign, EventConfig, Session, UserProfile,
  AttendanceRecord, FeedbackEntry,
} from '../types';

/**
 * Certificates of professional learning.
 *
 * These leave the platform. A teacher submits one to a licensing body, which
 * may check it years later against a school that has since changed its
 * systems. That sets the standards here: hours are derived from what was
 * actually scanned rather than from what was booked, the code is verifiable by
 * anyone holding it without exposing anybody else's, and an issued certificate
 * records what was true when it was issued rather than what is true now.
 */

/** Unambiguous in print and over a phone: no O/0, I/1, S/5, B/8, U/V. */
const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTWXY34679';

/**
 * A verification code, used as the document id.
 *
 * Three groups of four from a 24-character alphabet is about 55 bits — far
 * beyond guessing, and short enough to read aloud or retype off a printed
 * page, which somebody in a registrar's office will have to do.
 */
export function generateCertificateCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `CI-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

/** Accepts what people actually type: spaces, lowercase, a missing prefix. */
export function normaliseCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = cleaned.startsWith('CI') ? cleaned.slice(2) : cleaned;
  if (body.length !== 12) return '';
  return `CI-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

/** Minutes a session ran for. */
const lengthOf = (s: Session) => Math.max(0, s.endMinutes - s.startMinutes);

export interface Eligibility {
  user: UserProfile;
  sessionsAttended: number;
  minutesAttended: number;
  hours: number;
  qualifies: boolean;
  /** Why not, when they do not. */
  reason?: string;
  gaveFeedback: boolean;
  /** Already holds one for this event. */
  existing?: Certificate;
}

/**
 * Who has earned a certificate, and for how many hours.
 *
 * Counted from attendance scans, never from reservations. Somebody who booked
 * six sessions and came to one has attended one, and a certificate saying
 * otherwise is a false statement to a licensing body made in the school's
 * name.
 */
export function assessEligibility(input: {
  event: EventConfig;
  design: CertificateDesign;
  sessions: Session[];
  attendance: AttendanceRecord[];
  users: UserProfile[];
  feedback: FeedbackEntry[];
  certificates: Certificate[];
}): Eligibility[] {
  const { event, design, sessions, attendance, users, feedback, certificates } = input;

  const eventSessions = sessions.filter((s) => s.eventId === event.id);
  const byId = new Map(eventSessions.map((s) => [s.id, s]));
  const relevant = attendance.filter((a) => byId.has(a.sessionId));

  // Whoever the event touched at all: scanned into something, or admitted at
  // the door. Listing every account on the platform would bury them.
  const candidateIds = new Set<string>([
    ...relevant.map((a) => a.userId),
    ...users.filter((u) => u.checkedIn).map((u) => u.id),
    ...certificates.filter((c) => c.eventId === event.id).map((c) => c.userId),
  ]);

  return [...candidateIds]
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserProfile => Boolean(u))
    .map((user) => {
      // One scan per session, however many times somebody walked through.
      const attendedIds = new Set(
        relevant.filter((a) => a.userId === user.id).map((a) => a.sessionId));
      const attended = [...attendedIds].map((sid) => byId.get(sid)!).filter(Boolean);
      const minutes = attended.reduce((n, s) => n + lengthOf(s), 0);

      // Any feedback counts — on a session they attended, or on the event
      // overall. Someone who rated the food and the keynote has been heard.
      const gaveFeedback = feedback.some((f) => f.userId === user.id
        && (byId.has(f.targetId) || f.targetKind !== 'session'));

      // Rounded to a quarter hour, which is how professional learning is
      // normally recorded, and capped at the event's own figure so a
      // scheduling overlap can never award more than the day contained.
      const earned = design.hoursPolicy === 'fixed'
        ? design.hours
        : Math.min(design.hours, Math.round((minutes / 60) * 4) / 4);

      let reason: string | undefined;
      if (attended.length < design.minSessions) {
        reason = `Attended ${attended.length} of the ${design.minSessions} sessions required.`;
      } else if (earned <= 0) {
        reason = 'No recorded hours.';
      } else if (design.requireFeedback && !gaveFeedback) {
        reason = 'Feedback not yet given, and this event requires it.';
      }

      return {
        user,
        sessionsAttended: attended.length,
        minutesAttended: minutes,
        hours: earned,
        qualifies: !reason,
        reason,
        gaveFeedback,
        existing: certificates.find((c) => c.eventId === event.id && c.userId === user.id),
      };
    })
    .sort((a, b) => b.hours - a.hours || a.user.fullName.localeCompare(b.user.fullName));
}

/** Builds the record to store. Snapshots everything the document will assert. */
export function buildCertificate(
  event: EventConfig, e: Eligibility, issuedBy: string,
): Certificate {
  return {
    id: generateCertificateCode(),
    eventId: event.id,
    userId: e.user.id,
    fullName: e.user.fullName,
    organization: e.user.organization,
    eventName: event.name,
    eventDates: event.dateLabel,
    hours: e.hours,
    sessionsAttended: e.sessionsAttended,
    issuedAt: new Date().toISOString(),
    issuedBy,
  };
}

/** Hours as they should read on the document: "6" and "6.5", never "6.50". */
export const formatHours = (hours: number): string =>
  (Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, ''));

/** The address a licensing body can check. */
export const verificationUrl = (code: string): string =>
  `${typeof window === 'undefined' ? '' : window.location.origin}/?verify=${encodeURIComponent(code)}`;

/** Sensible starting point for an organiser turning this on. */
export const defaultCertificateDesign = (event: EventConfig): CertificateDesign => ({
  enabled: true,
  title: 'Certificate of Professional Learning',
  hoursPolicy: 'attended',
  hours: 12,
  minSessions: 1,
  issuerName: 'Chadwick International',
  signatoryName: '',
  signatoryTitle: 'Head of School',
  accreditationNote: '',
  bodyText: `for participation in ${event.name}`,
  requireFeedback: false,
});
