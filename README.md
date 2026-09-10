# CI Connects

**The Chadwick International Event Management Platform** —
multi-track scheduling, community networking, QR badge check-in, and an organizer console.

## Stack

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Cloudflare Pages** for hosting
- **Firebase** for data and auth *(planned — not yet wired in)*

## Getting started

```bash
gh auth login              # once, as songdo-technology@chadwickschool.org
sh scripts/bootstrap.sh    # npm install, .env.local from the repo variables, typecheck, build
npm run dev                # http://localhost:3000
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm run bootstrap` | Fresh clone → working checkout (writes `.env.local`) |
| `npm run ship` | Typecheck, build, push `main`, deploy to production |

## Current status: prototype

All application state lives in React `useState` in [`src/App.tsx`](src/App.tsx), seeded from
[`src/data/initialData.ts`](src/data/initialData.ts). There is **no backend and no persistence** —
reservations, check-ins, RSVPs and community posts reset on page refresh, and the user
switcher in the header stands in for real authentication.

This is intentional for the prototyping phase. Keeping all mutations centralized in
`App.tsx` is what will make the Firebase swap contained when the time comes.

## Architecture notes

- `src/components/` — one component per view; all data arrives via props
- `src/types.ts` — shared domain types (`Session`, `UserProfile`, `Track`, `Room`, …)
- `src/data/initialData.ts` — seed data

Capacity reservation and waitlist promotion live in `handleToggleReservation`
in `App.tsx`. The logic is correct for a single in-memory client; it will need to move
behind a transaction when a real datastore is added, since "atomic" currently means
"synchronous array mutation with one user".

## Deployment

Production is the Cloudflare Pages project `ci-events` (<https://ci-events.pages.dev>).
`npm run ship` typechecks, builds, pushes `main` and deploys it, from any machine
with a `wrangler login`. `.github/workflows/deploy.yml` does the same on every push
once the `CLOUDFLARE_API_TOKEN` repository secret exists; until then it only builds
and says so. Build settings live in [`wrangler.toml`](wrangler.toml); the Node
version is pinned by [`.node-version`](.node-version). Firestore and Storage rules
deploy separately — see [HANDOFF.md](HANDOFF.md).

```bash
npx wrangler pages deploy dist --project-name=ci-events --branch=main   # manual production deploy
```
