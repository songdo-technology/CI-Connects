#!/usr/bin/env sh
# Bootstrap: turn a fresh clone into a working checkout, on any machine.
#
#   gh auth login                      # once, songdo-technology@chadwickschool.org
#   gh repo clone songdo-technology/CI-Connects && cd CI-Connects
#   sh scripts/bootstrap.sh            # or: npm run bootstrap
#
# Needs Node 20+ and a logged-in gh. Writes .env.local from the GitHub
# repository variables (the same public Firebase config the Actions build
# uses), installs, typechecks and builds. Delete .env.local and re-run to
# regenerate it. Deploying afterwards needs `npx wrangler login` once.
set -eu
cd "$(dirname "$0")/.."
REPO=songdo-technology/CI-Connects

need() { command -v "$1" >/dev/null 2>&1 || { echo "bootstrap: missing '$1' — $2" >&2; exit 1; }; }
need node "install Node 22 from https://nodejs.org"
need npm  "comes with Node"
need gh   "brew install gh, then: gh auth login"

major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt 20 ]; then
  echo "bootstrap: Node $major is too old — need 20+ (.node-version says 22)" >&2; exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "bootstrap: run 'gh auth login' as songdo-technology@chadwickschool.org first" >&2; exit 1
fi
gh auth setup-git >/dev/null 2>&1 || true   # let git push over HTTPS with the gh login

echo "bootstrap: npm install"
npm install --no-audit --no-fund

if [ -f .env.local ]; then
  echo "bootstrap: .env.local already exists — keeping it"
else
  echo "bootstrap: writing .env.local from the $REPO repository variables"
  vars=$(gh variable list -R "$REPO")
  get() {
    v=$(printf '%s\n' "$vars" | awk -F'\t' -v k="$1" '$1==k {print $2}')
    [ -n "$v" ] || { echo "bootstrap: repository variable $1 is missing — see HANDOFF.md" >&2; exit 1; }
    printf '%s' "$v"
  }
  {
    echo "# Written by scripts/bootstrap.sh on $(date +%F) from the GitHub repository variables."
    echo "# Public Firebase client config, not credentials — access is governed by firestore.rules."
    echo "# Regenerate: rm .env.local && sh scripts/bootstrap.sh"
    for k in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
             VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID \
             VITE_ALLOWED_EMAIL_DOMAIN; do
      echo "$k=$(get "$k")"
    done
    echo "# The database is seeded; true = the real Firestore backend (the in-memory store hides permission bugs)."
    echo "VITE_USE_FIRESTORE=true"
  } > .env.local
fi

if ! grep -q '^VITE_FIREBASE_AUTH_DOMAIN=ci-events.pages.dev$' .env.local; then
  echo "bootstrap: VITE_FIREBASE_AUTH_DOMAIN must be ci-events.pages.dev — see docs/auth-domain-runbook.md" >&2; exit 1
fi

echo "bootstrap: typecheck"
npm run lint
echo "bootstrap: build"
npm run build

cat <<'DONE'

bootstrap: done.
  npm run dev              http://localhost:3000
  npx wrangler login       once, school account — then `npm run ship` pushes and deploys
  HANDOFF.md               current state, cloud wiring, gotchas, what is next
DONE
