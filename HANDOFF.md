# CI Connects — handoff

Written 10 September 2026, moving from one Mac to another. Everything needed to
resume is in this repository except the two files named under "Secrets", which
are gitignored and must be recreated by hand.

## Machines

- **Current home (since 10 Sep 2026):** Junyoung's MacBook Pro,
  `/Users/junyoung/OPENCLAW/CI-Connects`. Clone verified: `.env.local`
  recreated, typecheck clean, local build hash identical to the live bundle.
- **The first Mac is frozen.** Nothing should be edited there. If it is ever
  used again, `git pull` first.
- The repository is **public** on GitHub. That is fine while it holds no
  secrets — keep it that way, or flip it to private in repo settings.

---

## What this is

The Chadwick International event management platform. A public catalogue of
every event the school runs, plus the machinery to run them: registration,
badges, door scanning, session proposals and scheduling, feedback, certificates
of professional learning, and reporting.

- **Live:** <https://ci-events.pages.dev>
- **Repo:** <https://github.com/songdo-technology/CI-Connects> (branch `main`)
- **Stack:** React 19 · TypeScript · Vite 6 · Tailwind 4 · Firebase (Auth,
  Firestore, Storage) · Cloudflare Pages + Pages Functions

---

## Cloud wiring

Both accounts are **songdo-technology@chadwickschool.org**. The personal
account is not used anywhere.

| Part | Service | Project | Deploys how |
|------|---------|---------|-------------|
| Web app + Functions | Cloudflare Pages | `ci-events` (account `db320cde773461ed8f257d3ec0eda290`) | **GitHub Actions on push to `main`** (`deploy.yml`, needs `CLOUDFLARE_API_TOKEN` secret). Manual `wrangler pages deploy` is the fallback |
| Auth, database, file storage | Firebase | `ci-connects` (number `898826571976`) | Rules only. GitHub Actions when rules files change (`rules.yml`, needs `FIREBASE_SERVICE_ACCOUNT` secret); else manual |

### Automatic deploys

Cloudflare itself is still not watching this repository (`wrangler pages
project list` reports **Git Provider: No**, and a direct-upload project cannot
be switched). Instead `.github/workflows/deploy.yml` runs on every push to
`main`: `npm ci` → typecheck → build with the `VITE_*` repository variables →
`wrangler pages deploy … --branch=main`.

It deploys only when the repository secret `CLOUDFLARE_API_TOKEN` exists.
Until then every run builds, then ends with a **"not deployed"** warning,
meaning GitHub did not deploy that push. `npm run ship` from a machine with a
wrangler login pushes and deploys in one step with no token, so the token is
**optional** — it matters only for deploying from a machine without wrangler,
or from GitHub itself. To enable it once, from a terminal on any machine:

1. Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom →
   one permission, **Account · Cloudflare Pages · Edit**, scoped to the
   `Songdo-technology@chadwickschool.org` account. A token's value is shown
   once at creation; the existing `ci-connects build token` cannot be read
   back — roll it or make a new, narrower one.
2. `gh secret set CLOUDFLARE_API_TOKEN -R songdo-technology/CI-Connects`,
   paste the token.
3. Push, or `gh workflow run deploy.yml`, and watch it go green.

Manual deploy remains the fallback and is what to reach for if Actions is down:

```sh
npm run build
npx wrangler pages deploy dist --project-name=ci-events --branch=main
```

`--branch=main` is what makes it production. Any other branch name creates a
preview at its own subdomain, which is useful for testing and is **not**
covered by the OAuth configuration, so sign-in does not work there.

Firebase rules deploy separately and only when changed:

```sh
npx firebase deploy --only firestore:rules --project ci-connects
npx firebase deploy --only storage --project ci-connects
```

### Is local ahead of live?

No. As of this handoff the deployed bundle hash matches the local build, and
the working tree is clean with nothing unpushed.

---

## From a fresh clone — any machine, nothing pre-installed

```sh
gh auth login                  # once; songdo-technology@chadwickschool.org
gh repo clone songdo-technology/CI-Connects
cd CI-Connects
sh scripts/bootstrap.sh        # npm install, writes .env.local, typecheck, build
npm run dev                    # http://localhost:3000
```

`scripts/bootstrap.sh` (also `npm run bootstrap`) needs only Node 20+ and a
logged-in `gh`. It writes `.env.local` from the GitHub repository variables —
the same public Firebase config the Actions build uses — so nothing is copied
by hand out of a console. Delete `.env.local` and re-run to regenerate it.
Verified on 10 Sep 2026 from an empty directory: the build it produces is
byte-identical to the live bundle.

