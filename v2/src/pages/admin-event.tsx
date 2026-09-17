import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation } from 'react-router';
import {
  ArrowLeft, Plus, Trash2, Upload, AlertTriangle, Check, DoorOpen, Tag, Search, UserPlus, Mail, ScanLine, CircleCheck, Undo2, KeyRound, ClipboardCheck, ListTree, Camera, QrCode, Handshake, Pencil, Radio, MonitorPlay, X, Copy, ClipboardCopy, RefreshCw, IdCardLanyard, Printer,
} from 'lucide-react';
import { Event, Session, Room, Track, SessionType, SESSION_TYPE_LABEL, Invite, Profile, Attendance, Sponsor, SponsorTier, SPONSOR_TIERS, SPONSOR_TIER_LABEL, ROLE_LABEL } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isAdmin } from '../lib/roles';
import { formatRange, formatDate, formatTime, eachDate, nowIso, newId, formatStamp, formatClock, todayYmd, toMinutes } from '../lib/time';
import { byStart, overlaps } from '../lib/schedule';
import { parseCsv, rowsToSessions, parseSpeakers, CSV_TEMPLATE, ImportRow } from '../lib/csv';
import { inviteId, randomCode } from '../lib/hash';
import { useEventData, TrackDot } from '../components/schedule';
import { Scanner } from '../components/Scanner';
import { Button, Card, Chip, Drawer, Empty, Field, Input, Notice, Select, Spinner, Textarea, PageHeader, Avatar, SubNav, TimeInput } from '../components/ui';
import { ImagePicker } from '../components/ImagePicker';
import { badgeUid } from '../components/Badge';
import { RoomPicker, RoomChoice } from '../components/RoomPicker';
import { roomLabel, roomWhere, facilityWhere } from '../lib/rooms';
import { BadgeCard, BadgeData } from '../components/Badge';
import { BadgePrintSheet, PrintLayout } from '../components/BadgePrint';
import { BADGE_FORMATS, BadgeFormat, rememberedFormat, rememberFormat, sheetGrid } from '../lib/badgeFormats';
import { SmartImport } from '../components/SmartImport';

const TYPES: SessionType[] = ['keynote', 'talk', 'workshop', 'panel', 'break', 'social'];
const COLORS = ['#002B54', '#2A6791', '#56A0D3', '#5E6513', '#B04318', '#8B5E34', '#6B605A', '#7C3AED'];

const EventHeader: React.FC<{ event: Event; title: string; description?: string; actions?: React.ReactNode }> = ({ event, title, description, actions }) => {
  const { profile } = useAuth();
  return (
    <div className="mb-6">
      <Link to="/admin/events" className="btn-ghost btn-sm mb-3"><ArrowLeft className="w-4 h-4" />Events</Link>
      <PageHeader eyebrow={`${event.name} · ${formatRange(event.startDate, event.endDate)}`} title={title} description={description} actions={actions} className="mb-4" />
      <SubNav items={[
        { to: `/admin/events/${event.id}/schedule`, label: 'Schedule' },
        ...(isAdmin(profile) ? [{ to: `/admin/events/${event.id}/access`, label: 'Access' }] : []),
        { to: `/admin/events/${event.id}/checkin`, label: 'Check-in' },
        { to: `/admin/events/${event.id}/sponsors`, label: 'Sponsors' },
        ...(isAdmin(profile) ? [{ to: `/admin/events/${event.id}`, label: 'Details', end: true }] : []),
      ]} />
    </div>
  );
};

// ================================================================== schedule
const blankSession = (event: Event, rooms: Room[]): Session => ({
  id: newId('ses'), eventId: event.id, title: '', abstract: '', type: 'talk', date: event.startDate,
  start: '09:00', end: '10:00', roomId: rooms[0]?.id ?? '', trackId: undefined, speakers: [], capacity: rooms[0]?.capacity ?? 0,
  reservedUserIds: [], waitlistUserIds: [],
});

export const AdminSchedule: React.FC = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const data = useEventData(id ?? null);
  const [editing, setEditing] = useState<Session | null>(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const sid = params.get('session');
    if (sid && data.ready) { const s = data.sessions.find((x) => x.id === sid); if (s) setEditing(s); }
  }, [params, data.ready, data.sessions]);
  if (!ready || !data.ready) return <Spinner />;
  if (!event) return <Empty icon={ListTree} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  const dates = eachDate(event.startDate, event.endDate);
  const sorted = [...data.sessions].sort(byStart);
  const closeEditor = () => { setEditing(null); if (params.get('session')) setParams({}); };

  return (
    <div>
      <EventHeader event={event} title="Schedule" description={`${data.sessions.length} sessions · ${data.rooms.length} rooms · ${data.tracks.length} tracks`}
        actions={<><Button variant="secondary" onClick={() => setImporting(true)}><Upload className="w-4 h-4" />Import</Button><Button onClick={() => setEditing(blankSession(event, data.rooms))}><Plus className="w-4 h-4" />New session</Button></>} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6">
        <div className="space-y-8">
          {sorted.length === 0 && <Empty icon={ListTree} title="No sessions yet" body="Add one, or import a spreadsheet." action={<Button onClick={() => setEditing(blankSession(event, data.rooms))}><Plus className="w-4 h-4" />New session</Button>} />}
          {dates.map((d) => {
            const day = sorted.filter((s) => s.date === d);
            if (day.length === 0) return null;
            return (
              <section key={d}>
                {dates.length > 1 && <div className="eyebrow mb-2">{formatDate(d)}</div>}
                <Card className="divide-y divide-sand-200">
                  {day.map((s) => {
                    const room = data.rooms.find((r) => r.id === s.roomId);
                    const track = data.tracks.find((t) => t.id === s.trackId);
                    const clash = day.some((o) => o.id !== s.id && o.roomId === s.roomId && overlaps(o, s));
                    return (
                      <button key={s.id} onClick={() => setEditing(s)} className="w-full text-left p-3.5 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 hover:bg-sand-50 transition-colors">
                        <div className="text-xs tabular-nums text-ink-700 pt-0.5">{formatTime(s.start)}<div className="text-ink-300">{formatTime(s.end)}</div></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-ink-900 text-sm">{s.title || <em className="text-ink-300">Untitled</em>}</span>
                            <Chip>{SESSION_TYPE_LABEL[s.type]}</Chip>
                            {track && <Chip className="bg-white border border-sand-200 text-ink-700"><TrackDot track={track} />{track.name}</Chip>}
                            {clash && <Chip tone="rose"><AlertTriangle className="w-3 h-3" />Room clash</Chip>}
                          </div>
                          <div className="text-xs text-ink-500 mt-1">{[room ? roomLabel(room) : 'No room', s.speakers.map((x) => x.name).join(', ') || null, s.capacity ? `${s.reservedUserIds.length}/${s.capacity} seats${s.waitlistUserIds.length ? ` · ${s.waitlistUserIds.length} waiting` : ''}` : 'open seating'].filter(Boolean).join(' · ')}</div>
                        </div>
                      </button>
                    );
                  })}
                </Card>
              </section>
            );
          })}
        </div>
        <aside className="space-y-5">
          <RoomsPanel event={event} rooms={data.rooms} sessions={data.sessions} />
          <TracksPanel event={event} tracks={data.tracks} sessions={data.sessions} />
        </aside>
      </div>

      <SessionEditor event={event} session={editing} rooms={data.rooms} tracks={data.tracks} sponsors={data.sponsors} others={data.sessions} onClose={closeEditor} />
      <SmartImport event={event} open={importing} rooms={data.rooms} tracks={data.tracks} sessions={data.sessions} onClose={() => setImporting(false)} />
    </div>
  );
};

