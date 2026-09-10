#!/usr/bin/env node
/**
 * Writes seed JSON into Firestore under /v2/data, as the account signed in
 * to firebase-tools on this machine (a project owner — security rules do
 * not apply). No dependencies.
 *
 *   npm run seed -- seed/korcos-2025.json
 *
 * Every collection in the file is written document by document. A document
 * that already exists is updated field by field, but seats already held
 * (reservedUserIds, waitlistUserIds), a session's checkinCode and a
 * person's role and eventAccess are never overwritten — re-importing a
 * programme must not throw anyone out of their sessions or off a list.
 *
 * The token comes from `npx firebase login` (school account). Set
 * FIREBASE_ACCESS_TOKEN to use a token from elsewhere instead.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'ci-connects';
const PROTECTED = { sessions: ['reservedUserIds', 'waitlistUserIds', 'checkinCode'], users: ['role', 'eventAccess'] };
const ORDER = ['settings', 'users', 'events', 'rooms', 'tracks', 'sponsors', 'sessions', 'announcements', 'invites'];

const file = process.argv[2];
if (!file) { console.error('usage: node seed/seed.mjs <seed.json>'); process.exit(1); }
const seed = JSON.parse(fs.readFileSync(file, 'utf8'));

// The Firebase CLI's own OAuth client, read from its installed package —
// the same exchange the CLI performs for its commands.
function firebaseToolsApi() {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const p = path.join(dir, 'node_modules/firebase-tools/lib/api.js');
    if (fs.existsSync(p)) return p;
    if (dir === path.dirname(dir)) throw new Error('firebase-tools is not installed anywhere above ' + process.cwd());
  }
}
async function accessToken() {
  if (process.env.FIREBASE_ACCESS_TOKEN) return process.env.FIREBASE_ACCESS_TOKEN;
  const cfgPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  const refresh = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).tokens?.refresh_token;
  if (!refresh) throw new Error('no firebase-tools login — run: npx firebase login');
  const api = fs.readFileSync(firebaseToolsApi(), 'utf8');
  const clientId = /([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)/.exec(api)?.[1];
  const clientSecret = /FIREBASE_CLIENT_SECRET",\s*"([^"]+)"/.exec(api)?.[1];
  if (!clientId || !clientSecret) throw new Error('could not read the CLI OAuth client from firebase-tools');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

// ------------------------------------------------------------ Firestore REST
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== undefined).map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: fields(v) } };
  throw new Error(`cannot encode ${typeof v}`);
};
const fields = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/v2/data`;
const TOKEN = await accessToken();
async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${method} ${url}\n${(await r.text()).slice(0, 600)}`);
  return r.json();
}

for (const col of [...ORDER, ...Object.keys(seed).filter((k) => !ORDER.includes(k))]) {
  const docs = seed[col];
  if (!Array.isArray(docs) || docs.length === 0) continue;
  let created = 0, updated = 0;
  for (const doc of docs) {
    if (!doc.id) throw new Error(`${col}: a document without an id`);
    const url = `${BASE}/${col}/${encodeURIComponent(doc.id)}`;
    const existing = await call('GET', url);
    const keep = existing ? (PROTECTED[col] ?? []) : [];
    const data = Object.fromEntries(Object.entries(doc).filter(([k, v]) => v !== undefined && !keep.includes(k)));
    const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    await call('PATCH', `${url}?${mask}`, { fields: fields(data) });
    existing ? updated++ : created++;
  }
  console.log(`${col}: ${created} created, ${updated} updated`);
}