Node 24 and 25 with npm 11 have both been used; `.node-version` says 22.

### CLI logins needed

```sh
gh auth login                  # push and pull; bootstrap reads the variables
npx wrangler login             # to deploy from this machine (npm run ship);
                               # unnecessary once the Actions token is set
npx firebase login             # only for rules deploys, or to pull the config
                               # straight from Firebase instead of GitHub:
                               # firebase apps:sdkconfig WEB 1:898826571976:web:2c297c696a62519ce695fd --project ci-connects
```

All three are the school account. A personal Google account will authenticate
but will not see the `ci-events` or `ci-connects` projects.

### Tests

There is no test runner. Verification is done by compiling a module with
esbuild and exercising it in Node — six suites were written this way for the
logic where correctness is not obvious by reading:

| Module | Covers |
|--------|--------|
| `src/lib/csvImport.ts` | quoted fields, BOM, CRLF, four clock formats, two date orders |
| `src/lib/scheduler.ts` | room and speaker clashes, room fit, strand spread, capacity limits |
| `src/lib/certificates.ts` | hours from attendance not bookings, quarter-hour rounding, code format |
| `src/lib/calendarLinks.ts` | KST to UTC, iCalendar escaping, CRLF |
| `src/lib/analytics.ts` | sample/future exclusion, attendances vs people, empty vs zero |
| `src/lib/videoEmbed.ts` | YouTube, Drive and Vimeo URL shapes |

To re-run one:

```sh
npx esbuild src/lib/scheduler.ts --bundle --format=esm --outfile=/tmp/s.mjs
# then drive it from a small node script
```

The scripts themselves were scratch files and are not in the repo. Rewriting
one takes a few minutes; the behaviours they assert are documented in the
commit messages.

---

## Secrets

**Nothing secret is in this repository, and nothing secret should be added to
it.** Two things must be recreated on the new machine.

### 1. `.env.local` — needed to build

`sh scripts/bootstrap.sh` writes it from the GitHub repository variables. By
hand: copy `.env.example` and fill from Firebase console → Project settings →
Your apps → Web app → SDK config, or `firebase apps:sdkconfig` as above. These
values are safe in client code; Firebase identifies the project with them and
does not authenticate with them. Access is controlled by `firestore.rules`.

One value is **not** the Firebase default and matters:

```
VITE_FIREBASE_AUTH_DOMAIN=ci-events.pages.dev
```

Not `ci-connects.firebaseapp.com`. See "The auth domain" below.

The old value is kept in `.env.local.rollback` on the old machine; it is simply
`ci-connects.firebaseapp.com` if you need to roll back.

### 2. Cloudflare Pages Function secrets — already set, nothing to do

Set in the dashboard, not in this repo, and they stay there across machines:
Workers & Pages → `ci-events` → Settings → Variables and secrets.

| Name | Purpose | Status |
|------|---------|--------|
| `FIREBASE_API_KEY` | Lets `/api/*` verify the caller is a signed-in Chadwick account | **Set** 10 Sep 2026 |
| `GEMINI_API_KEY` | Agenda structuring and cover-image generation | **Set** 10 Sep 2026 |
| `ANTHROPIC_API_KEY` | Alternative to Gemini for text only | Optional |

Both were set on 10 September and the site redeployed. An anonymous call to
`/api/structure` now gets a 401 (the signed-in check) rather than the 501
setup error, so the wiring is right; the end-to-end test needs a signed-in
Chadwick account — see the next steps. Full steps in `docs/ai-assist-setup.md`.

---

## What works

Verified on production, signed out and signed in, at the time of writing.

- **Public site.** Hub, event pages, agendas, speakers, sponsors, past-event
  recaps with slides and recordings — all reachable with no account.
- **Three access tiers.** Anonymous browses the catalogue and an event's
  public page; an account gets a profile, learning history, certificates and
  materials; **a place at an event — and with it the programme, the badge,
  the people — is given by an organiser.** `users.eventAccess` lists the
  events a person may see inside of. It is filled by Admin → Access (a tick
  per person per event), by an invitation made under Guests when that address
  signs in, or by a redeemed access code. Organisers and administrators see
  every event. Signed-out visitors and unlisted accounts see the public page
  with the programme replaced by a notice saying who can see it.
- **The threshold.** Entering an event opens a full-screen welcome — which
  event, when, where, how many sessions and rooms, and whether you are on the
  list. Once per person per event per browser session; always, when they are
  not on the list, with the code box and "ask for a place" in the agenda's
  stead.