const RoomsPanel: React.FC<{ event: Event; rooms: Room[]; sessions: Session[] }> = ({ event, rooms, sessions }) => {
  const [form, setForm] = useState({ name: '', capacity: '', location: '' });
  const add = async () => {
    if (!form.name.trim()) return;
    const r: Room = { id: newId('room'), eventId: event.id, name: form.name.trim(), capacity: Number(form.capacity) || 0, location: form.location.trim() || undefined, order: rooms.length + 1 };
    await store.set('rooms', r.id, r); setForm({ name: '', capacity: '', location: '' });
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3"><DoorOpen className="w-4 h-4 text-blue-400" /><span className="font-semibold text-sm text-ink-900">Rooms</span></div>
      <ul className="space-y-1.5 mb-3">
        {rooms.map((r) => {
          const used = sessions.some((s) => s.roomId === r.id);
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0"><div className="text-ink-900 truncate">{roomLabel(r)}</div><div className="text-[11px] text-ink-500">{[r.capacity ? `${r.capacity} seats` : 'open', roomWhere(r)].filter(Boolean).join(' · ')}</div></div>
              <button disabled={used} onClick={() => void store.remove('rooms', r.id)} title={used ? 'In use by a session' : 'Remove'} className="btn-ghost btn-sm disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          );
        })}
        {rooms.length === 0 && <li className="text-xs text-ink-500">No rooms yet.</li>}
      </ul>
      <div className="space-y-2 pt-3 border-t border-sand-200">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Room name" className="py-1.5 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Seats" type="number" className="py-1.5 text-xs" />
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where" className="py-1.5 text-xs" />
        </div>
        <Button size="sm" variant="secondary" onClick={() => void add()} disabled={!form.name.trim()} className="w-full"><Plus className="w-3.5 h-3.5" />Add room</Button>
      </div>
    </Card>
  );
};

const TracksPanel: React.FC<{ event: Event; tracks: Track[]; sessions: Session[] }> = ({ event, tracks, sessions }) => {
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const t: Track = { id: newId('track'), eventId: event.id, name: name.trim(), color: COLORS[tracks.length % COLORS.length], order: tracks.length + 1 };
    await store.set('tracks', t.id, t); setName('');
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-blue-400" /><span className="font-semibold text-sm text-ink-900">Tracks</span></div>
      <ul className="space-y-1.5 mb-3">
        {tracks.map((t) => {
          const used = sessions.some((s) => s.trackId === t.id);
          return (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2 min-w-0"><input type="color" value={t.color} onChange={(e) => void store.update('tracks', t.id, { color: e.target.value })} className="w-5 h-5 rounded border-0 bg-transparent p-0" title="Colour" /><span className="truncate text-ink-900">{t.name}</span></span>
              <button disabled={used} onClick={() => void store.remove('tracks', t.id)} title={used ? 'In use by a session' : 'Remove'} className="btn-ghost btn-sm disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          );
        })}
        {tracks.length === 0 && <li className="text-xs text-ink-500">No tracks yet — they are optional.</li>}
      </ul>
      <div className="flex gap-2 pt-3 border-t border-sand-200">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Track name" className="py-1.5 text-xs" onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        <Button size="sm" variant="secondary" onClick={() => void add()} disabled={!name.trim()}><Plus className="w-3.5 h-3.5" /></Button>
      </div>
    </Card>
  );
};

const speakersToText = (sp: Session['speakers']) => sp.map((s) => s.title || s.org ? `${s.name} (${[s.title, s.org].filter(Boolean).join(', ')})` : s.name).join('; ');
const materialsToText = (m: Session['materials']) => (m ?? []).map((x) => `${x.label} | ${x.url}`).join('\n');
const textToMaterials = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [label, url] = l.split('|').map((x) => x.trim()); return url ? { label: label || url, url } : { label, url: label }; });

