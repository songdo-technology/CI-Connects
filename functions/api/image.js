/**
 * Generates a cover image for an event.
 *
 * Finding a usable photograph is the step that stalls an event page: stock
 * libraries want a licence, the school's own photographs are on somebody's
 * drive, and the placeholder stays up for weeks. Generating one is not better
 * than a real photograph of the campus — it is better than an empty card, and
 * it takes a few seconds.
 *
 * Returns the bytes. The client stores them in Firebase Storage so the event
 * record holds a URL, the same as for an uploaded file: base64 in a Firestore
 * document would consume most of the megabyte a document is allowed.
 */

const MAX_PROMPT = 1200;

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
    status, headers: { 'Content-Type': 'application/json' },
  });

/**
 * Imagen's predict endpoint. Chosen over the chat-shaped image models because
 * its request and response shapes are stable, and the model name is a setting
 * so a provider renaming one is a variable change rather than a deploy.
 */
async function generate(env, prompt) {
  const model = env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          // A school's public site. The stricter setting is the right default
          // and can be loosened deliberately, never by accident.
          personGeneration: 'allow_adult',
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image generation failed (${response.status}). ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const prediction = data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('The model returned no image. Try describing the scene differently.');
  }
  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType || 'image/png',
  };
}

export const onRequestPost = async ({ request, env }) => {
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Malformed request.' }, 400); }

  const brief = String(payload?.prompt ?? '').trim();
  if (!brief) return json({ error: 'Describe the image you want.' }, 400);
  if (brief.length > MAX_PROMPT) {
    return json({ error: `Keep the description under ${MAX_PROMPT} characters.` }, 413);
  }

  if (!env.FIREBASE_API_KEY) {
    return json({ error: 'FIREBASE_API_KEY is not set, so callers cannot be verified.', setup: true }, 501);
  }

  const email = await callerEmail(request, env);
  if (!email) return json({ error: 'Sign in again and retry.' }, 401);
  if (!email.toLowerCase().endsWith('@chadwickschool.org')) {
    return json({ error: 'This is available to Chadwick staff accounts.' }, 403);
  }

  if (!env.GEMINI_API_KEY) {
    return json({
      error: 'Image generation needs GEMINI_API_KEY set on this site.',
      setup: true,
    }, 501);
  }

  // Steered towards something that will sit behind white type on an event
  // page, and away from the two things that would embarrass a school: text
  // rendered into the image, which models still get wrong, and anything
  // claiming to depict real, identifiable people.
  const prompt =
    `A wide, calm, photographic banner image for a school conference website. ${brief}. `
    + 'Editorial photography, natural light, muted and unsaturated, generous empty space '
    + 'in the upper left for a headline to sit over. No text, no lettering, no logos, '
    + 'no watermarks. Not a recognisable real person or real institution.';

  try {
    const image = await generate(env, prompt);
    return json(image);
  } catch (e) {
    return json({ error: e.message }, 502);
  }
};