- **Sign-in.** Chadwick Google, personal Google, email + password, or an
  emailed link. Role decides where you land: front desk to the gate scanner,
  organisers to the admin dashboard, everyone else to their own record.
- **Navigation.** Every surface has an address (`/dashboard`, `/admin`, `/me`,
  `/gate`, `/event/<slug>/<tab>`, and `/?event=<slug>` for a public page), each
  move is a history entry, and the browser's Back button moves inside the
  platform. A signed-out visitor on a signed-in address is sent to sign in
  once Firebase has settled; a signed-in person on a surface their role lacks
  is sent home instead of falling through to the portal. Inside an event the
  panes sit in a rail beside the content, grouped — This event · People · You ·
  Organiser — with the organiser's controls (Event operations, Lucky draw)
  visible only to organisers.
- **Admin.** Events, programme, proposals, import, rooms, dining, sponsors,
  guests, attendance, analytics, certificates, lucky draw, spend, people and
  roles, system.
- **Bulk import.** CSV or pasted rows for programme, rooms, sponsors, dining
  and guests, with column matching, validation, duplicate detection and a
  preview before anything is written.
- **Speaker proposals.** Submit, approve, and auto-schedule against room,
  speaker, capacity and strand-balance constraints. Proposes; never applies.
- **Gate scanner.** Reads a badge, or displays a rotating code people scan with
  their own phones. Kiosk mode for an unattended iPad. Optional scan-out.
- **Certificates.** Designed per event, hours counted from door scans,
  verifiable by anyone at `/?verify=CODE` with no account.
- **Badges.** Printable lanyards in six sizes, name auto-fitted, both faces
  scaled so nothing is ever clipped.

## What is not done

- **No email is sent by the platform.** Invitations are copy-and-paste text; a
  Preview button in Admin → Guests shows what to send. The full brief for
  registration and post-event emails is in the conversation history and was the
  agreed next task. It needs an email provider key (Resend or SendGrid).
- **Analytics show "Nothing to report yet"** — correct, because the only
  attendance records in the database are on a future event and sample events
  are excluded by design.
- **No mobile apps.** Capacitor was planned; nothing is built. Needs Apple
  Developer and Google Play accounts.
- **Sample data is still in Firestore.** Eleven illustrative events. Admin →
  System → Clear sample content removes what you choose, with a typed
  confirmation. Keep rooms and sponsors — they are real.

---

## Gotchas, so the new machine does not repeat them

**The auth domain.** Firebase serves its OAuth handler at
`<project>.firebaseapp.com/__/auth/`. When the app is on a different site,
finishing a redirect sign-in means passing a credential across a site boundary,
and Chrome 115+, Safari ITP and Firefox ETP all partition the storage that
depends on. `getRedirectResult()` returns `null` **with no error** and the
visitor lands back on the sign-in page. Fixed by proxying the handler through
this origin (`functions/__/auth/[[path]].js`) and setting `authDomain` to
`ci-events.pages.dev`. Both redirect URIs are registered on the OAuth client;
`./check-oauth-uri.sh <uri>` asks Google whether one is registered, without
signing in. Do not remove the `firebaseapp.com` entries — they are the rollback.

**MemoryStore hides every permission bug.** The in-memory store models no
security rules and no listener lifecycle. A feature that works in the demo
build proves nothing about Firestore. Every auth and permission bug in this
project was invisible until it ran against the real backend. Check
`firestore.rules` before assuming a write will succeed.

**Sign-in state is not settled immediately.** `onAuthStateChanged` can report
signed-out before a persisted session is restored. Treating that first answer
as final caused the sign-in form to paint over a session that was about to
arrive — the bug where reloading appeared to fix everything. `AuthProvider`
exposes `settled`; do not act on a signed-out status before it is true.

**Preview deployments cannot sign in.** Each gets its own subdomain, which is
not on the OAuth authorized list. Use them for UI checks only. There are about
thirteen on a `verify-nav` branch from this session's testing — demo builds
with no credentials, separate from production, safe to delete.

**Browsers cache the old bundle.** A change that appears not to have deployed
usually has. Hard-reload before concluding it failed. `_headers` sets HTML to
revalidate and hashed assets to immutable, so a deploy takes effect at once.

**The Chadwick secondary palette fails colour-vision separation.** Measured
with the dataviz validator: adjacent pairs sit at ΔE 3.4 for protanopia. Do not
use them as categorical chart colours. Analytics uses a single-hue sequential
ramp with a number on every bar for this reason.

