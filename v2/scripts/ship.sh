#!/usr/bin/env sh
# Ship v2: typecheck, build for production, push main, deploy to the Cloudflare
# Pages project ci-events (https://ci-events.pages.dev) with this machine's
# wrangler login. Runs from the repository root so the Pages Functions in
# ./functions — the Firebase auth-handler proxy sign-in depends on — ride
# along with the bundle.
set -eu
cd "$(dirname "$0")/../.."          # repository root

if [ -n "$(git status --porcelain)" ]; then
  echo "ship: uncommitted changes — commit first:" >&2
  git status --short >&2
  exit 1
fi
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "ship: not on main" >&2; exit 1; }

( cd v2 && npm run lint && npm run build )

# .env.production points sign-in at this origin; a bundle without it would
# sign in through firebaseapp.com and fail on phones.
grep -lq 'ci-events\.pages\.dev' v2/dist/assets/*.js || { echo "ship: bundle is not built for ci-events.pages.dev (v2/.env.production missing?)" >&2; exit 1; }

git push origin main
npx wrangler pages deploy v2/dist --project-name=ci-events --branch=main
echo "ship: pushed and deployed — live matches main ($(git rev-parse --short HEAD))"
