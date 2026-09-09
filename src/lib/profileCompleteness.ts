import { UserProfile } from '../types';

export interface ProfileGap {
  key: string;
  label: string;
  why: string;
}

/**
 * What is still missing from someone's profile.
 *
 * The same list the invitation email asks for, in the same order, so a guest
 * who read the email and a guest who only opened the app are told the same
 * thing. Keeping it in one place is the point: two lists would drift, and the
 * organiser would end up chasing people for a field the app never mentioned.
 *
 * Only fields that other people see are counted. Nagging someone about a
 * setting nobody else will ever encounter is how a checklist gets ignored.
 */
export function profileGaps(user: UserProfile): ProfileGap[] {
  const gaps: ProfileGap[] = [];

  if (!user.preferredName?.trim()) {
    gaps.push({
      key: 'preferredName',
      label: 'Preferred name',
      why: 'Printed large on your badge — what you actually go by.',
    });
  }
  // A generated initials avatar is a data: URI. A real photo is a URL.
  if (!user.avatarUrl || user.avatarUrl.startsWith('data:')) {
    gaps.push({
      key: 'avatarUrl',
      label: 'Professional photo',
      why: 'Appears on your badge and in the colleague directory.',
    });
  }
  if (!user.organization?.trim()) {
    gaps.push({
      key: 'organization',
      label: 'School or organisation',
      why: 'Printed on your badge under your name.',
    });
  }
  if (!user.title?.trim()) {
    gaps.push({
      key: 'title',
      label: 'Role or job title',
      why: 'How colleagues know what you do before they say hello.',
    });
  }
  if (!user.linkedInUrl?.trim() && !(user.socialLinks ?? []).some((l) => l.url.trim())) {
    gaps.push({
      key: 'links',
      label: 'LinkedIn or another link',
      why: 'Clickable in the directory — how most people follow up afterwards.',
    });
  }

  return gaps;
}

/** 0–100. Used for the ring in the portal header. */
export function profileCompleteness(user: UserProfile): number {
  const total = 5;
  return Math.round(((total - profileGaps(user).length) / total) * 100);
}
