import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, Check, AlertTriangle, RefreshCw, Loader2,
  ClipboardPaste, ArrowRight, Sparkles, Wand2,
} from 'lucide-react';
import {
  Room, Sponsor, MealService, Session, Track, UserProfile, Invite, EventConfig,
} from '../../types';
import { BatchOperation } from '../../lib/data/store';
import { parseCsv, mapColumns, toCsv } from '../../lib/csvImport';
import { IMPORT_SPECS, ImportSpec, ImportContext, RowResult } from '../../lib/importSpecs';
import { Field, inputClass, Notice } from './formKit';
import { structureWithAi, NotConfiguredError } from '../../lib/aiStructure';

interface AdminImportProps {
  events: EventConfig[];
  rooms: Room[];
  tracks: Track[];
  sponsors: Sponsor[];
  mealServices: MealService[];
  sessions: Session[];
  users: UserProfile[];
  invites: Invite[];
  currentUser: UserProfile;
  onCommit: (ops: BatchOperation[]) => Promise<void>;
}

/**
 * Bulk import.
 *
 * Organisers already hold this information — in a conference planning sheet, a
 * caterer's email, a sponsorship tracker. Retyping it into forms is the
 * single largest piece of administrative work the platform was creating, and
 * the one most likely to introduce a typo nobody notices until a badge is
 * printed.
 *
 * The shape of the screen is deliberate: nothing is written until a preview
 * has been read. Every row is validated, every match against existing data is
 * named, and a file with one bad row imports the other ninety rather than
 * refusing wholesale.
 */
