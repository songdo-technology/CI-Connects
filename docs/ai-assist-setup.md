# Turning on AI assistance

Admin -> Import can take an agenda written as prose — an email from a caterer,
a schedule pasted out of Word, a sponsor list with no columns — and shape it
into rows. The rows land in the same preview a hand-made CSV does, so they are
validated, matched against existing records and confirmed before anything is
written. The model transcribes; it never writes to the database.

Until a key is configured the panel explains what is missing and everything
else in the importer works normally.

## Where the key lives

In the Cloudflare Pages environment, not in the app. A key compiled into the
browser bundle is readable by anyone who opens devtools, and would be billed to
the school by whoever found it.

## Steps

1. Get a key from **one** provider:
   - **Gemini** — <https://aistudio.google.com/apikey>. Natural fit here, since
     the school is already on Google Workspace and the billing account exists.
   - **Anthropic** — <https://console.anthropic.com/settings/keys>.

2. In the Cloudflare dashboard: **Workers & Pages -> ci-events -> Settings ->
   Variables and secrets**. Add, as **Secret** (encrypted, not plaintext):

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` *or* `ANTHROPIC_API_KEY` | the key from step 1 |
   | `FIREBASE_API_KEY` | the same value as `VITE_FIREBASE_API_KEY` in `.env.local` |

   `FIREBASE_API_KEY` is how the endpoint confirms the caller is a signed-in
   Chadwick account. Without it the endpoint refuses everyone, which is the
   right failure: an unauthenticated model proxy on the school's own domain
   would be billed to the school.

3. Apply to **Production**. Redeploy, or wait for the next deploy — secrets are
   read at request time, but a fresh deployment guarantees it.

4. Test: Admin -> Import -> paste a couple of lines of an agenda -> **Turn this
   into rows**.

## Cover images

The same `GEMINI_API_KEY` also powers **Generate one** on an event's cover
image (Admin -> Events). The brief is built from the event's own name, tagline
and summary, so there is no second description to write.

The generated image is stored in Firebase Storage and the event keeps a URL —
the same path an uploaded file takes. Image bytes never go into a Firestore
document, which is allowed only a megabyte in total.

The prompt steers away from the two things that would embarrass a school:
lettering rendered into the image, which models still get wrong, and anything
claiming to depict real, identifiable people. A generated illustration is
better than an empty card and worse than a real photograph of the campus —
use a real one wherever you have it.

Model defaults to `imagen-3.0-generate-002`; override with `IMAGEN_MODEL`.

## Choosing a model

Defaults are `gemini-2.0-flash` and `claude-sonnet-5`. Override without a code
change by also setting `GEMINI_MODEL` or `ANTHROPIC_MODEL`.

## What the model is sent

The column names for the chosen import type, and the text pasted into the box.
Nothing about the event, and nothing from the directory. If both keys are set,
Anthropic is used.

## Limits

Up to 24,000 characters per request — a day of a programme rather than a whole
week. Longer input is refused with a message saying so rather than being
silently truncated.
