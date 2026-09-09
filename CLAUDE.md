# Working in this repository

## Cloud-first: nothing lives only on one machine

This project moves between machines. After every meaningful change — a feature
finished, a bug fixed, a decision made — commit and push to GitHub, then say
plainly what the deploy state is. Anyone should be able to pick this up on a
different Mac without asking a person what happened.

```sh
git add -A && git commit -m "…" && git push origin main
```

**Pushing does not deploy.** Cloudflare Pages has no Git provider connected to
this repository, so a commit on GitHub and a live site are two different
things. When a change should be live:

```sh
npm run build
npx wrangler pages deploy dist --project-name=ci-events --branch=main
```

`--branch=main` is production. Any other branch makes a preview at its own
subdomain, which is fine for looking at but cannot sign in — preview subdomains
are not on the OAuth authorized list.

After pushing, state which of these is true, so the next session inherits the
truth rather than a guess:

- committed and pushed, and deployed — live matches `main`
- committed and pushed, not deployed — `main` is ahead of the live site
- deployed from an uncommitted tree — fix this immediately by committing

Firebase rules deploy separately and only when `firestore.rules` or
`storage.rules` changed:

```sh
npx firebase deploy --only firestore:rules --project ci-connects
```

## Secrets never enter this repository

`.env.local` is gitignored and stays that way. If a new variable is needed, add
it to `.env.example` with a placeholder and a comment saying where the real
value comes from. Keys for server-side calls belong in the Cloudflare Pages
environment, never in the bundle — anything compiled into the client is
readable by anyone who opens devtools.

## Verify against the real backend

The in-memory store models no security rules and no listener lifecycle. A
feature that works in the demo build proves nothing about Firestore, and every
auth and permission bug in this project was invisible until it ran against the
real one. Check `firestore.rules` before assuming a write will succeed, and
prefer verifying on a deploy over reasoning about what should happen.

Run `npx tsc --noEmit` after scripted or bulk edits. A scripted edit has
already written one file's contents into another here; the typecheck caught it.

## Read HANDOFF.md first

It carries the current state, the cloud wiring, the gotchas already paid for,
and what to do next.
