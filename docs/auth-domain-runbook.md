# Moving Firebase auth onto our own domain

## Why

The app is served from `ci-events.pages.dev`. Firebase serves its OAuth handler
from `ci-connects.firebaseapp.com/__/auth/`. Finishing a redirect sign-in means
passing a credential from that site to this one, and Chrome 115+, Safari's ITP
and Firefox's ETP all partition the storage that hand-back depends on.

It fails silently. `getRedirectResult()` resolves to `null` with no error, and
the visitor arrives back on the sign-in screen as though nothing happened.

The fix is to serve the handler from our own origin, so the whole exchange is
same-site. This is the approach Firebase itself recommends.

## What is already done

`functions/__/auth/[[path]].js` and `functions/__/firebase/[[path]].js` proxy
those paths through to `ci-connects.firebaseapp.com`. They are deployed and
verified:

    curl -s -o /dev/null -w "%{http_code}\n" https://ci-events.pages.dev/__/auth/handler     # 200
    curl -s -o /dev/null -w "%{http_code}\n" https://ci-events.pages.dev/__/auth/handler.js  # 200
    curl -s -o /dev/null -w "%{http_code}\n" https://ci-events.pages.dev/__/auth/iframe      # 200

The proxy does nothing until `authDomain` points at this domain, so it is safe
to leave in place while the steps below are carried out.

## Step 1 — Google Cloud Console (required, and only you can do it)

Google validates the OAuth `redirect_uri` against a list registered on the
client. Until the new address is on that list, switching `authDomain` breaks
sign-in outright with `redirect_uri_mismatch`. **Do this first.**

1. Open <https://console.cloud.google.com/apis/credentials> and select the
   **ci-connects** project.
2. Under **OAuth 2.0 Client IDs**, open the Web client:
   `898826571976-m0o3e6m03roftdtd2b7dsr5ak88unr9f`
3. Under **Authorised JavaScript origins**, add:

       https://ci-events.pages.dev

4. Under **Authorised redirect URIs**, add:

       https://ci-events.pages.dev/__/auth/handler

5. **Leave the existing `ci-connects.firebaseapp.com` entries in place.** They
   cost nothing and removing them breaks the rollback.
6. Save. Google can take a few minutes to propagate, occasionally longer.

## Step 2 — Firebase authorised domains (already correct)

Authentication -> Settings -> Authorized domains must include
`ci-events.pages.dev`. It does; no action needed. Verify any time with:

    curl -s "https://identitytoolkit.googleapis.com/v1/projects?key=$VITE_FIREBASE_API_KEY"

## Step 3 — Point the app at its own auth domain

In `.env.local`:

    VITE_FIREBASE_AUTH_DOMAIN=ci-events.pages.dev

Then rebuild and deploy:

    npm run build
    npx wrangler pages deploy dist --project-name=ci-events --branch=main

The value is compiled into the bundle at build time. Builds currently run
locally, so `.env.local` is the only place it lives. If Cloudflare's own build
pipeline is ever used, set the same variable there.

## Step 4 — Verify

Sign in with a `@chadwickschool.org` account. It should land in the portal
directly, with no reload. The Network tab should show the OAuth request going
to `ci-events.pages.dev/__/auth/handler` rather than the firebaseapp.com
address.

## Rolling back

Set `VITE_FIREBASE_AUTH_DOMAIN` back to `ci-connects.firebaseapp.com`, rebuild
and redeploy. Nothing else has to change, which is why step 1 says to keep the
old Console entries.

## When a custom domain arrives

Pointing something like `events.chadwickinternational.org` at this site means
repeating step 1 with that hostname, adding it to Firebase's authorised
domains, and setting `VITE_FIREBASE_AUTH_DOMAIN` to it. The proxy needs no
change — it keys off the incoming path, not the hostname.
