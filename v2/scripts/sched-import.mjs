#!/usr/bin/env node
/**
 * Reads a conference published on sched.com and writes it as CI Connects
 * seed JSON — one event with its rooms, tracks and sessions — for
 * `npm run seed -- <file>`.
 *
 *   node scripts/sched-import.mjs https://korcosiec2025.sched.com korcos-2025 \
 *     --name "KORCOS 2025" --created-by <adminUid> > seed/korcos-2025.json
 *
 * Sched has no public JSON without an organiser's API key, so this reads
 * the pages a visitor sees: /list/descriptions/ (every session with its
 * time, venue, strand, presenters, files and description),
 * /directory/speakers (each presenter's position and organisation) and
 * /all.ics (the venue). Sched's "types" — the strands of the conference —
 * become tracks; each session's kind (keynote, talk, workshop, panel,
 * break, social) is inferred from its strand and title.
 *
 * Options: --name --tagline --description --venue --address --cover
 *          --created-by --status (published|draft)
 */
import fs from 'node:fs';

const [,, base, eventId, ...rest] = process.argv;
if (!base || !eventId) { console.error('usage: sched-import.mjs <https://x.sched.com> <event-id> [--name …]'); process.exit(1); }
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const origin = base.replace(/\/+$/, '');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
async function fetchText(path) {
  const r = await fetch(origin + path, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${origin}${path}`);
  return r.text();
}

// ------------------------------------------------------------------ text
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };
const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e] ?? m;
});
const text = (html) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// ------------------------------------------------------------------ speakers
function parseSpeakers(html) {
  const out = new Map();
  for (const chunk of html.split('<div class="sched-person">').slice(1)) {
    const slug = /href=['"]speaker\/([^'"]+)['"]/.exec(chunk)?.[1];
    const name = text(/sched-event-details-name">\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(chunk)?.[1] ?? '');
    const org = text((/sched-event-details-company">([\s\S]*?)(?:<br|<\/div>)/.exec(chunk)?.[1] ?? ''));
    const title = text(/sched-event-details-position">([\s\S]*?)<\/div>/.exec(chunk)?.[1] ?? '');
    if (slug && name) out.set(slug, { name, title: title || undefined, org: org || undefined });
  }
  return out;
}

// ------------------------------------------------------------------ sessions
function kind(strand, title) {
  const s = strand.toLowerCase(), h = title.toLowerCase();
  if (s.includes('keynote') || /\bkeynote\b/.test(h)) return 'keynote';
  if (s.includes('lunch') || /\b(lunch|break|transition)\b/.test(h)) return 'break';
  if (s.includes('social') || /\b(registration|reception|closing|coffee)\b/.test(h)) return 'social';
  if (s.includes('job alike') || s.includes('job-alike') || s.includes('panel') || /\bpanel\b/.test(h)) return 'panel';
  if (s.includes('workshop') || /\bworkshop\b/.test(h)) return 'workshop';
  return 'talk';
}

function parseSessions(html, speakers) {
  const sessions = [];
  const chunks = html.split(/<span class="event (ev_\d+)">/);
  for (let i = 1; i < chunks.length; i += 2) {
    const evClass = chunks[i]; const c = chunks[i + 1];
    const head = /<a href="event\/([^/"]+)\/[^"]*" id="([0-9a-f]+)" class="name">/.exec(c);
    if (!head) continue;
    const title = text(/<span class="session-title">([\s\S]*?)<\/span>/.exec(c)?.[1] ?? '');
    const when = /list-single__date">\s*([\s\S]*?)<span class='tz'>/.exec(c)?.[1] ?? '';
    const w = /(\w+)\s+(\w+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(when.replace(/\s+/g, ' '));
    if (!w) { console.error(`skip (no time): ${title}`); continue; }
    const date = `${w[4]}-${String(MONTHS.indexOf(w[2].toLowerCase()) + 1).padStart(2, '0')}-${w[3].padStart(2, '0')}`;
    const pad = (t) => t.padStart(5, '0');
    const room = text(/list-single__location">\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(c)?.[1] ?? 'Location to be announced');
    const strand = text(/list\/descriptions\/type\/[^"']+["'][^>]*>[\s\S]*?<\/span>([\s\S]*?)<\/a>/.exec(c)?.[1] ?? 'Programme');
    let desc = '';
    const d0 = c.indexOf('tip-description">');
    if (d0 >= 0) {
      const ends = ['<div class="tip-roles"', '<div class="sched-file"', '<div class="sched-event-details-timeandplace"'].map((m) => c.indexOf(m, d0)).filter((x) => x > 0);
      desc = text(c.slice(d0 + 'tip-description">'.length, ends.length ? Math.min(...ends) : undefined).replace(/<\/div>\s*$/g, ''));
    }
    const people = [];
    const roles = c.slice(c.indexOf('<div class="tip-roles">'), c.indexOf('<div class="sched-event-details-timeandplace">'));
    for (const m of roles.matchAll(/<h2><a href="speaker\/([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>(?:<div class="sched-event-details-role-company">([\s\S]*?)<\/div>)?/g)) {
      const known = speakers.get(m[1]);
      const name = text(m[2]);
      if (known) people.push(known);
      else {
        // "Position, Organisation" as Sched prints it when the directory has no entry.
        const rc = text(m[3] ?? ''); const cut = rc.lastIndexOf(', ');
        people.push({ name, title: cut > 0 ? rc.slice(0, cut) : rc || undefined, org: cut > 0 ? rc.slice(cut + 2) : undefined });
      }
    }
    const materials = [...c.matchAll(/<a class="file-uploaded[^"]*" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ label: text(m[2]), url: m[1] }));
    sessions.push({ schedId: head[1], evClass, title, abstract: desc, strand, date, start: pad(w[5]), end: pad(w[6]), room, speakers: people, materials });
  }
  return sessions;
}

// Sched paints each strand with a colour class (.ev_N); keep the real ones.
async function strandColours(html) {
  const colours = new Map();
  const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^https?:\/\/(?!.*sched)/.test(h));
  const sources = [html];
  for (const h of sheets) { try { sources.push(await (await fetch(h.startsWith('http') ? h : origin + '/' + h.replace(/^\//, ''), { headers: { 'user-agent': UA } })).text()); } catch { /* optional */ } }
  for (const css of sources) for (const m of css.matchAll(/\.(ev_\d+)\s*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]*\))/g)) if (!colours.has(m[1])) colours.set(m[1], m[2]);
  return colours;
}
const PALETTE = ['#002B54', '#2563EB', '#0E7490', '#047857', '#B45309', '#9333EA', '#BE123C', '#4D7C0F', '#0369A1', '#A16207', '#6D28D9', '#0F766E'];

// ------------------------------------------------------------------ run
const [list, dir, ics, home] = await Promise.all([fetchText('/list/descriptions/'), fetchText('/directory/speakers'), fetchText('/all.ics').catch(() => ''), fetchText('/')]);
const speakers = parseSpeakers(dir);
const raw = parseSessions(list, speakers);
if (!raw.length) { console.error('no sessions found — is the schedule public?'); process.exit(1); }
const colours = await strandColours(list);

const pageTitle = decode(/<title>([^<]*)<\/title>/.exec(home)?.[1] ?? '').replace(/:\s*(About|Schedule)\s*$/, '').trim();
const location = (/^LOCATION:(.*)$/m.exec(ics)?.[1] ?? '').replace(/\\,/g, ',').replace(/\;/g, ';').trim();
const locCut = location.indexOf(', ');
const dates = raw.map((s) => s.date).sort();
const now = new Date().toISOString();

const strandNames = [...new Set(raw.map((s) => s.strand))].sort((a, b) => (a.toLowerCase().includes('keynote') ? -1 : b.toLowerCase().includes('keynote') ? 1 : a.localeCompare(b)));
const tracks = strandNames.map((name, i) => ({ id: `${eventId}-t-${slugify(name)}`, eventId, name, color: colours.get(raw.find((s) => s.strand === name).evClass) ?? PALETTE[i % PALETTE.length], order: i + 1 }));
// The main stage first, then the rest in order.
const rank = (n) => (/main/i.test(n) ? 0 : /theat/i.test(n) ? 1 : 2);
const roomNames = [...new Set(raw.map((s) => s.room))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }));
const rooms = roomNames.map((name, i) => ({ id: `${eventId}-r-${slugify(name)}`, eventId, name, capacity: 0, order: i + 1 }));
const trackId = Object.fromEntries(tracks.map((t) => [t.name, t.id]));
const roomId = Object.fromEntries(rooms.map((r) => [r.name, r.id]));

const sessions = raw.map((s) => ({
  id: `${eventId}-${s.schedId}`, eventId, title: s.title, abstract: s.abstract, type: kind(s.strand, s.title),
  date: s.date, start: s.start, end: s.end, roomId: roomId[s.room], trackId: trackId[s.strand],
  speakers: s.speakers, capacity: 0, reservedUserIds: [], waitlistUserIds: [],
  ...(s.materials.length ? { materials: s.materials } : {}),
  ...(kind(s.strand, s.title) === 'keynote' ? { featured: true } : {}),
}));

const event = {
  id: eventId, slug: opt.slug ?? eventId, name: opt.name ?? pageTitle, tagline: opt.tagline ?? pageTitle,
  description: opt.description ?? `${pageTitle}: ${sessions.length} sessions in ${rooms.length} rooms across ${tracks.length} strands, as published on ${origin.replace(/^https?:\/\//, '')}.`,
  startDate: dates[0], endDate: dates[dates.length - 1],
  venueName: opt.venue ?? (locCut > 0 ? location.slice(0, locCut) : location || 'Venue'),
  ...(opt.address ?? (locCut > 0 ? location.slice(locCut + 2) : '') ? { venueAddress: opt.address ?? location.slice(locCut + 2) } : {}),
  coverUrl: opt.cover ?? 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80&auto=format&fit=crop',
  status: opt.status ?? 'published', registrationOpen: false, createdBy: opt['created-by'] ?? 'import', createdAt: now,
};

process.stdout.write(JSON.stringify({ events: [event], rooms, tracks, sessions }, null, 2) + '\n');
console.error(`${event.name}: ${sessions.length} sessions, ${rooms.length} rooms, ${tracks.length} tracks, ${speakers.size} presenters in the directory; ${dates[0]}${dates[0] === dates[dates.length - 1] ? '' : ' – ' + dates[dates.length - 1]}`);
