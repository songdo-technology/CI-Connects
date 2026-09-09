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

Google checks the OAuth `redirect_uri` against a list registered on the client.
Until the new address is on that list, switching `authDomain` breaks sign-in
outright with `redirect_uri_mismatch`. **Do this first, and do not skip the
verification at the end.**

### 1. Open the credentials page

<https://console.cloud.google.com/apis/credentials?project=ci-connects>

Check the project selector at the top reads **ci-connects**. If it does not,
click it and pick that project. This is the same Google project Firebase uses —
Firebase is a layer on top of it, which is why the setting lives here rather
than in the Firebase console.

### 2. Find the right client

Under **OAuth 2.0 Client IDs** there may be several rows. The one to open is
the **Web client**, whose ID begins:

    898826571976-m0o3e6m03roftdtd2b7dsr5ak88unr9f

It is often named "Web client (auto created by Google Service)". Click its
name — not the download or copy icons — to open it.

*If you see no "APIs & Services" section:* newer projects put this under
**Google Auth Platform -> Clients** instead. Same client, same fields.

### 3. Add the JavaScript origin

Find **Authorised JavaScript origins**, click **+ ADD URI**, and paste exactly:

    https://ci-events.pages.dev

No trailing slash. No path.

### 4. Add the redirect URI

Find **Authorised redirect URIs** — a separate list, further down the same
page. Click **+ ADD URI** and paste exactly:

    https://ci-events.pages.dev/__/auth/handler

Two underscores on each side of `auth`. This is the address the Cloudflare
proxy already answers on.

### 5. Do not remove anything

Leave every existing `ci-connects.firebaseapp.com` entry exactly as it is.
They cost nothing, and they are what makes the rollback in Step 3 possible.

### 6. Save, then wait

Click **SAVE**. Google's own note says changes can take five minutes to a few
hours to take effect. It is usually a few minutes.

### 7. Verify it landed

From the project root:

    ./check-oauth-uri.sh "https://ci-events.pages.dev/__/auth/handler"

Before the change this prints `NOT REGISTERED`. Once Google has propagated it,
it prints `registered`. The script asks Google directly and involves no
account and no credential, so it can be run as often as you like while
waiting.

## Step 2 — Firebase authorised domains (already correct)

Authentication -> Settings -> Authorized domains must include
`ci-events.pages.dev`. It does; no action needed. Verify any time with:

    curl -s "https://identitytoolkit.googleapis.com/v1/projects?key=$VITE_FIREBASE_API_KEY"

## Step 3 — Point the app at its own auth domain

Only once step 1 verifies as `registered`. In `.env.local`:

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
