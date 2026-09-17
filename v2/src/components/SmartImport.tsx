import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload, Sparkles, Check, AlertTriangle, ArrowLeft, ArrowRight, CircleHelp, Users, FileSpreadsheet } from 'lucide-react';
import { Event, Facility, Room, Session, Track } from '../lib/types';
import { store } from '../lib/store';
import { useWatch } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';
import { parseCsv, CSV_TEMPLATE } from '../lib/csv';
import { readWorkbook, Sheet } from '../lib/xlsx';
import { Target, TARGETS, TARGET_LABEL, findHeaderRow, guessMapping, buildDrafts, looksLikePeople, DraftRow } from '../lib/smartImport';
import { roomLabel, facilityLabel, facilityWhere, searchFacilities, norm } from '../lib/rooms';
import { formatDate, eachDate, newId, formatTime } from '../lib/time';
import { structureWithAi } from '../lib/ai';
import { Button, Card, Chip, Drawer, Notice, Select, Textarea } from './ui';

const COLORS = ['#002B54', '#2A6791', '#56A0D3', '#5E6513', '#B04318', '#8B5E34', '#6B605A', '#7C3AED'];
type Stage = 'file' | 'columns' | 'review' | 'done';

/** Where a room named in the file goes: one of this event's rooms, a room
 *  from the campus directory, a new room as typed, or nowhere. */
function roomOptions(text: string, rooms: Room[], facilities: Facility[]) {
  const t = norm(text);
  const own = rooms.filter((r) => norm(roomLabel(r)).includes(t) || norm(r.name) === t || (r.number ? norm(r.number) === t : false));
  const exactOwn = rooms.find((r) => norm(roomLabel(r)) === t || norm(r.name) === t || (r.number ? norm(r.number) === t : false));
  const taken = new Set(rooms.map((r) => r.facilityId).filter(Boolean));
  const campus = searchFacilities(facilities, text, 5).filter((f) => !taken.has(f.id));
  const exactCampus = campus.find((f) => (f.number ? norm(f.number) === t : false))
    ?? ((campus.filter((f) => norm(f.name) === t).length === 1) ? campus.find((f) => norm(f.name) === t) : undefined);
  // One room of this event that the text is part of ("Cafeteria" → "B-001 · MS/US Cafeteria") is the likely answer, still asked.
  const choice = exactOwn ? `event:${exactOwn.id}` : exactCampus ? `fac:${exactCampus.id}` : own.length === 1 ? `event:${own[0].id}` : 'new';
  return { choice, sure: Boolean(exactOwn || exactCampus), own, campus };
}

/** One question on the review step: what is unclear on the left, the answer on the right. */
const Q: React.FC<{ title: string; children: React.ReactNode; note?: string }> = ({ title, note, children }) => (
  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <div className="flex gap-2 min-w-0 flex-1"><CircleHelp className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><div className="min-w-0"><div className="text-sm font-semibold text-ink-900">{title}</div>{note && <div className="text-xs text-ink-500 mt-0.5">{note}</div>}</div></div>
    <div className="sm:w-64 shrink-0">{children}</div>
  </div>
);

/**
 * Importing a programme from whatever the organiser has.
 *
 * Three steps, and nothing is written before the last button. The file is
 * read (Excel, CSV, a pasted table; loose text goes through the AI reader);
 * its columns are matched to ours, anything unmatched left out unless the
 * person says where it goes; then the questions that remain — an unknown
 * room, a new track, a day outside the event, a session already there — are
 * asked once each, with a sensible answer chosen. Rows that still cannot be
 * a session are listed and skipped, not forced in.
 */
