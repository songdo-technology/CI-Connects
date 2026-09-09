/**
 * Serves Firebase's OAuth handler from this site's own origin.
 *
 * Firebase hosts the handler at <project>.firebaseapp.com/__/auth/. When the
 * app lives somewhere else — as it does here, on Pages — finishing a redirect
 * sign-in means passing a credential from that site to this one. Chrome 115+,
 * Safari's ITP and Firefox's ETP all partition the storage that hand-back
 * depends on, so it silently fails: getRedirectResult() resolves to null with
 * no error, and the visitor lands back on the sign-in screen.
 *
 * Proxying the handler through this origin makes the whole exchange
 * same-site, which is the fix Firebase itself recommends. Nothing is
 * rewritten; the upstream response is passed through as-is.
 */

const UPSTREAM_HOST = 'ci-connects.firebaseapp.com';

export const onRequest = async ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, `https://${UPSTREAM_HOST}`);

  const headers = new Headers(request.headers);
  // Let the upstream decide caching and content type for its own assets.
  headers.delete('host');
  headers.delete('accept-encoding');

  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    // The browser must see any redirect, not have it followed server-side:
    // the OAuth dance depends on the address bar actually moving.
    redirect: 'manual',
  });

  const out = new Headers(response.headers);
  // The handler is loaded in an iframe by the Firebase SDK. Upstream sends
  // framing headers scoped to its own origin, which would block that here.
  out.delete('x-frame-options');
  out.delete('content-security-policy');
  out.delete('content-security-policy-report-only');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out,
  });
};
