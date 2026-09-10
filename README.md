# CI Connects

Chadwick International's event platform — the programme, seats, badges and
the people in the room for events such as KORCOS 2026.

- **Live:** <https://ci-events.pages.dev> — this is **v2**, the app in [`v2/`](v2/)
- **Repo:** <https://github.com/songdo-technology/CI-Connects>, branch `main`
- **v1** (the first platform) is sealed at tag `v1.0.0` at the repository
  root. It still builds, but nothing deploys it any more.

## Run v2

```bash
gh auth login              # once, as songdo-technology@chadwickschool.org
sh scripts/bootstrap.sh    # v2: npm install, .env.local from the repo variables, typecheck, build
cd v2 && npm run dev       # http://localhost:3100
```

| From the root | Does |
| --- | --- |
| `npm run bootstrap` | Fresh clone → working v2 checkout (writes `v2/.env.local`) |
| `npm run ship` | v2: typecheck, build, push `main`, deploy to production (needs `npx wrangler login` once) |

| In `v2/` | Does |
| --- | --- |
| `npm run dev` | Dev server on port 3100 — real sign-in, Firestore `/v2/data` |
| `npm run build` | Production build to `v2/dist/` (auth domain from `.env.production`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm run ship` | Same as the root `ship` |

## How it is deployed

Cloudflare Pages project `ci-events`, by direct upload from a machine with a
wrangler login (`npm run ship`), or from GitHub Actions on push to `main`
once the `CLOUDFLARE_API_TOKEN` secret exists. The upload is `v2/dist` plus
the Pages Functions in [`functions/`](functions/) — the Firebase OAuth
handler is proxied through this origin so sign-in works on phones
([docs/auth-domain-runbook.md](docs/auth-domain-runbook.md)). Firebase
project `ci-connects` holds auth and data; `firestore.rules` is the real
security boundary.

Read [HANDOFF.md](HANDOFF.md) for the current state and the gotchas, and
[v2/README.md](v2/README.md) for how the app is put together.