export const SmartImport: React.FC<{ event: Event; open: boolean; rooms: Room[]; tracks: Track[]; sessions: Session[]; onClose: () => void }> = ({ event, open, rooms, tracks, sessions, onClose }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const facilities = useWatch('facilities', [], open);
  const [stage, setStage] = useState<Stage>('file');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; rooms: number; tracks: number; left: number } | null>(null);
  // answers
  const [roomChoice, setRoomChoice] = useState<Record<string, string>>({});
  const [trackChoice, setTrackChoice] = useState<Record<string, string>>({});
  const [outside, setOutside] = useState<'skip' | 'move' | 'keep'>('skip');
  const [undated, setUndated] = useState(event.startDate);
  const [dupes, setDupes] = useState<'update' | 'add' | 'skip'>('update');
  const [noRoom, setNoRoom] = useState<'tba' | 'skip'>('tba');

  useEffect(() => {
    if (open) return;
    setStage('file'); setSheets([]); setSheetIdx(0); setHeaderRow(0); setMapping([]); setPasted(''); setError(null); setResult(null);
    setRoomChoice({}); setTrackChoice({}); setOutside('skip'); setUndated(event.startDate); setDupes('update'); setNoRoom('tba');
  }, [open, event.startDate]);

  const rows = sheets[sheetIdx]?.rows ?? [];
  const take = (list: Sheet[]) => {
    const best = list.reduce((bi, s, i) => (s.rows.length > list[bi].rows.length ? i : bi), 0);
    const h = findHeaderRow(list[best].rows);
    setSheets(list); setSheetIdx(best); setHeaderRow(h); setMapping(guessMapping(list[best].rows[h] ?? [])); setStage('columns'); setError(null);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return; setError(null);
    try {
      const name = f.name.toLowerCase();
      if (/\.(xlsx|xlsm)$/.test(name)) { const list = readWorkbook(new Uint8Array(await f.arrayBuffer())); if (list.length === 0) throw new Error('That workbook has no cells with anything in them.'); take(list); }
      else if (/\.xls$/.test(name)) throw new Error('That is the old Excel format. Save it as .xlsx (or .csv) and bring it again.');
      else if (/\.(pdf|docx?|pages|key|pptx?)$/.test(name)) throw new Error('Open the document, copy the programme, and paste it below — then “Read it with AI”.');
      else { const r = parseCsv(await f.text()); if (r.length === 0) throw new Error('Nothing readable in that file.'); take([{ name: f.name, rows: r }]); }
    } catch (e) { setError((e as Error).message); }
  };
  const usePasted = () => { const r = parseCsv(pasted); if (r.length < 2 || Math.max(...r.map((x) => x.length)) < 2) { setError('That does not look like a table. Use “Read it with AI” for loose text.'); return; } take([{ name: 'Pasted', rows: r }]); };
  const readWithAi = async (text: string) => {
    setAiBusy(true); setError(null);
    try { const csv = await structureWithAi(text); take([{ name: 'Read by AI', rows: parseCsv(csv) }]); }
    catch (e) { setError((e as Error).message); }
    finally { setAiBusy(false); }
  };
  const pickSheet = (i: number) => { const h = findHeaderRow(sheets[i].rows); setSheetIdx(i); setHeaderRow(h); setMapping(guessMapping(sheets[i].rows[h] ?? [])); };
  const pickHeader = (h: number) => { setHeaderRow(h); setMapping(guessMapping(rows[h] ?? [])); };

  // ---------------------------------------------------------------- understanding
  const drafts = useMemo<DraftRow[]>(() => (stage === 'review' || stage === 'columns' ? buildDrafts(rows, headerRow, mapping, event) : []), [rows, headerRow, mapping, event, stage]);
  const days = useMemo(() => eachDate(event.startDate, event.endDate), [event.startDate, event.endDate]);
  const roomTexts = useMemo(() => [...new Set(drafts.map((d) => d.room).filter(Boolean))], [drafts]);
  const trackTexts = useMemo(() => [...new Set(drafts.map((d) => d.track).filter(Boolean))], [drafts]);
  const roomInfo = useMemo(() => Object.fromEntries(roomTexts.map((t) => [t, roomOptions(t, rooms, facilities.items)])), [roomTexts, rooms, facilities.items]);
  const trackOf = (t: string) => trackChoice[t] ?? (tracks.find((x) => x.name.toLowerCase() === t.toLowerCase())?.id ?? 'new');
  const roomOf = (t: string) => roomChoice[t] ?? roomInfo[t]?.choice ?? 'new';

  const plan = useMemo(() => drafts.map((d) => {
    const why: string[] = [...d.problems];
    let date = d.date;
    if (!date && days.length > 1) date = undated;
    if (date && (date < event.startDate || date > event.endDate)) {
      if (outside === 'skip') why.push(`${formatDate(date, { day: 'numeric', month: 'short' })} is outside the event`);
      else if (outside === 'move') date = event.startDate;
    }
    if (!date) why.push('no day');
    const room = d.room ? roomOf(d.room) : (noRoom === 'tba' ? 'tba' : 'skip');
    if (room === 'skip') why.push(d.room ? `room “${d.room}” left out` : 'no room');
    const existing = sessions.find((s) => s.title.trim().toLowerCase() === d.title.trim().toLowerCase() && s.date === date && s.start === d.start);
    if (existing && dupes === 'skip') why.push('already on the programme');
    return { d, date, room, existing: existing && dupes === 'update' ? existing : undefined, why };
  }), [drafts, days.length, undated, outside, event.startDate, event.endDate, noRoom, sessions, dupes, roomChoice, roomInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = plan.filter((p) => p.why.length === 0);
  const left = plan.filter((p) => p.why.length > 0);
  const nOutside = drafts.filter((d) => d.date && (d.date < event.startDate || d.date > event.endDate)).length;
  const nUndated = days.length > 1 ? drafts.filter((d) => !d.date).length : 0;
  const nNoRoom = drafts.filter((d) => !d.room && d.problems.length === 0).length;
  const nDupes = drafts.filter((d) => sessions.some((s) => s.title.trim().toLowerCase() === d.title.trim().toLowerCase() && s.start === d.start)).length;
  const unsureRooms = roomTexts.filter((t) => !roomInfo[t]?.sure);
  const newTracks = trackTexts.filter((t) => !tracks.some((x) => x.name.toLowerCase() === t.toLowerCase()));
  const people = looksLikePeople(mapping);
  const emails = people ? [...new Set(drafts.map((d) => d.email).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))] : [];
  const ignored = (rows[headerRow] ?? []).filter((h, i) => h.trim() && mapping[i] === 'ignore');

  // ---------------------------------------------------------------- writing
  const commit = async () => {
    setBusy(true); setError(null);
    try {
      const roomCache = new Map<string, Room>(); let order = rooms.length, torder = tracks.length, madeRooms = 0, madeTracks = 0, created = 0, updated = 0;
      const trackCache = new Map<string, Track>();
      const resolveRoom = async (text: string, choice: string): Promise<Room> => {
        const key = `${choice}|${text}`; const hit = roomCache.get(key); if (hit) return hit;
        let room: Room | undefined;
        if (choice.startsWith('event:')) room = rooms.find((r) => r.id === choice.slice(6));
        else if (choice.startsWith('fac:')) {
          const f = facilities.items.find((x) => x.id === choice.slice(4));
          if (f) { room = rooms.find((r) => r.facilityId === f.id) ?? { id: newId('room'), eventId: event.id, name: f.name, number: f.number, facilityId: f.id, where: facilityWhere(f), capacity: 0, order: ++order }; if (!rooms.some((r) => r.id === room!.id)) { await store.set('rooms', room.id, room); madeRooms++; } }
        }
        if (!room) {
          const name = choice === 'tba' ? 'Location to be announced' : text;
          room = rooms.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? { id: newId('room'), eventId: event.id, name, capacity: 0, order: ++order };
          if (!rooms.some((r) => r.id === room!.id)) { await store.set('rooms', room.id, room); madeRooms++; }
        }
        roomCache.set(key, room); return room;
      };
      const resolveTrack = async (text: string): Promise<Track | undefined> => {
        if (!text) return undefined; const choice = trackOf(text);
        if (choice === 'none') return undefined;
        if (choice !== 'new') return tracks.find((t) => t.id === choice);
        const hit = trackCache.get(text.toLowerCase()); if (hit) return hit;
        const t: Track = { id: newId('track'), eventId: event.id, name: text, color: COLORS[torder % COLORS.length], order: ++torder };
        await store.set('tracks', t.id, t); madeTracks++; trackCache.set(text.toLowerCase(), t); return t;
      };
      for (const p of ready) {
        const room = await resolveRoom(p.d.room, p.room); const track = await resolveTrack(p.d.track);
        const fields = { title: p.d.title, abstract: p.d.abstract, type: p.d.type, date: p.date!, start: p.d.start!, end: p.d.end!, roomId: room.id, trackId: track?.id, speakers: p.d.speakers, capacity: p.d.capacity };
        if (p.existing) { await store.update('sessions', p.existing.id, fields); updated++; }
        else { const s: Session = { id: newId('ses'), eventId: event.id, ...fields, reservedUserIds: [], waitlistUserIds: [] }; await store.set('sessions', s.id, s); created++; }
      }
      setResult({ created, updated, rooms: madeRooms, tracks: madeTracks, left: left.length }); setStage('done');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  // ---------------------------------------------------------------- screens
  const steps: [Stage, string][] = [['file', 'File'], ['columns', 'Columns'], ['review', 'Questions']];
  return (
    <Drawer open={open} onClose={onClose} title="Import a programme" wide>
      <div className="space-y-4">
        {stage !== 'done' && (
          <ol className="flex items-center gap-2 text-xs">
            {steps.map(([s, label], i) => <li key={s} className={`inline-flex items-center gap-1.5 ${stage === s ? 'text-ink-900 font-semibold' : 'text-ink-300'}`}><span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${stage === s ? 'bg-blue-900 text-white' : 'bg-sand-200 text-ink-500'}`}>{i + 1}</span>{label}{i < 2 && <span className="w-6 h-px bg-sand-300 ml-1" />}</li>)}
          </ol>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        {stage === 'file' && (
          <>
            <p className="text-sm text-ink-500">Bring the programme however you have it. Its columns can be called anything — they are matched to ours on the next step, and whatever has no place in a programme is left out.</p>
            <label className="block rounded-xl border-2 border-dashed border-sand-200 hover:border-blue-300 bg-sand-50 p-8 text-center cursor-pointer transition-colors"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }}>
              <FileSpreadsheet className="w-7 h-7 text-ink-300 mx-auto" />
              <div className="text-sm font-semibold text-ink-900 mt-2">Drop an Excel or CSV file, or click to choose one</div>
              <div className="text-xs text-ink-500 mt-1">.xlsx · .csv · .tsv · .txt</div>
              <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.pdf,.docx" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-300 text-center">or paste it</div>
            <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} className="text-xs min-h-36" placeholder="Paste rows copied from a sheet — or the programme as plain text from an email or a document." />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={usePasted} disabled={!pasted.trim()}><Upload className="w-3.5 h-3.5" />Use as a table</Button>
              <Button size="sm" variant="secondary" onClick={() => void readWithAi(pasted)} disabled={!pasted.trim()} busy={aiBusy}><Sparkles className="w-3.5 h-3.5" />Read it with AI</Button>
              <Button size="sm" variant="ghost" onClick={() => setPasted(CSV_TEMPLATE)}>Show me an example</Button>
            </div>
            <p className="text-xs text-ink-500">The AI reader only transcribes into our columns; you still review everything before it counts.</p>
          </>
        )}

        {stage === 'columns' && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {sheets.length > 1 && <label className="text-xs text-ink-500">Sheet<Select value={String(sheetIdx)} onChange={(e) => pickSheet(Number(e.target.value))} className="mt-1">{sheets.map((s, i) => <option key={i} value={i}>{s.name} · {s.rows.length} rows</option>)}</Select></label>}
              <label className="text-xs text-ink-500">Column names are on<Select value={String(headerRow)} onChange={(e) => pickHeader(Number(e.target.value))} className="mt-1">{rows.slice(0, 12).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter(Boolean).slice(0, 4).join(' · ').slice(0, 60)}</option>)}</Select></label>
            </div>
            <Card className="divide-y divide-sand-200">
              <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-ink-500 grid grid-cols-[minmax(0,1fr)_13rem] gap-3"><span>In your file</span><span>Goes to</span></div>
              {(rows[headerRow] ?? []).map((h, i) => {
                const samples = rows.slice(headerRow + 1).map((r) => r[i]).filter((x) => x && x.trim()).slice(0, 2);
                if (!h.trim() && samples.length === 0) return null;
                const unknown = mapping[i] === 'ignore';
                return (
                  <div key={i} className={`px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_13rem] gap-3 items-center ${unknown ? 'bg-amber-50/60' : ''}`}>
                    <div className="min-w-0"><div className="text-sm font-semibold text-ink-900 truncate inline-flex items-center gap-1.5">{unknown && <CircleHelp className="w-3.5 h-3.5 text-amber-500 shrink-0" />}{h || `Column ${i + 1}`}</div><div className="text-xs text-ink-500 truncate">{samples.join(' · ') || '—'}</div></div>
                    <Select value={mapping[i] ?? 'ignore'} onChange={(e) => setMapping((m) => { const n = [...m]; const t = e.target.value as Target; if (t !== 'ignore') n.forEach((x, j) => { if (x === t && j !== i) n[j] = 'ignore'; }); n[i] = t; return n; })} className="py-1.5 text-sm">
                      {TARGETS.map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
                    </Select>
                  </div>
                );
              })}
            </Card>
            {ignored.length > 0 && <p className="text-xs text-ink-500"><CircleHelp className="w-3.5 h-3.5 text-amber-500 inline -mt-0.5 mr-1" />{ignored.length === 1 ? `“${ignored[0]}” has` : `${ignored.length} columns (${ignored.slice(0, 4).join(', ')}${ignored.length > 4 ? '…' : ''}) have`} no place in a programme and will be left out — unless you say above where {ignored.length === 1 ? 'it goes' : 'they go'}.</p>}
            {people ? (
              <Notice tone="info"><Users className="w-4 h-4 inline mr-1 -mt-0.5" />This looks like a list of people, not sessions: {emails.length} address{emails.length === 1 ? '' : 'es'}. {isAdmin(profile) ? 'Invite them to the event instead?' : 'An administrator can invite them from Access.'}
                {isAdmin(profile) && emails.length > 0 && <div className="mt-2"><Button size="sm" onClick={() => { onClose(); navigate(`/admin/events/${event.id}/access`, { state: { emails: emails.join('\n') } }); }}>Take these {emails.length} to Access</Button></div>}
              </Notice>
            ) : !mapping.includes('title') && (
              <Notice tone="warn">None of the columns reads as a session title. Point one at “Title” above — or, if this is not really a table, let the AI reader make one of it.
                <div className="mt-2"><Button size="sm" variant="secondary" busy={aiBusy} onClick={() => void readWithAi(rows.map((r) => r.filter(Boolean).join('\t')).join('\n'))}><Sparkles className="w-3.5 h-3.5" />Read it with AI</Button></div>
              </Notice>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStage('file')}><ArrowLeft className="w-3.5 h-3.5" />Another file</Button>
              <Button onClick={() => setStage('review')} disabled={!mapping.includes('title') || people}>Continue · {drafts.length} row{drafts.length === 1 ? '' : 's'}<ArrowRight className="w-4 h-4" /></Button>
            </div>
          </>
        )}

        {stage === 'review' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[[ready.length, 'ready to import'], [left.length, 'left out'], [ready.filter((p) => p.existing).length, 'update a session already there']].map(([n, l]) => <Card key={String(l)} className="p-3"><div className="font-display font-bold text-2xl tabular-nums text-ink-900">{n}</div><div className="text-[11px] text-ink-500 leading-tight">{l}</div></Card>)}
            </div>

            {(unsureRooms.length > 0 || newTracks.length > 0 || nOutside > 0 || nUndated > 0 || nNoRoom > 0 || nDupes > 0) && (
              <Card className="divide-y divide-sand-200">
                <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-ink-500">A few questions</div>
                {unsureRooms.map((t) => (
                  <Q key={`r-${t}`} title={`Which room is “${t}”?`} note={`${drafts.filter((d) => d.room === t).length} session${drafts.filter((d) => d.room === t).length === 1 ? '' : 's'} · not in this event or the campus list by that name`}>
                    <Select value={roomOf(t)} onChange={(e) => setRoomChoice((c) => ({ ...c, [t]: e.target.value }))} className="py-1.5 text-sm">
                      {roomInfo[t].own.map((r) => <option key={r.id} value={`event:${r.id}`}>{roomLabel(r)} (in this event)</option>)}
                      {roomInfo[t].campus.map((f) => <option key={f.id} value={`fac:${f.id}`}>{facilityLabel(f)} — {facilityWhere(f)}</option>)}
                      <option value="new">Create “{t}” as typed</option>
                      <option value="skip">Leave these sessions out</option>
                    </Select>
                  </Q>
                ))}
                {newTracks.map((t) => (
                  <Q key={`t-${t}`} title={`“${t}” is not a track here yet`} note={`${drafts.filter((d) => d.track === t).length} session${drafts.filter((d) => d.track === t).length === 1 ? '' : 's'}`}>
                    <Select value={trackOf(t)} onChange={(e) => setTrackChoice((c) => ({ ...c, [t]: e.target.value }))} className="py-1.5 text-sm">
                      <option value="new">Create the track</option>
                      {tracks.map((x) => <option key={x.id} value={x.id}>Use “{x.name}”</option>)}
                      <option value="none">No track for these</option>
                    </Select>
                  </Q>
                ))}
                {nUndated > 0 && <Q title={`${nUndated} session${nUndated === 1 ? ' has' : 's have'} no day`} note="The event runs over several."><Select value={undated} onChange={(e) => setUndated(e.target.value)} className="py-1.5 text-sm">{days.map((d) => <option key={d} value={d}>Put on {formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</Select></Q>}
                {nOutside > 0 && <Q title={`${nOutside} session${nOutside === 1 ? ' is' : 's are'} dated outside the event`}><Select value={outside} onChange={(e) => setOutside(e.target.value as typeof outside)} className="py-1.5 text-sm"><option value="skip">Leave them out</option><option value="move">Move to {formatDate(event.startDate, { day: 'numeric', month: 'short' })}</option><option value="keep">Keep their dates</option></Select></Q>}
                {nNoRoom > 0 && <Q title={`${nNoRoom} session${nNoRoom === 1 ? ' names' : 's name'} no room`}><Select value={noRoom} onChange={(e) => setNoRoom(e.target.value as typeof noRoom)} className="py-1.5 text-sm"><option value="tba">Put in “Location to be announced”</option><option value="skip">Leave them out</option></Select></Q>}
                {nDupes > 0 && <Q title={`${nDupes} already on the programme`} note="Same title and start time."><Select value={dupes} onChange={(e) => setDupes(e.target.value as typeof dupes)} className="py-1.5 text-sm"><option value="update">Update the existing sessions</option><option value="skip">Leave them as they are</option><option value="add">Add again anyway</option></Select></Q>}
              </Card>
            )}

            {roomTexts.filter((t) => roomInfo[t]?.sure).length > 0 && (
              <details className="text-xs text-ink-500"><summary className="cursor-pointer select-none">Rooms matched on their own ({roomTexts.filter((t) => roomInfo[t]?.sure).length})</summary>
                <ul className="mt-2 space-y-1">{roomTexts.filter((t) => roomInfo[t]?.sure).map((t) => { const c = roomOf(t); const r = c.startsWith('event:') ? rooms.find((x) => x.id === c.slice(6)) : undefined; const f = c.startsWith('fac:') ? facilities.items.find((x) => x.id === c.slice(4)) : undefined; return <li key={t}><span className="font-mono">{t}</span> → <span className="text-ink-900">{r ? roomLabel(r) : f ? `${facilityLabel(f)} · ${facilityWhere(f)}` : t}</span></li>; })}</ul>
              </details>
            )}

            <Card className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-ink-500 border-b border-sand-200"><tr><th className="p-2">Row</th><th className="p-2">Session</th><th className="p-2">When</th><th className="p-2">Room</th><th className="p-2"></th></tr></thead>
                <tbody className="divide-y divide-sand-200">
                  {plan.slice(0, 80).map((p) => (
                    <tr key={p.d.line} className={p.why.length ? 'bg-rose-50/60' : ''}>
                      <td className="p-2 tabular-nums text-ink-500">{p.d.line}</td>
                      <td className="p-2"><div className="font-semibold text-ink-900">{p.d.title || '—'}</div><div className="text-ink-500">{[p.d.type, p.d.track, p.d.speakers.map((s) => s.name).join(', ')].filter(Boolean).join(' · ')}</div></td>
                      <td className="p-2 tabular-nums whitespace-nowrap">{p.date ? formatDate(p.date, { day: 'numeric', month: 'short' }) : '—'}<br />{p.d.start && p.d.end ? `${formatTime(p.d.start)}–${formatTime(p.d.end)}` : '—'}</td>
                      <td className="p-2">{p.d.room || (noRoom === 'tba' ? 'TBA' : '—')}</td>
                      <td className="p-2">{p.why.length ? <span className="text-rose-700">Left out: {p.why.join('; ')}</span> : p.existing ? <Chip tone="blue">updates</Chip> : <span className="text-emerald-700 inline-flex items-center gap-1"><Check className="w-3 h-3" />ready</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.length > 80 && <div className="p-2 text-xs text-ink-500 text-center">…and {plan.length - 80} more rows</div>}
            </Card>
            {left.length > 0 && <p className="text-xs text-ink-500"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline -mt-0.5 mr-1" />{left.length} row{left.length === 1 ? '' : 's'} cannot become a session as {left.length === 1 ? 'it is' : 'they are'} and will be left out. Fix the file and import again — sessions already brought in are updated, not doubled.</p>}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStage('columns')}><ArrowLeft className="w-3.5 h-3.5" />Columns</Button>
              <Button onClick={() => void commit()} busy={busy} disabled={ready.length === 0}>Import {ready.length} session{ready.length === 1 ? '' : 's'}</Button>
            </div>
          </>
        )}

        {stage === 'done' && result && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center here-check"><Check className="w-7 h-7" /></div>
            <div className="font-display font-bold text-xl text-ink-900 mt-3">{result.created + result.updated} session{result.created + result.updated === 1 ? '' : 's'} on the programme</div>
            <p className="text-sm text-ink-500 mt-1">{[result.created ? `${result.created} new` : null, result.updated ? `${result.updated} updated` : null, result.rooms ? `${result.rooms} room${result.rooms === 1 ? '' : 's'} added` : null, result.tracks ? `${result.tracks} track${result.tracks === 1 ? '' : 's'} added` : null, result.left ? `${result.left} row${result.left === 1 ? '' : 's'} left out` : null].filter(Boolean).join(' · ')}</p>
            <Button className="mt-5" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
};
