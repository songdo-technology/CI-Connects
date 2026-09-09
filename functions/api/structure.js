/**
 * Turns a pasted agenda into rows the importer can preview.
 *
 * Organisers hold this material as prose: an email from a caterer, a schedule
 * pasted out of a Word document, a sponsorship list with inconsistent columns.
 * Asking a model to shape it into a table removes the retyping without
 * removing the checking — the output is returned as ordinary CSV, dropped into
 * the same preview as a hand-made file, and validated, matched against
 * existing records and confirmed before anything is written. The model is a
 * transcriptionist here, never an author of record.
 *
 * The API key lives in this Worker's environment. A key compiled into the
 * browser bundle is public to anyone who opens devtools.
 */

const MAX_INPUT = 24000;

/**
 * Confirms the caller is a signed-in Chadwick account.
 *
 * Without this the endpoint is an open model proxy on the school's own
 * domain, billed to the school. Verified through Firebase's own lookup rather
 * than by parsing the token here: one call, no key rotation to track, and no
 * hand-rolled signature checking to get wrong.
 */
async function callerEmail(request, env) {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data?.users?.[0]?.email ?? null;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function buildPrompt(label, fields, text) {
  const columns = fields
    .map((f) => `- ${f.key}: ${f.label}${f.hint ? ` (${f.hint})` : ''}`)
    .join('\n');

  return `You are converting an event organiser's notes into a table of ${label}.

Return ONLY a JSON array of objects. Each object uses exactly these keys:
${columns}

Rules:
- One object per distinct item you find. Do not invent items.
- Omit a key entirely when the source does not say. Never guess a value that
  has consequences — capacities, dietary restrictions, email addresses and
  times must come from the text or be left out.
- Keep the source's own wording for names and titles.
- Times may be written however the source writes them; they are parsed later.

Source:
"""
${text}
"""`;
}

/** Anthropic and Google differ only in request shape; both return JSON text. */
async function askModel(env, prompt) {
  if (env.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic returned ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.content?.map((c) => c.text ?? '').join('') ?? '';
  }

  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8000 },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini returned ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  }

  return null;
}

/** Models wrap JSON in prose or code fences often enough to be worth handling. */
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('The model did not return a table.');
  return JSON.parse(candidate.slice(start, end + 1));
}

const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const onRequestPost = async ({ request, env }) => {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  const { label, fields, text } = payload ?? {};
  if (!Array.isArray(fields) || typeof text !== 'string' || !text.trim()) {
    return json({ error: 'Nothing to structure.' }, 400);
  }
  if (text.length > MAX_INPUT) {
    return json({
      error: `That is ${text.length.toLocaleString()} characters. Paste up to `
        + `${MAX_INPUT.toLocaleString()} at a time — a day of the programme rather than the whole week.`,
    }, 413);
  }

  // Setup state is reported before authentication only because verifying the
  // caller itself needs a key. Everything past this point requires a
  // signed-in Chadwick account, so an anonymous caller learns nothing beyond
  // whether the site is finished being configured.
  if (!env.FIREBASE_API_KEY) {
    return json({
      error: 'FIREBASE_API_KEY is not set on this site, so callers cannot be verified.',
      setup: true,
    }, 501);
  }

  const email = await callerEmail(request, env);
  if (!email) return json({ error: 'Sign in again and retry.' }, 401);
  if (!email.toLowerCase().endsWith('@chadwickschool.org')) {
    return json({ error: 'This is available to Chadwick staff accounts.' }, 403);
  }

  if (!env.ANTHROPIC_API_KEY && !env.GEMINI_API_KEY) {
    return json({
      error: 'No AI provider is configured for this site yet.',
      setup: true,
    }, 501);
  }

  try {
    const raw = await askModel(env, buildPrompt(label ?? 'rows', fields, text));
    const items = extractJson(raw ?? '');
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'Nothing recognisable was found in that text.' }, 422);
    }

    // Returned as CSV on purpose: it lands in the same box a pasted
    // spreadsheet does, so the organiser can read and edit it before any of
    // it counts, and the import path stays single.
    const keys = fields.map((f) => f.key);
    const header = fields.map((f) => escapeCell(f.label)).join(',');
    const body = items
      .map((item) => keys.map((k) => escapeCell(item?.[k] ?? '')).join(','))
      .join('\n');

    return json({ csv: `${header}\n${body}`, rows: items.length });
  } catch (e) {
    return json({ error: e.message || 'The model could not be reached.' }, 502);
  }
};
