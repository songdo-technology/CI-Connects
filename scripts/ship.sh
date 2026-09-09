#!/usr/bin/env sh
# Ship: push main to GitHub and deploy it to production, from this machine.
#
# Uses the wrangler login already on this Mac, so it needs no extra token.
# .github/workflows/deploy.yml does the same on every push once the
# CLOUDFLARE_API_TOKEN secret exists; until then, and whenever Actions is
# unavailable, this is the path that keeps live == main.
set -eu
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "ship: uncommitted changes — commit first (never deploy from a dirty tree):" >&2
  git status --short >&2
  exit 1
fi
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "ship: on '$branch', not main — production deploys come from main only." >&2
  exit 1
fi

npm run lint
npm run build
git push origin main
npx wrangler pages deploy dist --project-name=ci-events --branch=main

if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q -E '^(firestore\.rules|storage\.rules|firestore\.indexes\.json)$'; then
  echo "ship: rules files changed in this push — deploy them too:" >&2
  echo "      npx firebase deploy --only firestore:rules,storage --project ci-connects" >&2
fi
echo "ship: pushed and deployed — live matches main ($(git rev-parse --short HEAD))"