**Scripted edits can clobber the wrong file.** One python edit in this session
wrote a component's contents into `App.tsx`. Caught by the next typecheck and
restored from HEAD. Commit often; run `npx tsc --noEmit` after scripted edits.

---

## The next three things

1. **Test signing in on production, as a person.** The auth domain moved onto
   our own origin and the landing rule changed today; neither has been
   exercised by a human since. Sign in at <https://ci-events.pages.dev>: it
   should land on the dashboard first time. While signed in, try Admin →
   Import → *Turn this into rows* and an event cover's *Generate one* — that
   is the only way to prove the Gemini key end to end. If anything fails,
   capture the exact on-screen message; the errors name the setting to change.
2. **Build email.** The agreed next feature and the one that makes everything
   already built actually reach people: a registration email with the QR badge,
   calendar link and links to the event and the main site; external guests also
   getting their access code, directions, Main Gate 2 registration and parking;
   then a post-event email leading to glows and grows and the certificate.
   Needs a provider key held in Cloudflare, same pattern as the AI endpoints.
3. **Replace the samples with the first real event.** Admin → System → Clear
   sample content (keep rooms and sponsors), then Admin → Events → New event.
   Until then every dashboard number is counting a template, and the public
   hub is a brochure for events that never happened.

---

## How the app is put together

One page, no router library. `src/App.tsx` holds a `surface` — `hub`,
`event`, `signin`, `portal`, `dashboard`, `gate`, `learning` — plus an
`isAdminPanelOpen` overlay and, inside the portal, an `activeTab`. Since
10 September those are mirrored to the address bar as history entries:

| Address | Surface | Who |
|---------|---------|-----|
| `/` | Events hub — the public catalogue | anyone |
| `/?event=<slug>` | One event's public page | anyone |
| `/signin` | Sign-in | anyone |
| `/dashboard` | Organiser's home (`AdminDashboard`) | `events:create` |
| `/admin` | Administration panel, an overlay on the dashboard | `events:create` |
| `/me` | A person's own record (`MyLearning` + `MyProfile`) | any account |
| `/gate` | Gate station | `attendance:scan` |
| `/event/<slug>` | The attendee portal for that event, `/<tab>` for its tabs | any account |

Signing in lands on **the person's own dashboard, always** — `/dashboard` for
organisers and administrators, `/me` for everyone else, `/gate` for the front
desk. An event is a click from there; it is never where sign-in puts you.

Inside an event, `canSeeEvent(user, eventId)` (`lib/permissions.ts`) decides
whether the portal and the public programme open: organisers always, others
only when `users.eventAccess` names the event. The check is the product's,
not the rules': `sessions` stay world-readable because the unattended room
signage reads them with no account. `firestore.rules` lets organisers write
`eventAccess`/`hasEventAccess` on any profile and nothing else.

Administration (`/admin`) is a rail of grouped sections — Plan · Venue &
partners · People · On the day · Insight · Platform — not one row of sixteen
tabs. The "setting up your first real event" checklist is gone; the first
real event exists (KORCOS 2026, created 10 Sep 2026 with two placeholder
sessions and jyyang@chadwickschool.org on its list), and the rail already
says where each job lives.

Data arrives through `DataProvider` from one of two stores chosen in
`main.tsx`: `FirestoreStore` (production, `VITE_USE_FIRESTORE=true`) or the
seeded `memoryStore` (`npm run dev:demo`, port 3002), which also swaps the
identity provider for a list of sample personas. The demo build is for
looking at screens; it models no security rules, so it proves nothing about
permissions.

The project began as a Google AI Studio prototype (`metadata.json`,
`public/assets/aistudio/`), and the second-Mac pass on 10 September removed
what was left of that: the phone-frame "Mobile App" toggle, the "System
Specs" architecture modal, the "switch identity (demo simulation)" menu, the
legacy CSV importer inside the portal's organiser tab (Admin → Import
supersedes it), the fallback that rendered the *first profile in the
directory* as the signed-in person while their own was still loading, and
the hub door that opened the admin panel on top of the sample conference —
which is why closing Admin used to drop you into Chadwick Connects.

## Documents in this repo

| File | What it covers |
|------|----------------|
| `docs/auth-domain-runbook.md` | The OAuth handler move, with the exact Google Cloud Console steps and how to roll back |
| `docs/ai-assist-setup.md` | Turning on the AI features, and what each key is for |
| `check-oauth-uri.sh` | Asks Google whether a redirect URI is registered, without signing in |
| `firestore.rules` | The real security boundary. Read this before trusting any client-side check |
| `storage.rules` | Upload limits and who may write where |