const SessionEditor: React.FC<{ event: Event; session: Session | null; rooms: Room[]; tracks: Track[]; sponsors: Sponsor[]; others: Session[]; onClose: () => void }> =
  ({ event, session, rooms, tracks, sponsors, others, onClose }) => {
    const [form, setForm] = useState<Session | null>(null);
    const [speakers, setSpeakers] = useState('');
    const [materials, setMaterials] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [force, setForce] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const users = useWatch('users', []);
    const facilities = useWatch('facilities', []);
    const people = useMemo(() => users.items.filter((u) => u.role !== 'user' || u.eventAccess.includes(event.id)).sort((a, b) => a.name.localeCompare(b.name)), [users.items, event.id]);
    useEffect(() => {
      setForm(session); setSpeakers(session ? speakersToText(session.speakers) : ''); setMaterials(session ? materialsToText(session.materials) : '');
      setError(null); setForce(false); setConfirmDelete(false);
    }, [session]);
    if (!form) return <Drawer open={false} onClose={onClose} title="" />;
    const isNew = !others.some((s) => s.id === form.id);
    const set = (patch: Partial<Session>) => setForm({ ...form, ...patch });
    const dates = eachDate(event.startDate, event.endDate);
    const clash = others.filter((o) => o.id !== form.id && o.roomId === form.roomId && overlaps(o, form));
    const save = async () => {
      setError(null);
      if (!form.title.trim()) return setError('Give the session a title.');
      if (form.end <= form.start) return setError('It ends before it starts.');
      if (!form.roomId) return setError('Choose a room.');
      if (clash.length > 0 && !force) return setError(`That room is taken then by "${clash[0].title}". Tick "save anyway" to double-book it on purpose.`);
      setBusy(true);
      try {
        const mats = textToMaterials(materials);
        const hosts = form.hostIds ?? [];
        await store.set('sessions', form.id, { ...form, title: form.title.trim(), speakers: parseSpeakers(speakers), materials: mats.length ? mats : undefined, trackId: form.trackId || undefined, sponsorId: form.sponsorId || undefined, hostIds: hosts.length ? hosts : undefined });
        // Each host's profile lists the sessions they run; that list is what the rules check.
        const before = session?.hostIds ?? [];
        for (const id of hosts.filter((x) => !before.includes(x))) { const u = users.items.find((x) => x.id === id); if (u) await store.update('users', id, { hostOf: [...new Set([...(u.hostOf ?? []), form.id])] }); }
        for (const id of before.filter((x) => !hosts.includes(x))) { const u = users.items.find((x) => x.id === id); if (u) await store.update('users', id, { hostOf: (u.hostOf ?? []).filter((s) => s !== form.id) }); }
        onClose();
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const remove = async () => { setBusy(true); await store.remove('sessions', form.id); setBusy(false); onClose(); };
    // A campus room chosen for the first time becomes one of this event's rooms.
    const chooseRoom = async (c: RoomChoice) => {
      let room: Room;
      if ('room' in c) room = c.room;
      else {
        const f = c.facility;
        const existing = rooms.find((r) => r.facilityId === f.id || (f.number ? r.number === f.number : false));
        if (existing) room = existing;
        else { room = { id: newId('room'), eventId: event.id, name: f.name, number: f.number, facilityId: f.id, where: facilityWhere(f), capacity: 0, order: rooms.length + 1 }; await store.set('rooms', room.id, room); }
      }
      set({ roomId: room.id, ...(form.capacity === 0 && room.capacity ? { capacity: room.capacity } : {}) });
    };
    return (
      <Drawer open onClose={onClose} title={isNew ? 'New session' : 'Edit session'} wide>
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Title"><Input value={form.title} onChange={(e) => set({ title: e.target.value })} autoFocus /></Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Type"><Select value={form.type} onChange={(e) => set({ type: e.target.value as SessionType })}>{TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}</Select></Field>
            <Field label="Day"><Select value={form.date} onChange={(e) => set({ date: e.target.value })}>{dates.map((d) => <option key={d} value={d}>{formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</Select></Field>
            <Field label="Track" hint={tracks.length === 0 ? 'Optional — a way to group sessions by theme (a strand, a division). Add tracks under Details.' : undefined}>
              {tracks.length === 0
                ? <div className="input bg-sand-50 text-ink-500 text-sm">None on this event</div>
                : <Select value={form.trackId ?? ''} onChange={(e) => set({ trackId: e.target.value || undefined })}><option value="">No track</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
            </Field>
            <Field label="Starts"><TimeInput value={form.start} onChange={(v) => set({ start: v })} /></Field>
            <Field label="Ends"><TimeInput value={form.end} onChange={(v) => set({ end: v })} /></Field>
            <Field label="Room"><RoomPicker rooms={rooms} facilities={facilities.items} value={form.roomId} onChoose={(c) => void chooseRoom(c)} /></Field>
          </div>
          <div className="grid sm:grid-cols-[8rem_minmax(0,1fr)] gap-3">
            <Field label="Seats" hint="0 = open seating"><Input type="number" min={0} value={form.capacity} onChange={(e) => set({ capacity: Math.max(0, Number(e.target.value) || 0) })} /></Field>
            <Field label="Speakers" hint="Name (Title, Org); Name (Title, Org)"><Input value={speakers} onChange={(e) => setSpeakers(e.target.value)} placeholder="Jane Kim (Head of School, Chadwick International)" /></Field>
          </div>
          <Field label="Run by" hint="Whoever runs the session sees who is in the room while it is on, from their own badge page, and can open its door screen — they need not be staff.">
            {(form.hostIds ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.hostIds ?? []).map((id) => { const u = users.items.find((x) => x.id === id); return (
                  <span key={id} className="chip bg-blue-50 text-blue-800 border border-blue-100">{u?.name ?? id}<button type="button" onClick={() => set({ hostIds: (form.hostIds ?? []).filter((h) => h !== id) })} className="ml-1 hover:text-rose-700" aria-label={`Remove ${u?.name ?? id}`}><X className="w-3 h-3" /></button></span>
                ); })}
              </div>
            )}
            <Select value="" onChange={(e) => { if (e.target.value) set({ hostIds: [...(form.hostIds ?? []), e.target.value] }); }}>
              <option value="">Add a person…</option>
              {people.filter((u) => !(form.hostIds ?? []).includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}{u.org ? ` · ${u.org}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Abstract"><Textarea value={form.abstract} onChange={(e) => set({ abstract: e.target.value })} className="min-h-28" /></Field>
          <Field label="Materials" hint="One per line: Label | https://…"><Textarea value={materials} onChange={(e) => setMaterials(e.target.value)} className="min-h-16" placeholder="Slides | https://docs.google.com/…" /></Field>
          {sponsors.length > 0 && (
            <Field label="Session partner" hint="A sponsor credited on this session."><Select value={form.sponsorId ?? ''} onChange={(e) => set({ sponsorId: e.target.value || undefined })}><option value="">None</option>{sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={Boolean(form.featured)} onChange={(e) => set({ featured: e.target.checked || undefined })} />Featured — shown with a star</label>
          {clash.length > 0 && (
            <Notice tone="warn">
              <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div>Overlaps in the same room with {clash.map((c) => `"${c.title}"`).join(', ')}.<label className="flex items-center gap-2 mt-1.5 text-xs"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />Save anyway</label></div></div>
            </Notice>
          )}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-sand-200">
            {!isNew ? (confirmDelete ? <div className="flex items-center gap-2 text-sm"><span>Delete this session?</span><Button size="sm" variant="danger" onClick={() => void remove()} busy={busy}>Delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button></div>
              : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" />Delete</Button>) : <span />}
            <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} busy={busy}>{isNew ? 'Add session' : 'Save'}</Button></div>
          </div>
        </div>
      </Drawer>
    );
  };

// ================================================================== access
/**
 * The event code an organiser hands out. Whoever enters it on CI Connects
 * is put on the list — no address to type in here first. A new code
 * retires the old one; people already on the list stay.
 */
const EventCodeCard: React.FC<{ event: Event; adminId: string }> = ({ event, adminId }) => {
  const { doc: code, ready } = useDoc('codes', event.id);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(null), 2000); return () => window.clearTimeout(t); }, [copied]);
  const make = async () => { setBusy(true); await store.set('codes', event.id, { id: event.id, eventId: event.id, code: randomCode(6), updatedAt: nowIso(), by: adminId }); setBusy(false); };
  const link = code ? `${window.location.origin}/join/${event.id}?c=${code.code}` : '';
  const message = code ? `You are on the list for ${event.name} (${formatRange(event.startDate, event.endDate)}) on CI Connects.\n\nOpen ${link} and sign in — that is all.\n\nOr go to ${window.location.origin}, sign in, choose "${event.name}" and enter the code ${code.code}.` : '';
  const copy = async (what: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); } catch { /* clipboard not allowed here */ } };
  return (
    <Card className="p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Event code</div>
          <p className="text-sm text-ink-500 max-w-xl">Hand this to the people you want on the list — in an email, on a slide, at the door. They sign in, enter it, and they are in. A new code retires the old one; people already on the list stay.</p>
        </div>
        {ready && !code && <Button onClick={() => void make()} busy={busy}><KeyRound className="w-4 h-4" />Make a code</Button>}
      </div>
      {code && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="font-mono text-3xl font-bold tracking-[0.25em] text-ink-900 bg-sand-50 border border-sand-200 rounded-xl px-4 py-2">{code.code}</div>
            <Button variant="secondary" size="sm" onClick={() => void copy('code', code.code)}><Copy className="w-3.5 h-3.5" />{copied === 'code' ? 'Copied' : 'Copy code'}</Button>
            <Button variant="secondary" size="sm" onClick={() => void copy('message', message)}><ClipboardCopy className="w-3.5 h-3.5" />{copied === 'message' ? 'Copied' : 'Copy invitation'}</Button>
            <a href={`mailto:?subject=${encodeURIComponent(`${event.name} — your place on CI Connects`)}&body=${encodeURIComponent(message)}`} className="btn-secondary btn-sm"><Mail className="w-3.5 h-3.5" />Email it</a>
            <Button variant="ghost" size="sm" onClick={() => void make()} busy={busy}><RefreshCw className="w-3.5 h-3.5" />New code</Button>
          </div>
          <p className="text-xs text-ink-500 mt-3">Invitation link: <span className="font-mono break-all">{link}</span> — it signs the person in and joins them in one go.</p>
        </>
      )}
    </Card>
  );
};

export const AdminAccess: React.FC = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const users = useWatch('users', []);
  const invites = useWatch('invites', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const [q, setQ] = useState('');
  const handed = (useLocation().state as { emails?: string } | null)?.emails ?? '';
  const [emails, setEmails] = useState(handed);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!ready || !users.ready) return <Spinner />;
  if (!event || !id) return <Empty icon={KeyRound} title="No such event" action={<Button to="/admin/events">Events</Button>} />;

  const listed = users.items.filter((u) => u.eventAccess.includes(id)).sort((a, b) => a.name.localeCompare(b.name));
  const staff = users.items.filter((u) => u.role !== 'user');
  const candidates = users.items.filter((u) => u.role === 'user' && !u.eventAccess.includes(id) && q && `${u.name} ${u.email} ${u.org ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const byEmail = new Map(users.items.map((u) => [u.email.toLowerCase(), u]));

  const toggle = async (u: Profile, on: boolean) => {
    setBusy(u.id);
    const access = new Set(u.eventAccess); if (on) access.add(id); else access.delete(id);
    await store.update('users', u.id, { eventAccess: [...access] });
    setBusy(null);
  };
  const invite = async () => {
    const list = [...new Set(emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
    if (list.length === 0 || !profile) return;
    setBusy('invite'); let added = 0, moved = 0;
    for (const email of list) {
      const existing = byEmail.get(email);
      if (existing) {
        if (existing.role === 'user' && !existing.eventAccess.includes(id)) { await store.update('users', existing.id, { eventAccess: [...existing.eventAccess, id] }); moved++; }
        continue;
      }
      const inv: Invite = { id: await inviteId(id, email), email, eventId: id, invitedBy: profile.id, createdAt: nowIso() };
      await store.set('invites', inv.id, inv); added++;
    }
    setBusy(null); setEmails('');
    setNote(`${added} invited by email${moved ? `, ${moved} already had an account and were put on the list` : ''}.`);
  };

  return (
    <div>
      <EventHeader event={event} title="Access" description="Who may see inside this event. Administrators and schedule admins always can." />
      <EventCodeCard event={event} adminId={profile?.id ?? ''} />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3"><span className="font-semibold text-ink-900">On the list</span><Chip tone="green">{listed.length}</Chip></div>
            {listed.length === 0 && <p className="text-sm text-ink-500">Nobody yet. Search below, or invite by email.</p>}
            <ul className="divide-y divide-sand-200">
              {listed.map((u) => (
                <li key={u.id} className="py-2.5 flex items-center gap-3">
                  <Avatar name={u.name} photoUrl={u.photoUrl} size={30} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink-900 truncate">{u.name}</div><div className="text-xs text-ink-500 truncate">{u.email}{u.org ? ` · ${u.org}` : ''}</div></div>
                  <Button size="sm" variant="ghost" onClick={() => void toggle(u, false)} busy={busy === u.id}>Remove</Button>
                </li>
              ))}
            </ul>
            {staff.length > 0 && <p className="text-xs text-ink-500 mt-3 pt-3 border-t border-sand-200">Plus {staff.length} with a role, who see every event: {staff.map((s) => s.name).join(', ')}.</p>}
          </Card>
          <Card className="p-5">
            <div className="font-semibold text-ink-900 mb-2 inline-flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-400" />Add someone who has signed in</div>
            <div className="relative"><Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or school" className="pl-9" /></div>
            {q && candidates.length === 0 && <p className="text-xs text-ink-500 mt-2">No match — invite the address instead.</p>}
            <ul className="mt-2 divide-y divide-sand-200">
              {candidates.map((u) => (
                <li key={u.id} className="py-2 flex items-center gap-3">
                  <Avatar name={u.name} photoUrl={u.photoUrl} size={28} />
                  <div className="min-w-0 flex-1"><div className="text-sm text-ink-900 truncate">{u.name}</div><div className="text-xs text-ink-500 truncate">{u.email}</div></div>
                  <Button size="sm" variant="secondary" onClick={() => void toggle(u, true)} busy={busy === u.id}>Add</Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="font-semibold text-ink-900 mb-1 inline-flex items-center gap-2"><Mail className="w-4 h-4 text-blue-400" />Invite by email</div>
            <p className="text-xs text-ink-500 mb-3">One or many, separated by commas or lines. The event opens to that address the moment it signs in with Google — no code to type.</p>
            <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="jane@school.org, minho@school.org" className="min-h-24 font-mono text-xs" />
            <div className="flex items-center justify-between mt-2">
              {note ? <span className="text-xs text-emerald-800">{note}</span> : <span />}
              <Button size="sm" onClick={() => void invite()} busy={busy === 'invite'} disabled={!emails.trim()}>Invite</Button>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3"><span className="font-semibold text-ink-900">Invited, not signed in yet</span><Chip>{invites.items.length}</Chip></div>
            {invites.items.length === 0 && <p className="text-sm text-ink-500">Invitations you send appear here until that address signs in.</p>}
            <ul className="divide-y divide-sand-200">
              {[...invites.items].sort((a, b) => a.email.localeCompare(b.email)).map((i) => {
                const u = byEmail.get(i.email);
                return (
                  <li key={i.id} className="py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1"><div className="text-sm text-ink-900 truncate font-mono">{i.email}</div><div className="text-xs text-ink-500">{u ? `Signed in as ${u.name}` : `Invited ${formatStamp(i.createdAt, false)}`}</div></div>
                    {u && u.role === 'user' && !u.eventAccess.includes(id) && <Button size="sm" variant="secondary" onClick={() => void toggle(u, true)}>Put on list</Button>}
                    <Button size="sm" variant="ghost" onClick={() => void store.remove('invites', i.id)} title="Withdraw"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ================================================================== check-in
export const AdminCheckIn: React.FC = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const users = useWatch('users', []);
  const invites = useWatch('invites', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const attendance = useWatch('attendance', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const data = useEventData(id ?? null);
  const [q, setQ] = useState('');
  const [scan, setScan] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'again' | 'unknown'; name: string; at?: string } | null>(null);
  const invitedEmails = useMemo(() => new Set(invites.items.map((i) => i.email)), [invites.items]);
  const people = useMemo(() => (id ? users.items.filter((u) => u.role !== 'user' || u.eventAccess.includes(id) || invitedEmails.has(u.email.toLowerCase())) : []).sort((a, b) => a.name.localeCompare(b.name)), [users.items, invitedEmails, id]);
  const target = sessionId || null;
  const recordFor = useCallback((uid: string) => attendance.items.find((a) => a.userId === uid && a.sessionId === target), [attendance.items, target]);

  const checkIn = useCallback(async (u: Profile) => {
    if (!profile || !id) return;
    const existing = recordFor(u.id);
    if (existing) { setResult({ tone: 'again', name: u.name, at: existing.at }); return; }
    const rec: Attendance = { id: `${id}__${target ?? 'venue'}__${u.id}`, eventId: id, sessionId: target, userId: u.id, at: nowIso(), by: profile.id, name: u.name, org: u.org };
    await store.set('attendance', rec.id, rec);
    setResult({ tone: 'ok', name: u.name, at: rec.at });
  }, [profile, id, target, recordFor]);

  /** A badge code, from the camera or a keyboard scanner. */
  const handleCode = useCallback(async (text: string) => {
    const uid = badgeUid(text) ?? text.trim();
    const u = people.find((p) => p.id === uid);
    if (!u) { setResult({ tone: 'unknown', name: text.trim().slice(0, 40) }); return; }
    await checkIn(u);
  }, [people, checkIn]);

  useEffect(() => { if (!result) return; const t = window.setTimeout(() => setResult(null), 3500); return () => window.clearTimeout(t); }, [result]);

  if (!ready || !users.ready || !data.ready) return <Spinner />;
  if (!event || !id) return <Empty icon={ClipboardCheck} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  const rows = people.filter((u) => !q || `${u.name} ${u.email} ${u.org ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const checkedCount = people.filter((u) => recordFor(u.id)).length;
  const undo = async (u: Profile) => { const r = recordFor(u.id); if (r) await store.remove('attendance', r.id); };
  const onScan = async () => { const t = scan; setScan(''); if (t.trim()) await handleCode(t); };

  return (
    <div>
      <EventHeader event={event} title="Check-in" description={`${checkedCount} of ${people.length} ${target ? 'in this session' : 'arrived'}`}
        actions={<>
          <Button variant={camera ? 'primary' : 'secondary'} onClick={() => setCamera((v) => !v)}><Camera className="w-4 h-4" />{camera ? 'Stop camera' : 'Scan badges'}</Button>
          <Button variant="secondary" to={`/admin/events/${id}/live`}><Radio className="w-4 h-4" />Live</Button>
          {target && <a href={`/door/${id}/${target}`} target="_blank" rel="noreferrer" className="btn-secondary"><MonitorPlay className="w-4 h-4" />Door screen</a>}
        </>} />
      <div className="grid sm:grid-cols-[minmax(0,1fr)_18rem] gap-3 mb-4">
        <div className="relative"><Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" className="pl-9" /></div>
        <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Arrival at the venue</option>
          {[...data.sessions].sort(byStart).filter((s) => s.type !== 'break' && s.type !== 'social').map((s) => <option key={s.id} value={s.id}>{formatTime(s.start)} · {s.title}</option>)}
        </Select>
      </div>

      {camera && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 mb-4 items-start">
          <Scanner onCode={handleCode} />
          <Card className="p-5 min-h-40 flex flex-col justify-center text-center">
            {result ? (
              <>
                {result.tone === 'ok' && <CircleCheck className="w-10 h-10 text-emerald-600 mx-auto" />}
                {result.tone === 'again' && <Check className="w-10 h-10 text-blue-400 mx-auto" />}
                {result.tone === 'unknown' && <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />}
                <div className="text-lg font-bold text-ink-900 mt-2">{result.tone === 'unknown' ? 'Not on this event' : result.name}</div>
                <div className="text-sm text-ink-500">{result.tone === 'ok' ? `Checked in ${target ? 'to this session' : 'at the venue'}` : result.tone === 'again' ? `Already in${result.at ? `, ${formatClock(result.at)}` : ''}` : result.name}</div>
              </>
            ) : (
              <><QrCode className="w-8 h-8 text-ink-300 mx-auto" /><div className="text-sm text-ink-500 mt-2">Hold a badge up to the camera. {target ? 'Recording for the selected session.' : 'Recording arrival at the venue.'}</div></>
            )}
          </Card>
        </div>
      )}

      <Card className="p-3 mb-4 flex items-center gap-2">
        <ScanLine className="w-4 h-4 text-blue-400 shrink-0" />
        <Input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void onScan(); }} placeholder="Or scan with a handheld scanner here (it types the code and presses Enter)" className="py-1.5 text-xs font-mono" />
        <Button size="sm" variant="secondary" onClick={() => void onScan()} disabled={!scan.trim()}>Check in</Button>
        {result && !camera && <Chip tone={result.tone === 'unknown' ? 'amber' : 'green'} className="shrink-0"><CircleCheck className="w-3 h-3" />{result.tone === 'unknown' ? 'Not on this event' : result.name}</Chip>}
      </Card>
      <Card className="divide-y divide-sand-200">
        {rows.length === 0 && <div className="p-6 text-sm text-ink-500 text-center">Nobody matches.</div>}
        {rows.map((u) => {
          const r = recordFor(u.id);
          return (
            <div key={u.id} className="p-3 flex items-center gap-3">
              <Avatar name={u.name} photoUrl={u.photoUrl} size={32} />
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink-900 truncate">{u.name}</div><div className="text-xs text-ink-500 truncate">{[u.org, u.title].filter(Boolean).join(' · ') || u.email}</div></div>
              {r ? (
                <><Chip tone="green"><CircleCheck className="w-3 h-3" />{formatClock(r.at)}</Chip><Button size="sm" variant="ghost" onClick={() => void undo(u)} title="Undo"><Undo2 className="w-3.5 h-3.5" /></Button></>
              ) : <Button size="sm" onClick={() => void checkIn(u)}>Check in</Button>}
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ================================================================== sponsors
const blankSponsor = (eventId: string, n: number): Sponsor => ({ id: newId('spn'), eventId, name: '', tier: 'exhibitor', order: n + 1 });

export const AdminSponsors: React.FC = () => {
  const { id } = useParams();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const sponsors = useWatch('sponsors', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!ready || !sponsors.ready) return <Spinner />;
  if (!event || !id) return <Empty icon={Handshake} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  const rows = [...sponsors.items].sort((a, b) => SPONSOR_TIERS.indexOf(a.tier) - SPONSOR_TIERS.indexOf(b.tier) || a.order - b.order);
  const isNew = editing ? !sponsors.items.some((x) => x.id === editing.id) : false;
  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    await store.set('sponsors', editing.id, { ...editing, name: editing.name.trim(), logoUrl: editing.logoUrl?.trim() || undefined, url: editing.url?.trim() || undefined, blurb: editing.blurb?.trim() || undefined });
    setBusy(false); setEditing(null);
  };
  const remove = async () => { if (!editing) return; setBusy(true); await store.remove('sponsors', editing.id); setBusy(false); setEditing(null); setConfirmDelete(false); };
  return (
    <div>
      <EventHeader event={event} title="Sponsors" description="Shown on the public page, in the portal's Sponsors tab, and on any session they partner."
        actions={<Button onClick={() => setEditing(blankSponsor(id, sponsors.items.length))}><Plus className="w-4 h-4" />Add sponsor</Button>} />
      {rows.length === 0 ? <Empty icon={Handshake} title="No sponsors yet" body="Add one with its logo, tier and website." action={<Button onClick={() => setEditing(blankSponsor(id, 0))}><Plus className="w-4 h-4" />Add sponsor</Button>} /> : (
        <Card className="divide-y divide-sand-200">
          {rows.map((sp) => (
            <button key={sp.id} onClick={() => { setEditing(sp); setConfirmDelete(false); }} className="w-full text-left p-3.5 flex items-center gap-4 hover:bg-sand-50 transition-colors">
              <div className="w-20 h-12 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center overflow-hidden shrink-0">
                {sp.logoUrl ? <img src={sp.logoUrl} alt="" className="max-h-[70%] max-w-[80%] object-contain" /> : <Handshake className="w-4 h-4 text-ink-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold text-ink-900">{sp.name}</span><Chip tone={sp.tier === 'platinum' ? 'navy' : sp.tier === 'gold' ? 'amber' : 'neutral'}>{SPONSOR_TIER_LABEL[sp.tier]}</Chip></div>
                <div className="text-xs text-ink-500 truncate">{[sp.url, sp.blurb].filter(Boolean).join(' · ') || 'No website or blurb yet'}</div>
              </div>
              <Pencil className="w-4 h-4 text-ink-300 shrink-0" />
            </button>
          ))}
        </Card>
      )}
      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={isNew ? 'Add sponsor' : 'Edit sponsor'}>
        {editing && (
          <div className="space-y-4">
            <Field label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></Field>
            <Field label="Tier"><Select value={editing.tier} onChange={(e) => setEditing({ ...editing, tier: e.target.value as SponsorTier })}>{SPONSOR_TIERS.map((t) => <option key={t} value={t}>{SPONSOR_TIER_LABEL[t]}</option>)}</Select></Field>
            <Field label="Logo"><ImagePicker value={editing.logoUrl} onChange={(url) => setEditing({ ...editing, logoUrl: url })} folder={`v2/logos/${editing.eventId}`} shape="logo" removable /></Field>
            <Field label="Website"><Input value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://" /></Field>
            <Field label="One line about them"><Textarea value={editing.blurb ?? ''} onChange={(e) => setEditing({ ...editing, blurb: e.target.value })} className="min-h-20" /></Field>
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-sand-200">
              {!isNew ? (confirmDelete ? <div className="flex items-center gap-2 text-sm"><span>Remove this sponsor?</span><Button size="sm" variant="danger" onClick={() => void remove()} busy={busy}>Remove</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button></div>
                : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" />Remove</Button>) : <span />}
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void save()} busy={busy} disabled={!editing.name.trim()}>{isNew ? 'Add' : 'Save'}</Button></div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

// ================================================================== live
/**
 * Who is in which room, as it happens — the organiser's view of the day.
 * Each session's count updates the moment a badge is scanned or a phone
 * confirms at a door; the door screens themselves open in their own tab,
 * one per session or one per room that follows the programme.
 */
export const AdminLive: React.FC = () => {
  const { id } = useParams();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const data = useEventData(id ?? null);
  const attendance = useWatch('attendance', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const users = useWatch('users', []);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(t); }, []);
  if (!ready || !data.ready) return <Spinner />;
  if (!event || !id) return <Empty icon={Radio} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  const byUser = new Map(users.items.map((u) => [u.id, u]));
  const nameOf = (a: Attendance) => byUser.get(a.userId)?.name ?? a.name ?? 'Someone';
  const venue = attendance.items.filter((a) => a.sessionId === null);
  const forSession = (sid: string) => attendance.items.filter((a) => a.sessionId === sid).sort((a, b) => b.at.localeCompare(a.at));
  const today = todayYmd(); const mins = now.getHours() * 60 + now.getMinutes();
  const isNow = (s: Session) => s.date === today && toMinutes(s.start) - 15 <= mins && mins <= toMinutes(s.end);
  const sessions = [...data.sessions].sort(byStart);
  const running = sessions.filter(isNow);
  const inRoomsNow = new Set(running.flatMap((s) => forSession(s.id).map((a) => a.userId))).size;
  const distinct = new Set(attendance.items.map((a) => a.userId)).size;
  let lastDate = '';
  return (
    <div>
      <EventHeader event={event} title="Live attendance" description="Who is in which room, as it happens. A door screen on the room's projector shows the code, greets each arrival by name and counts the room."
        actions={<Button variant="secondary" to={`/admin/events/${id}/checkin`}><ClipboardCheck className="w-4 h-4" />Check-in desk</Button>} />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[[venue.length, 'arrived at the venue'], [inRoomsNow, `in ${running.length} session${running.length === 1 ? '' : 's'} right now`], [distinct, 'people seen today']].map(([v, l]) => (
          <Card key={String(l)} className="p-4"><div className="font-display font-bold text-3xl tabular-nums text-ink-900">{v}</div><div className="text-xs text-ink-500 mt-1">{l}</div></Card>
        ))}
      </div>
      {data.rooms.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div><div className="font-semibold text-ink-900 text-sm inline-flex items-center gap-1.5"><DoorOpen className="w-4 h-4 text-blue-400" />Room screens</div><div className="text-xs text-ink-500">Open one on each room's projector and leave it: it follows that room's programme through the day.</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.rooms.map((r) => <a key={r.id} href={`/door/${id}/room/${r.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><MonitorPlay className="w-3.5 h-3.5" />{roomLabel(r)}</a>)}
          </div>
        </Card>
      )}
      <Card className="divide-y divide-sand-200">
        {sessions.length === 0 && <div className="p-6 text-sm text-ink-500 text-center">No sessions on the programme yet.</div>}
        {sessions.map((s) => {
          const list = forSession(s.id); const room = data.rooms.find((r) => r.id === s.roomId); const on = isNow(s);
          const header = s.date !== lastDate ? (lastDate = s.date, <div className="px-3 py-1.5 bg-sand-50 text-[11px] uppercase tracking-wider text-ink-500">{formatDate(s.date)}</div>) : null;
          return (
            <React.Fragment key={s.id}>
              {header}
              <div className={`p-3 flex items-center gap-3 ${on ? 'bg-blue-50/70' : ''}`}>
                <div className="w-[4.5rem] shrink-0 text-xs text-ink-500 tabular-nums leading-snug">{formatTime(s.start)}<br />{formatTime(s.end)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold text-ink-900">{s.title}</span>{on && <Chip tone="green">Now</Chip>}</div>
                  <div className="text-xs text-ink-500">{room ? roomLabel(room) : '—'}{s.speakers.length ? ` · ${s.speakers.map((p) => p.name).join(', ')}` : ''}</div>
                  {list.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {list.slice(0, 10).map((a) => <span key={a.id} className="text-[11px] rounded-full bg-sand-100 border border-sand-200 px-2 py-0.5 text-ink-700">{nameOf(a)}</span>)}
                      {list.length > 10 && <span className="text-[11px] text-ink-500 px-1">+{list.length - 10} more</span>}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-bold text-2xl tabular-nums text-ink-900">{list.length}</div>
                  <div className="text-[11px] text-ink-500">{s.capacity ? `of ${s.capacity}` : 'in'}{list[0] ? ` · last ${formatClock(list[0].at)}` : ''}</div>
                </div>
                <a href={`/door/${id}/${s.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm shrink-0"><MonitorPlay className="w-3.5 h-3.5" />Door screen</a>
              </div>
            </React.Fragment>
          );
        })}
      </Card>
    </div>
  );
};

// ================================================================== badges
/**
 * Every badge for this event, for the people who print and hand them out:
 * staff, everyone on the list, everyone invited who has signed in. Pick the
 * size the holders take, one per page or A4 sheets, and print — fronts and
 * backs arranged for a duplex printer.
 */
export const AdminBadges: React.FC = () => {
  const { id } = useParams();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const users = useWatch('users', []);
  const invites = useWatch('invites', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const data = useEventData(id ?? null);
  const [q, setQ] = useState('');
  const [format, setFormat] = useState<BadgeFormat>(() => rememberedFormat());
  const [layout, setLayout] = useState<PrintLayout>('one');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState<BadgeData[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const invited = useMemo(() => new Set(invites.items.map((i) => i.email)), [invites.items]);
  const people = useMemo(() => (id ? users.items.filter((u) => u.role !== 'user' || u.eventAccess.includes(id) || invited.has(u.email.toLowerCase())) : []).sort((a, b) => a.name.localeCompare(b.name)), [users.items, invited, id]);
  if (!ready || !users.ready || !data.ready) return <Spinner />;
  if (!event || !id) return <Empty icon={IdCardLanyard} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  const speakerNames = new Set(data.sessions.flatMap((s) => s.speakers.map((p) => p.name.trim().toLowerCase())));
  const badge = (u: Profile): BadgeData => ({ event, profile: u, sponsors: data.sponsors, speaker: speakerNames.has(u.name.trim().toLowerCase()) });
  const rows = people.filter((u) => !q || `${u.name} ${u.email} ${u.org ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const chosen = people.filter((u) => !excluded.has(u.id));
  const { cols, rows: sheetRows } = sheetGrid(format);
  const pick = (f: BadgeFormat) => { setFormat(f); rememberFormat(f.id); };
  const previewUser = people.find((u) => u.id === preview) ?? chosen[0] ?? people[0];
  return (
    <div>
      <EventHeader event={event} title="Badges" description={`${people.length} people: staff, everyone on the list, and invited people who have signed in. Fronts and backs come out ready for a duplex printer.`}
        actions={<Button onClick={() => setPrinting(chosen.map(badge))} disabled={chosen.length === 0}><Printer className="w-4 h-4" />Print {chosen.length} badge{chosen.length === 1 ? '' : 's'}</Button>} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start">
        <div className="space-y-4">
          <Card className="p-4 grid sm:grid-cols-2 gap-4">
            <Field label="Size" hint={format.note}>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {BADGE_FORMATS.map((f) => <button key={f.id} type="button" onClick={() => pick(f)} className={`chip border transition-colors ${f.id === format.id ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-ink-700 border-sand-200 hover:border-blue-300'}`}>{f.label}</button>)}
              </div>
            </Field>
            <Field label="Paper" hint={layout === 'one' ? 'One badge per page, centred — card stock cut to size, or a card printer.' : `${cols * sheetRows} per A4 sheet (${cols} × ${sheetRows}); backs on the following sheet, mirrored to line up when flipped on the long edge.`}>
              <Select value={layout} onChange={(e) => setLayout(e.target.value as PrintLayout)}>
                <option value="one">One per page</option>
                <option value="a4">A4 sheets, {cols * sheetRows} per sheet</option>
              </Select>
            </Field>
          </Card>
          <div className="relative"><Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" className="pl-9" /></div>
          <Card className="divide-y divide-sand-200">
            <div className="p-3 flex items-center justify-between text-xs text-ink-500">
              <span>{chosen.length} of {people.length} selected</span>
              <span className="flex gap-3"><button type="button" onClick={() => setExcluded(new Set())} className="font-semibold hover:text-ink-900">All</button><button type="button" onClick={() => setExcluded(new Set(people.map((u) => u.id)))} className="font-semibold hover:text-ink-900">None</button></span>
            </div>
            {rows.length === 0 && <div className="p-6 text-sm text-ink-500 text-center">Nobody matches.</div>}
            {rows.map((u) => (
              <label key={u.id} className={`p-3 flex items-center gap-3 cursor-pointer ${preview === u.id ? 'bg-blue-50/60' : ''}`} onClick={() => setPreview(u.id)}>
                <input type="checkbox" checked={!excluded.has(u.id)} onChange={(e) => setExcluded((x) => { const n = new Set(x); if (e.target.checked) n.delete(u.id); else n.add(u.id); return n; })} onClick={(e) => e.stopPropagation()} />
                <Avatar name={u.name} photoUrl={u.photoUrl} size={32} />
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink-900 truncate">{u.name}</div><div className="text-xs text-ink-500 truncate">{[u.org, u.title].filter(Boolean).join(' · ') || u.email}</div></div>
                {u.role !== 'user' && <Chip tone="blue">{ROLE_LABEL[u.role]}</Chip>}
                <Button size="sm" variant="ghost" onClick={() => setPrinting([badge(u)])} title="Print this badge"><Printer className="w-3.5 h-3.5" /></Button>
              </label>
            ))}
          </Card>
        </div>
        {previewUser && (
          <div className="mx-auto lg:mx-0 lg:sticky lg:top-6">
            <div className="eyebrow mb-2 text-center">{previewUser.name}</div>
            <BadgeCard event={event} profile={previewUser} sponsors={data.sponsors} speaker={speakerNames.has(previewUser.name.trim().toLowerCase())} format={format} />
            <p className="text-[11px] text-ink-500 text-center mt-2 max-w-[280px]">Shown at the printed size. {data.sponsors.length > 0 ? 'Sponsors on the back.' : 'No sponsors yet — the back carries the event and the mission.'}</p>
          </div>
        )}
      </div>
      {printing && <BadgePrintSheet badges={printing} format={format} layout={layout} onDone={() => setPrinting(null)} />}
    </div>
  );
};
