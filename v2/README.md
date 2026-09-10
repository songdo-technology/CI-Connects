# CI Connects v2

The rebuild. Same job as v1 — Chadwick International's events: programmes,
seats, badges, the people in the room — with a smaller model, three roles
and a new interface. **Not deployed.** It runs on this machine only until
someone says otherwise; v1 stays live at ci-events.pages.dev.

## Run it

```sh
npm install
npm run dev        # http://localhost:3100 — real Google sign-in, Firestore /v2/data
npm run demo       # http://localhost:3101 — no Firebase: in-memory seed, pick a persona
npm run lint       # tsc --noEmit
npm run build
```

`.env.local` holds the same Firebase client config as v1 (copy it from
`../.env.local`, with `VITE_FIREBASE_AUTH_DOMAIN=ci-connects.firebaseapp.com`
— localhost signs in by pop-up, so the auth-domain proxy v1 needed does not
apply here).

## Roles

| Role | May |
|------|-----|
| `admin` | Everything: events, programmes, who is listed, roles, announcements, settings |
| `schedule_admin` | Programmes only: sessions, rooms, tracks, imports, check-in |
| `user` | See inside the events they are listed on; reserve seats; their badge and day |

`songdo-technology@` and `jyyang@chadwickschool.org` provision themselves as
administrators on first sign-in (`BOOTSTRAP_ADMINS` in `src/lib/firebase.ts`,
mirrored in `firestore.rules`). Everyone else arrives as a member.

## Signing in

Email and password first, Google below, nothing else. Guests create an
account with their name, school and title; a Chadwick address is sent to
Google instead (their Workspace profile is what shows). Both use Firebase
Auth's providers on project `ci-connects`.

## Attendance and QR

- **Badge → staff camera.** Every person's badge is a QR (`ci2:<uid>`).
  Administration → Events → Check-in → *Scan badges* opens the camera
  (jsQR) and records arrival at the venue, or at the session chosen in the
  dropdown. A handheld scanner typing into the field works too.
- **Door → person's phone.** Choose a session on Check-in and open *Door
  QR* (`/door/<eventId>/<sessionId>`): a full-screen code for a tablet or a
  print. Scanning it opens `/e/<slug>/here?s=…&c=…`; the person taps
  *Confirm I am here* and records their own attendance. The rules accept it
  only while `c` matches the session's `checkinCode`; *New code* retires
  every earlier copy. The badge page lists the sessions a person was at.

## Sponsors

Per event, with tiers, logos and websites (Administration → Events →
Sponsors). Shown as *Supported by* on the public page, as a Sponsors tab
in the portal, and as a partner credit on any session that names one.

## Who sees an event

Inside an event — programme, seats, badge, speakers, venue — is for people an
administrator listed. Two ways on to a list, both from **Administration →
Events → Access**:

- tick a person who has already signed in (`users.eventAccess`), or
- invite an address. The invitation is a document named
  `<eventId>__<sha256(email)>`, which the security rules can find from a
  sign-in token without a query — so the event opens the moment that address
  signs in with Google. No codes.

The public page of a published event is for everyone; its programme is not.

## Where things live

```
src/lib/types.ts       the model — one file
src/lib/store.ts       Store interface; FirestoreStore (/v2/data/*) and MemoryStore (demo)
src/lib/auth.tsx       Google sign-in, profile provisioning, "view as" for administrators
src/lib/roles.ts       canSeeEvent(), isStaff(), isAdmin()
src/lib/schedule.ts    slots, clashes, seat state, waitlist promotion
src/lib/csv.ts         spreadsheet import
src/components/        ui kit, layouts, programme components
src/pages/             public, app, event, admin, admin-event
seed/data.json         KORCOS 2026 and the two administrators — what production starts from
```

Data is under `/v2/data/<collection>/<id>` in the same Firestore project as
v1, so both versions coexist; the v2 rules block is at the end of
`../firestore.rules`. Seed with the REST helper used on 10 Sep 2026 (see
HANDOFF.md) or, once an administrator can sign in, through the interface.

## Not in v2 (yet)

Certificates, dining choices, lucky draw, spend, room signage, messaging and
the community board, AI import. Each has a place in the model when it is
wanted; none was asked for in the rebuild.
