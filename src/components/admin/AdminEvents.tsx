import React, { useMemo, useState } from 'react';
import {
  CalendarPlus, Pencil, Trash2, Eye, EyeOff, Star, AlertTriangle, Check, X, Plus,
} from 'lucide-react';
import { EventConfig, EventCategory, UserProfile, eventStatus } from '../../types';
import { can } from '../../lib/permissions';
import { resolveVideoEmbed } from '../../lib/videoEmbed';

interface AdminEventsProps {
  events: EventConfig[];
  currentUser: UserProfile;
  onSave: (event: EventConfig, isNew: boolean) => Promise<void> | void;
  onDelete: (eventId: string) => Promise<void> | void;
}

const CATEGORIES: EventCategory[] =
  ['Conference', 'Symposium', 'Workshop', 'Community', 'Admissions', 'Student'];

/** Slug from a name: lowercase, hyphenated, URL-safe. Editable afterwards,
 *  because changing it later breaks any link already shared. */
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const blankEvent = (ownerId: string): EventConfig => ({
  id: `evt-${Date.now()}`,
  slug: '',
  name: '',
  shortName: '',
  tagline: '',
  summary: '',
  category: 'Conference',
  startDate: '',
  endDate: '',
  dateLabel: '',
  venueName: 'Chadwick International, Songdo',
  heroImageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=80',
  registrationOpen: false,
  status: 'draft',
  ownerId,
});

/**
 * Event creation and editing.
 *
 * New events are created as drafts. A draft is invisible on the public hub —
 * the rules enforce that, not just this screen — so an organiser can build one
 * over several sittings without a half-written page being publicly readable.
 * Publishing is the deliberate, separate step.
 */
