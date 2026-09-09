import React from 'react';
import {
  Linkedin, Twitter, Facebook, Instagram, Youtube, Github, Globe, Link2,
} from 'lucide-react';

/**
 * Recognises the platform behind a profile link.
 *
 * People paste whatever their browser gave them — with or without a scheme,
 * with or without `www`, and X links arrive under both x.com and twitter.com.
 * Matching on the host rather than the whole string means all of those land on
 * the same icon instead of falling through to a generic one.
 */
export interface SocialPlatform {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Brand-adjacent, but drawn from the Chadwick ramps so the directory does
   *  not turn into a strip of competing corporate colours. */
  className: string;
}

const PLATFORMS: { hosts: string[]; platform: SocialPlatform }[] = [
  { hosts: ['linkedin.com'],
    platform: { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, className: 'text-blue-700' } },
  { hosts: ['x.com', 'twitter.com'],
    platform: { id: 'x', label: 'X', icon: Twitter, className: 'text-slate-800' } },
  { hosts: ['facebook.com', 'fb.com'],
    platform: { id: 'facebook', label: 'Facebook', icon: Facebook, className: 'text-blue-600' } },
  { hosts: ['instagram.com'],
    platform: { id: 'instagram', label: 'Instagram', icon: Instagram, className: 'text-amber-700' } },
  { hosts: ['youtube.com', 'youtu.be'],
    platform: { id: 'youtube', label: 'YouTube', icon: Youtube, className: 'text-amber-700' } },
  { hosts: ['github.com'],
    platform: { id: 'github', label: 'GitHub', icon: Github, className: 'text-slate-800' } },
];

const FALLBACK: SocialPlatform = {
  id: 'link', label: 'Website', icon: Globe, className: 'text-slate-500',
};

/** Ensures a pasted link is navigable. A bare "linkedin.com/in/me" would
 *  otherwise resolve against our own origin and 404. */
export function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function detectPlatform(raw: string): SocialPlatform {
  try {
    const host = new URL(normaliseUrl(raw)).hostname.replace(/^www\./, '').toLowerCase();
    const hit = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
    return hit?.platform ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** The icon row shown under someone's name in the directory and contact card. */
export const SocialLinkRow: React.FC<{
  linkedInUrl?: string;
  links?: { label: string; url: string }[];
  size?: 'sm' | 'md';
}> = ({ linkedInUrl, links = [], size = 'sm' }) => {
  const all = [
    ...(linkedInUrl ? [{ label: 'LinkedIn', url: linkedInUrl }] : []),
    ...links.filter((l) => l.url?.trim()),
  ];
  if (all.length === 0) return null;

  const box = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const glyph = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {all.map((l, i) => {
        const platform = detectPlatform(l.url);
        const Icon = platform.icon;
        const href = normaliseUrl(l.url);
        return (
          <a
            key={`${href}-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // The label is the author's own where they gave one, so a link
            // called "My research" stays called that on hover.
            title={l.label?.trim() || platform.label}
            aria-label={l.label?.trim() || platform.label}
            className={`${box} rounded-lg border border-slate-200 flex items-center justify-center hover:border-blue-600 hover:bg-blue-50 transition-colors`}
          >
            <Icon className={`${glyph} ${platform.className}`} />
          </a>
        );
      })}
    </div>
  );
};

export { Link2 };
