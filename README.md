# CI Events

Conference and event management platform for **Chadwick International Summit 2026** —
multi-track scheduling, community networking, QR badge check-in, and an organizer console.

## Stack

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **Cloudflare Pages** for hosting
- **Firebase** for data and auth *(planned — not yet wired in)*

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

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

Pushes to `main` deploy automatically to Cloudflare Pages. Build settings live in
[`wrangler.toml`](wrangler.toml); Node version is pinned by [`.node-version`](.node-version).

```bash
npx wrangler pages deploy dist    # manual / preview deploy
```