export const AdminEvents: React.FC<AdminEventsProps> = ({
  events, currentUser, onSave, onDelete,
}) => {
  const [editing, setEditing] = useState<EventConfig | null>(null);
  /** Whether the pasted recording link will actually embed, checked as it is
   *  typed rather than discovered by a visitor months later. */
  const recordingEmbed = useMemo(
    () => resolveVideoEmbed(editing?.recap?.recordingUrl),
    [editing?.recap?.recordingUrl],
  );
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const mayDelete = can(currentUser, 'events:delete');

  const sorted = useMemo(
    () => [...events].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    [events],
  );

  const startNew = () => {
    setEditing(blankEvent(currentUser.id));
    setIsNew(true);
    setError(null);
  };

  const edit = (e: EventConfig) => {
    setEditing({ ...e });
    setIsNew(false);
    setError(null);
  };

  const set = <K extends keyof EventConfig>(key: K, value: EventConfig[K]) =>
    setEditing((e) => (e ? { ...e, [key]: value } : e));

  const validate = (e: EventConfig): string | null => {
    if (!e.name.trim()) return 'The event needs a name.';
    if (!e.slug.trim()) return 'The event needs a URL slug.';
    if (!e.startDate || !e.endDate) return 'Start and end dates are required.';
    if (e.endDate < e.startDate) return 'The end date cannot be before the start date.';
    const clash = events.find((x) => x.slug === e.slug && x.id !== e.id);
    if (clash) return `The slug "${e.slug}" is already used by "${clash.name}".`;
    return null;
  };

  const save = async () => {
    if (!editing) return;
    const problem = validate(editing);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave(editing, isNew);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (e: EventConfig) => {
    setError(null);
    try {
      await onSave({ ...e, status: e.status === 'published' ? 'draft' : 'published' }, false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ------------------------------------------------------------------ editor
  if (editing) {
    const F: React.FC<{ label: string; hint?: string; children: React.ReactNode }> =
      ({ label, hint, children }) => (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
          {children}
          {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </div>
      );
    const input = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600';

    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'New event' : `Editing: ${editing.name || 'Untitled'}`}</h3>
          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Event name">
              <input
                className={input}
                value={editing.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((cur) => cur ? {
                    ...cur,
                    name,
                    // Only auto-fill the slug while it is untouched, so editing
                    // the name of a published event never silently moves its URL.
                    slug: isNew && (!cur.slug || cur.slug === slugify(cur.name)) ? slugify(name) : cur.slug,
                    shortName: cur.shortName || name,
                  } : cur);
                }}
                placeholder="Chadwick Connects"
              />
            </F>
            <F label="Short name" hint="Used in navigation and on badges.">
              <input className={input} value={editing.shortName}
                     onChange={(e) => set('shortName', e.target.value)} />
            </F>
          </div>

          <F label="URL slug" hint={`Public address: /?event=${editing.slug || '…'}`}>
            <input className={input} value={editing.slug}
                   onChange={(e) => set('slug', slugify(e.target.value))} />
          </F>

          <F label="Tagline" hint="One line, shown large under the event name.">
            <input className={input} value={editing.tagline}
                   onChange={(e) => set('tagline', e.target.value)}
                   placeholder="Relationships Drive Our Mission" />
          </F>

          <F label="Summary" hint="One or two sentences for the events hub card.">
            <textarea className={`${input} resize-none`} rows={2} value={editing.summary}
                      onChange={(e) => set('summary', e.target.value)} />
          </F>

          <F label="Description" hint="Longer prose for the event's own page. Optional.">
            <textarea className={`${input} resize-none`} rows={4} value={editing.description ?? ''}
                      onChange={(e) => set('description', e.target.value)} />
          </F>

          <div className="grid sm:grid-cols-3 gap-4">
            <F label="Category">
              <select className={input} value={editing.category}
                      onChange={(e) => set('category', e.target.value as EventCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Start date">
              <input type="date" className={input} value={editing.startDate}
                     onChange={(e) => set('startDate', e.target.value)} />
            </F>
            <F label="End date">
              <input type="date" className={input} value={editing.endDate}
                     onChange={(e) => set('endDate', e.target.value)} />
            </F>
          </div>

          <F label="Date label" hint="How the dates read on the page. Left blank, it is generated from the dates above.">
            <input className={input} value={editing.dateLabel}
                   onChange={(e) => set('dateLabel', e.target.value)}
                   placeholder="Friday 15 - Saturday 16 October 2027" />
          </F>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Venue name">
              <input className={input} value={editing.venueName}
                     onChange={(e) => set('venueName', e.target.value)} />
            </F>
            <F label="Venue address" hint="Optional.">
              <input className={input} value={editing.venueAddress ?? ''}
                     onChange={(e) => set('venueAddress', e.target.value)} />
            </F>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Registration opens" hint="Before this the event is announced but not bookable. Leave blank to open immediately.">
              <input type="date" className={input} value={editing.registrationOpensAt ?? ''}
                     onChange={(e) => set('registrationOpensAt', e.target.value || undefined)} />
            </F>
            <F label="Registration closes" hint="Leave blank to stay open until the event begins.">
              <input type="date" className={input} value={editing.registrationClosesAt ?? ''}
                     onChange={(e) => set('registrationClosesAt', e.target.value || undefined)} />
            </F>
          </div>

          <F label="Cover image URL" hint="Paste any image URL. Uploading from your machine comes next.">
            <input className={input} value={editing.heroImageUrl}
                   onChange={(e) => set('heroImageUrl', e.target.value)} />
          </F>
          {editing.heroImageUrl && (
            <img src={editing.heroImageUrl} alt=""
                 className="w-full h-40 object-cover rounded-xl border border-slate-200" />
          )}

          {editing.startDate && new Date(editing.startDate + 'T00:00:00') <= new Date() && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">After the event</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Shown on the event page and the hub. A past event keeps its page —
                  the recording and the numbers are the argument for the next one.
                </p>
              </div>
              <F label="How it went">
                <textarea className={`${input} resize-none`} rows={3}
                  value={editing.recap?.summary ?? ''}
                  onChange={(e) => set('recap', { ...editing.recap, summary: e.target.value })} />
              </F>
              <div className="grid sm:grid-cols-2 gap-4">
                <F label="Recording link" hint="Paste the normal share link — YouTube, Drive or Vimeo.">
                  <input className={input} value={editing.recap?.recordingUrl ?? ''}
                    onChange={(e) => set('recap', { ...editing.recap, recordingUrl: e.target.value })}
                    placeholder="https://" />
                  {/* Say immediately whether it will play. A link that silently
                      fails to embed is only discovered by a visitor. */}
                  {editing.recap?.recordingUrl?.trim() && (
                    recordingEmbed ? (
                      <p className="flex items-start gap-1.5 mt-1.5 text-[11px] text-emerald-800">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-px" />
                        {recordingEmbed.provider} — this will play inline on the event page.
                        {recordingEmbed.provider === 'Google Drive'
                          && ' Set the file to "Anyone with the link" or viewers hit a sign-in wall.'}
                      </p>
                    ) : (
                      <p className="flex items-start gap-1.5 mt-1.5 text-[11px] text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        Not a recognised video link — it will show as a button rather than a
                        player. YouTube, Google Drive and Vimeo embed.
                      </p>
                    )
                  )}
                </F>
                <F label="Link label">
                  <input className={input} value={editing.recap?.recordingLabel ?? ''}
                    onChange={(e) => set('recap', { ...editing.recap, recordingLabel: e.target.value })}
                    placeholder="Watch the closing plenary" />
                </F>
              </div>
              <F label="Key takeaways" hint="One per line. What people should carry away — not the numbers.">
                <textarea className={`${input} resize-none`} rows={4}
                  placeholder={'Start with the exit ticket, not the lesson plan\nCoaching works when the teacher picks the goal'}
                  value={(editing.recap?.takeaways ?? []).join('\n')}
                  onChange={(e) => set('recap', {
                    ...editing.recap,
                    takeaways: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
                  })} />
              </F>

              <F label="Slides and materials" hint="One per line as: Title | https://link | Presenter (presenter optional).">
                <textarea className={`${input} resize-none font-mono text-xs`} rows={4}
                  placeholder={'Opening keynote slides | https://docs.google.com/... | Ted Hill'}
                  value={(editing.recap?.materials ?? [])
                    .map((m) => [m.label, m.url, m.presenter].filter(Boolean).join(' | '))
                    .join('\n')}
                  onChange={(e) => set('recap', {
                    ...editing.recap,
                    materials: e.target.value.split('\n')
                      .map((line) => line.split('|').map((x) => x.trim()))
                      .filter((parts) => parts[0] && parts[1])
                      .map(([label, url, presenter]) => ({
                        label, url, ...(presenter ? { presenter } : {}),
                      })),
                  })} />
              </F>

              <F label="Highlight photos" hint="One image URL per line.">
                <textarea className={`${input} resize-none`} rows={3}
                  value={(editing.recap?.photoUrls ?? []).join('\n')}
                  onChange={(e) => set('recap', {
                    ...editing.recap,
                    photoUrls: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
                  })} />
              </F>
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-1">
            {([
              ['registrationOpen', 'Registration open'],
              ['isFeatured', 'Feature on the hub'],
              ['isTemplate', 'Mark as sample/template'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={Boolean(editing[key])}
                  onChange={(e) => set(key, e.target.checked as never)}
                />
                {label}
              </label>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy}
              className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {busy ? 'Saving…' : isNew ? 'Create as draft' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- list
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <CalendarPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Events</h3>
          </div>
          <p className="text-xs text-slate-500">
            {events.length} total · {events.filter((e) => e.status === 'draft').length} draft.
            Drafts are hidden from the public hub.
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New event
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {sorted.map((e) => {
          const isDraft = e.status === 'draft';
          const when = e.startDate ? eventStatus(e) : 'upcoming';
          return (
            <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <img src={e.heroImageUrl} alt=""
                   className="w-20 h-14 rounded-lg object-cover shrink-0 bg-slate-100" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 truncate">{e.name}</span>
                  {isDraft && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      Draft
                    </span>
                  )}
                  {e.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                </div>
                <div className="text-xs text-slate-500">{e.dateLabel || e.startDate}</div>
                <div className="text-[11px] text-slate-400">
                  {e.category} · {when} · /?event={e.slug}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => togglePublish(e)}
                  title={isDraft ? 'Publish' : 'Return to draft'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  {isDraft ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {isDraft ? 'Publish' : 'Unpublish'}
                </button>
                <button
                  onClick={() => edit(e)}
                  className="p-2 rounded-lg border border-slate-200 hover:border-blue-600 transition-colors cursor-pointer"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
                {mayDelete && (
                  confirmDelete === e.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => { await onDelete(e.id); setConfirmDelete(null); }}
                        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="p-2 rounded-lg border border-slate-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(e.id)}
                      className="p-2 rounded-lg border border-slate-200 hover:border-amber-600 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
