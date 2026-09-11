import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft, Plus, Trash2, Upload, AlertTriangle, Check, DoorOpen, Tag, Search, UserPlus, Mail, ScanLine, CircleCheck, Undo2, KeyRound, ClipboardCheck, ListTree, Camera, QrCode, Handshake, Pencil,
} from 'lucide-react';
import { Event, Session, Room, Track, SessionType, SESSION_TYPE_LABEL, Invite, Profile, Attendance, Sponsor, SponsorTier, SPONSOR_TIERS, SPONSOR_TIER_LABEL } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isAdmin } from '../lib/roles';
import { formatRange, formatDate, formatTime, eachDate, nowIso, newId, formatStamp, formatClock } from '../lib/time';
import { byStart, overlaps } from '../lib/schedule';
import { parseCsv, rowsToSessions, parseSpeakers, CSV_TEMPLATE, ImportRow } from '../lib/csv';
import { inviteId } from '../lib/hash';
import { useEventData, TrackDot } from '../components/schedule';
import { Scanner } from '../components/Scanner';
import { Button, Card, Chip, Drawer, Empty, Field, Input, Notice, Select, Spinner, Textarea, PageHeader, Avatar, SubNav, TimeInput } from '../components/ui';
import { ImagePicker } from '../components/ImagePicker';

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
                          <div className="text-xs text-ink-500 mt-1">{[room?.name ?? 'No room', s.speakers.map((x) => x.name).join(', ') || null, s.capacity ? `${s.reservedUserIds.length}/${s.capacity} seats${s.waitlistUserIds.length ? ` · ${s.waitlistUserIds.length} waiting` : ''}` : 'open seating'].filter(Boolean).join(' · ')}</div>
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
      <ImportDrawer event={event} open={importing} rooms={data.rooms} tracks={data.tracks} onClose={() => setImporting(false)} />
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
              <div className="min-w-0"><div className="text-ink-900 truncate">{r.name}</div><div className="text-[11px] text-ink-500">{[r.capacity ? `${r.capacity} seats` : 'open', r.location].filter(Boolean).join(' · ')}</div></div>
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
        await store.set('sessions', form.id, { ...form, title: form.title.trim(), speakers: parseSpeakers(speakers), materials: mats.length ? mats : undefined, trackId: form.trackId || undefined, sponsorId: form.sponsorId || undefined });
        onClose();
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const remove = async () => { setBusy(true); await store.remove('sessions', form.id); setBusy(false); onClose(); };
    return (
      <Drawer open onClose={onClose} title={isNew ? 'New session' : 'Edit session'} wide>
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Title"><Input value={form.title} onChange={(e) => set({ title: e.target.value })} autoFocus /></Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Type"><Select value={form.type} onChange={(e) => set({ type: e.target.value as SessionType })}>{TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}</Select></Field>
            <Field label="Day"><Select value={form.date} onChange={(e) => set({ date: e.target.value })}>{dates.map((d) => <option key={d} value={d}>{formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</Select></Field>
            <Field label="Track"><Select value={form.trackId ?? ''} onChange={(e) => set({ trackId: e.target.value || undefined })}><option value="">None</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Starts"><TimeInput value={form.start} onChange={(v) => set({ start: v })} /></Field>
            <Field label="Ends"><TimeInput value={form.end} onChange={(v) => set({ end: v })} /></Field>
            <Field label="Room"><Select value={form.roomId} onChange={(e) => { const r = rooms.find((x) => x.id === e.target.value); set({ roomId: e.target.value, ...(r && form.capacity === 0 && r.capacity ? { capacity: r.capacity } : {}) }); }}>{rooms.length === 0 && <option value="">Add a room first</option>}{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          </div>
          <div className="grid sm:grid-cols-[8rem_minmax(0,1fr)] gap-3">
            <Field label="Seats" hint="0 = open seating"><Input type="number" min={0} value={form.capacity} onChange={(e) => set({ capacity: Math.max(0, Number(e.target.value) || 0) })} /></Field>
            <Field label="Speakers" hint="Name (Title, Org); Name (Title, Org)"><Input value={speakers} onChange={(e) => setSpeakers(e.target.value)} placeholder="Jane Kim (Head of School, Chadwick International)" /></Field>
          </div>
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

const ImportDrawer: React.FC<{ event: Event; open: boolean; rooms: Room[]; tracks: Track[]; onClose: () => void }> = ({ event, open, rooms, tracks, onClose }) => {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => { if (!open) { setText(''); setRows([]); setDone(null); } }, [open]);
  const preview = () => setRows(rowsToSessions(parseCsv(text), event.startDate));
  const onFile = (f: File | undefined) => { if (!f) return; f.text().then((t) => { setText(t); setRows(rowsToSessions(parseCsv(t), event.startDate)); }); };
  const good = rows.filter((r) => r.problems.length === 0);
  const commit = async () => {
    setBusy(true);
    const roomByName = new Map(rooms.map((r) => [r.name.toLowerCase(), r]));
    const trackByName = new Map(tracks.map((t) => [t.name.toLowerCase(), t]));
    let order = rooms.length, torder = tracks.length;
    for (const r of good) {
      const s = r.session;
      let room = roomByName.get(s.room.toLowerCase());
      if (!room) { room = { id: newId('room'), eventId: event.id, name: s.room, capacity: s.capacity, order: ++order }; await store.set('rooms', room.id, room); roomByName.set(s.room.toLowerCase(), room); }
      let track: Track | undefined;
      if (s.track) {
        track = trackByName.get(s.track.toLowerCase());
        if (!track) { track = { id: newId('track'), eventId: event.id, name: s.track, color: COLORS[torder % COLORS.length], order: ++torder }; await store.set('tracks', track.id, track); trackByName.set(s.track.toLowerCase(), track); }
      }
      const session: Session = { id: newId('ses'), eventId: event.id, title: s.title, abstract: s.abstract, type: s.type, date: s.date, start: s.start, end: s.end, roomId: room.id, trackId: track?.id, speakers: s.speakers, capacity: s.capacity, reservedUserIds: [], waitlistUserIds: [] };
      await store.set('sessions', session.id, session);
    }
    setBusy(false); setDone(good.length);
  };
  return (
    <Drawer open={open} onClose={onClose} title="Import a spreadsheet" wide>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">Paste rows from a sheet, or upload a CSV. Columns by name, any order: <code className="font-mono text-xs">title, abstract, type, date, start, end, room, track, speakers, capacity</code>. Rooms and tracks that do not exist yet are created.</p>
        <div className="flex gap-2">
          <label className="btn-secondary btn-sm cursor-pointer"><Upload className="w-3.5 h-3.5" />Upload .csv<input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          <Button size="sm" variant="ghost" onClick={() => { setText(CSV_TEMPLATE); setRows(rowsToSessions(parseCsv(CSV_TEMPLATE), event.startDate)); }}>Use the template</Button>
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs min-h-40" placeholder="title,abstract,type,date,start,end,room,track,speakers,capacity" />
        <div className="flex items-center gap-2"><Button size="sm" variant="secondary" onClick={preview} disabled={!text.trim()}>Preview</Button>{rows.length > 0 && <span className="text-xs text-ink-500">{good.length} of {rows.length} rows ready</span>}</div>
        {rows.length > 0 && (
          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-ink-500 border-b border-sand-200"><tr><th className="p-2">Line</th><th className="p-2">Title</th><th className="p-2">When</th><th className="p-2">Room</th><th className="p-2">Status</th></tr></thead>
              <tbody className="divide-y divide-sand-200">
                {rows.map((r) => (
                  <tr key={r.line} className={r.problems.length ? 'bg-rose-50/60' : ''}>
                    <td className="p-2 tabular-nums text-ink-500">{r.line}</td>
                    <td className="p-2 font-semibold text-ink-900">{r.session.title || '—'}</td>
                    <td className="p-2 tabular-nums">{r.session.date} {r.session.start}–{r.session.end}</td>
                    <td className="p-2">{r.session.room || '—'}</td>
                    <td className="p-2">{r.problems.length ? <span className="text-rose-700">{r.problems.join(', ')}</span> : <span className="text-emerald-700 inline-flex items-center gap-1"><Check className="w-3 h-3" />ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {done !== null ? <Notice tone="success">{done} session{done === 1 ? '' : 's'} imported.</Notice>
          : <Button onClick={() => void commit()} disabled={good.length === 0} busy={busy}>Import {good.length || ''} ready row{good.length === 1 ? '' : 's'}</Button>}
      </div>
    </Drawer>
  );
};

// ================================================================== access
export const AdminAccess: React.FC = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const { doc: event, ready } = useDoc('events', id ?? null);
  const users = useWatch('users', []);
  const invites = useWatch('invites', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const [q, setQ] = useState('');
  const [emails, setEmails] = useState('');
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
    const rec: Attendance = { id: `${id}__${target ?? 'venue'}__${u.id}`, eventId: id, sessionId: target, userId: u.id, at: nowIso(), by: profile.id };
    await store.set('attendance', rec.id, rec);
    setResult({ tone: 'ok', name: u.name, at: rec.at });
  }, [profile, id, target, recordFor]);

  /** A badge code, from the camera or a keyboard scanner. */
  const handleCode = useCallback(async (text: string) => {
    const m = text.trim().match(/^ci2:(.+)$/);
    const uid = m ? m[1] : text.trim();
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
          {target && <Button variant="secondary" to={`/door/${id}/${target}`}><QrCode className="w-4 h-4" />Door QR</Button>}
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
const blankSponsor = (eventId: string, n: number): Sponsor => ({ id: newId('spn'), eventId, name: '', tier: 'partner', order: n + 1 });

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
