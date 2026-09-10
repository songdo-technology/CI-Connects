# Working in this repository

**The live site is v2, the app in `v2/`.** v1 at the repository root is
sealed at tag `v1.0.0`: it builds, nothing deploys it, do not extend it.

## Cloud-first: nothing lives only on one machine

This project moves between machines. After every meaningful change — a feature
finished, a bug fixed, a decision made — commit and push to GitHub, then say
plainly what the deploy state is. Anyone should be able to pick this up on a
different Mac without asking a person what happened.

```sh
git add -A && git commit -m "…" && git push origin main
```

**Pushing `main` deploys.** `.github/workflows/deploy.yml` runs on every push
to `main`: typecheck and build `v2/`, then `wrangler pages deploy v2/dist` to
the `ci-events` project as production. It needs the `CLOUDFLARE_API_TOKEN` repository secret;
without it the run still builds but ends with a "not deployed" warning, and
`main` is ahead of the live site. Cloudflare's own Git integration is NOT used:
`ci-events` was created by direct upload and cannot be switched, and a new
project would change the origin the OAuth handler is registered on.

After pushing, check the run (`gh run watch`, or the Actions tab) and state
which of these is true, so the next session inherits the truth rather than a
guess:

- pushed, Actions green — live matches `main`
- pushed with `npm run ship` (Actions warns "not deployed") — live matches `main`
- pushed with plain `git push` and Actions warned or failed — `main` is ahead of live
- deployed by hand from an uncommitted tree — fix this immediately by committing

From a machine with a wrangler login, `npm run ship` (root or `v2/`) does
typecheck → build → `git push` → deploy in one step with no token; it refuses
a dirty tree, a branch other than `main`, or a bundle not built for
`ci-events.pages.dev`. Always deploy from the repository root: `functions/`
(the auth-handler proxy) is picked up from the working directory. Once the Actions secret is set, a plain `git push`
is enough and `ship` merely deploys the same bundle twice.

Manual deploy still works and is the fallback when Actions is unavailable:

```sh
(cd v2 && npm run build)
npx wrangler pages deploy v2/dist --project-name=ci-events --branch=main
```

`--branch=main` is production. Any other branch makes a preview at its own
subdomain, which is fine for looking at but cannot sign in — preview subdomains
are not on the OAuth authorized list.

Firebase rules deploy separately and only when `firestore.rules`,
`storage.rules` or `firestore.indexes.json` change. `.github/workflows/rules.yml`
does it on push if the `FIREBASE_SERVICE_ACCOUNT` secret is set; otherwise by
hand:

```sh
npx firebase deploy --only firestore:rules,storage --project ci-connects
```

## Secrets never enter this repository

`v2/.env.local` is gitignored and stays that way (`v2/.env.production` is
committed on purpose: it holds only the production auth domain). If a new
variable is needed, add it to `v2/.env.example` with a placeholder and a
comment saying where the real value comes from. Keys for server-side calls belong in the Cloudflare Pages
environment, never in the bundle — anything compiled into the client is
readable by anyone who opens devtools.

## Verify against the real backend

v2 has no demo mode: `npm run dev` in `v2/` talks to the real Firestore
(`/v2/data`) and real Firebase Auth, and that is where to verify. Every auth
and permission bug in this project was invisible until it ran against the
real backend. Check the v2 block at the end of `firestore.rules` before
assuming a write will succeed, and prefer verifying on a deploy over
reasoning about what should happen. Anything that needs a signed-in person
(the portal, administration, scanning) is for the user to try in their own
browser; anonymous pages can be checked from the preview pane.

Everything the interface shows is English: no `toLocale*` call without an
explicit locale, no native date or time pickers (they render in the OS
language), `noValidate` on forms. The user asked for this after "오전 09:00"
appeared in the session editor on a Korean machine.

Run `npx tsc --noEmit` after scripted or bulk edits. A scripted edit has
already written one file's contents into another here; the typecheck caught it.

## New machine

`gh auth login` as the school account, clone, `sh scripts/bootstrap.sh`. That
yields a working v2 checkout with `v2/.env.local` generated from the
repository variables. Deploying from it needs `npx wrangler login` once
(`npm run ship`).

## Read HANDOFF.md first

It carries the current state, the cloud wiring, the gotchas already paid for,
and what to do next.