export const AdminImport: React.FC<AdminImportProps> = ({
  events, rooms, tracks, sponsors, mealServices, sessions, users, invites,
  currentUser, onCommit,
}) => {
  const [specKey, setSpecKey] = useState(IMPORT_SPECS[0].key);
  const [eventId, setEventId] = useState(
    () => events.find((e) => e.isFeatured)?.id ?? events[0]?.id ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /** The freeform half: prose in, rows out, straight into the box above. */
  const [prose, setProse] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiSetup, setAiSetup] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const spec = IMPORT_SPECS.find((s) => s.key === specKey) ?? IMPORT_SPECS[0];

  /** Parse, map and validate on every keystroke. Cheap, and it means the
   *  organiser sees the consequence of a fix immediately. */
  const preview = useMemo(() => {
    const rows = parseCsv(text);
    if (rows.length < 2) return null;

    const [headers, ...body] = rows;
    const map = mapColumns(headers, spec.fields);
    const unmatched = spec.fields.filter((f) => f.required && map[f.key] === undefined);

    // A fresh context per run: `pending` must not carry across keystrokes, or
    // rows would resolve against records from an earlier draft.
    const ctx: ImportContext = {
      eventId, rooms, tracks, sponsors, users, mealServices, invites, sessions,
      currentUserId: currentUser.id,
      pending: new Map(),
    };

    const results: (RowResult & { line: number })[] = body.map((row, i) => ({
      line: i + 2,
      ...spec.build(row, map, ctx),
    }));

    return {
      headers,
      map,
      unmatched,
      results,
      ready: results.filter((r) => r.problems.length === 0 && !r.duplicateOf).length,
      updating: results.filter((r) => r.problems.length === 0 && r.duplicateOf).length,
      blocked: results.filter((r) => r.problems.length > 0).length,
    };
  }, [text, spec, eventId, rooms, tracks, sponsors, users, mealServices, invites,
      sessions, currentUser.id]);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result ?? '')); setDone(null); };
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([toCsv(spec.template)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ci-connects-${spec.key}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const structure = async () => {
    if (!prose.trim()) return;
    setThinking(true); setError(null); setAiSetup(null); setAiNote(null);
    try {
      const result = await structureWithAi(spec.label, spec.fields, prose);
      // Straight into the CSV box, not into the database. Everything below —
      // column matching, validation, duplicate detection, confirmation —
      // happens exactly as it would for a hand-made file.
      setText(result.csv);
      setAiNote(`${result.rows} row${result.rows === 1 ? '' : 's'} drafted. `
        + 'Read them before importing — check anything with consequences, '
        + 'especially times, capacities and email addresses.');
    } catch (e) {
      if (e instanceof NotConfiguredError) setAiSetup(e.message);
      else setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    const ops = preview.results.flatMap((r) => r.ops);
    if (ops.length === 0) return;
    setBusy(true); setError(null);
    try {
      await onCommit(ops);
      setDone(`${preview.ready} added, ${preview.updating} updated.`);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ---------- What ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">Import from a spreadsheet</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Paste or upload what you already have. Nothing is saved until you have read
          the preview.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          {IMPORT_SPECS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSpecKey(s.key); setDone(null); }}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                s.key === specKey
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">{spec.blurb}</p>

        {(spec.key === 'sessions' || spec.key === 'mealServices' || spec.key === 'invites') && (
          <Field label="Which event" hint="Rows are attached to this event.">
            <select className={inputClass} value={eventId}
                    onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload a CSV
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download the template
          </button>
          {text && (
            <button
              onClick={() => { setText(''); setDone(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 text-xs font-semibold hover:border-slate-400 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ---------- Paste ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardPaste className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Or paste rows here
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setDone(null); }}
          rows={7}
          spellCheck={false}
          placeholder={toCsv(spec.template.slice(0, 2))}
          className={`${inputClass} font-mono text-[11px] leading-relaxed resize-y`}
        />
        <p className="text-[11px] text-slate-400 mt-2">
          Copy the rows out of Excel or Google Sheets, including the header row. Column
          names are matched loosely, so “Start Time”, “start_time” and “Begins” all work.
        </p>
      </div>

      {/* ---------- Prose ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-slate-900">
            Or paste it however you have it
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          An email from the caterer, a schedule out of a Word document, a list of
          sponsors with no columns at all. It is turned into rows above, which you then
          read and confirm like any other file — nothing is saved from here directly.
        </p>
        <textarea
          value={prose}
          onChange={(e) => setProse(e.target.value)}
          rows={5}
          placeholder={'Friday 15 October\n11:00–12:15  Argument in the Age of Autocomplete — Dr Sarah Lin, B-201\n13:45–15:00  Quiet Leadership — Prof David Kim, Black Box'}
          className={`${inputClass} resize-y text-xs leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={structure}
            disabled={thinking || !prose.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {thinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {thinking ? 'Reading it…' : 'Turn this into rows'}
          </button>
          {prose && !thinking && (
            <button
              onClick={() => { setProse(''); setAiNote(null); }}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 text-xs font-semibold hover:border-slate-400 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {aiNote && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 leading-relaxed">{aiNote}</p>
          </div>
        )}

        {aiSetup && (
          <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-300">
            <p className="text-xs font-bold text-amber-900 mb-1.5">Not switched on yet</p>
            <p className="text-[11px] text-amber-900 leading-relaxed mb-2">
              This needs an API key, held on the server rather than in the browser. In
              the Cloudflare dashboard: Workers &amp; Pages → ci-events → Settings →
              Variables and Secrets, add one of
            </p>
            <ul className="text-[11px] text-amber-900 leading-relaxed list-disc pl-4 space-y-0.5">
              <li><code className="font-mono">GEMINI_API_KEY</code> — from Google AI Studio</li>
              <li><code className="font-mono">ANTHROPIC_API_KEY</code> — from the Anthropic console</li>
            </ul>
            <p className="text-[11px] text-amber-900 leading-relaxed mt-2">
              Add <code className="font-mono">FIREBASE_API_KEY</code> as well, which the
              endpoint uses to confirm the caller is a signed-in Chadwick account.
            </p>
          </div>
        )}
      </div>

      {error && <Notice>{error}</Notice>}
      {done && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-300">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-sm font-semibold text-emerald-900">{done}</p>
        </div>
      )}

      {/* ---------- Preview ---------- */}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-sm font-bold text-slate-900">
                {preview.results.length} row{preview.results.length === 1 ? '' : 's'} read
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <Check className="w-3.5 h-3.5" /> {preview.ready} new
              </span>
              {preview.updating > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <RefreshCw className="w-3.5 h-3.5" /> {preview.updating} will update existing
                </span>
              )}
              {preview.blocked > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" /> {preview.blocked} cannot be imported
                </span>
              )}
            </div>

            {/* Which spreadsheet column became which field. Silent guessing is
                how an import puts the room name in the description. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {spec.fields.map((f) => {
                const col = preview.map[f.key];
                const matched = col !== undefined;
                return (
                  <span
                    key={f.key}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
                      matched
                        ? 'bg-slate-50 text-slate-600 border-slate-200'
                        : f.required
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-white text-slate-300 border-slate-100'
                    }`}
                    title={f.hint}
                  >
                    {f.label}
                    {matched
                      ? <span className="text-slate-400"> ← {preview.headers[col]}</span>
                      : f.required ? ' — missing' : ' — not provided'}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto divide-y divide-slate-100">
            {preview.results.map((r) => (
              <div key={r.line} className="px-5 py-3 flex items-start gap-3">
                <span className="text-[10px] font-mono text-slate-300 w-6 shrink-0 pt-0.5 tabular-nums">
                  {r.line}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">{r.summary}</div>
                  {r.detail && <div className="text-[11px] text-slate-500 truncate">{r.detail}</div>}
                  {r.problems.map((p) => (
                    <div key={p} className="flex items-start gap-1.5 text-[11px] text-amber-800 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                      {p}
                    </div>
                  ))}
                  {r.duplicateOf && r.problems.length === 0 && (
                    <div className="flex items-start gap-1.5 text-[11px] text-blue-700 mt-1">
                      <RefreshCw className="w-3 h-3 shrink-0 mt-px" />
                      Updates {r.duplicateOf}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-4">
            <p className="text-[11px] text-slate-400">
              {preview.blocked > 0
                ? 'Rows with problems are skipped; the rest still import.'
                : 'Everything checks out.'}
            </p>
            <button
              onClick={commit}
              disabled={busy || preview.ready + preview.updating === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Import {preview.ready + preview.updating} row
              {preview.ready + preview.updating === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {!preview && text.trim() && (
        <Notice>
          Nothing readable yet — a header row plus at least one row of data is needed.
        </Notice>
      )}

      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <Sparkles className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Rooms and sponsors are shared across every event, so importing them once is
          enough — a later programme just names them. Dietary tags are only read when a
          menu line states one, and any that were defaulted are flagged above for you to
          confirm.
        </p>
      </div>
    </div>
  );
};
