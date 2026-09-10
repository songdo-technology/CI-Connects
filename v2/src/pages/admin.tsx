import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import {
  CalendarDays, Users, Megaphone, Settings, LayoutDashboard, Plus, Pencil, KeyRound, ClipboardCheck, ListTree, Trash2, ArrowLeft, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Event, Announcement, Role, ROLE_LABEL, SiteSettings } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isAdmin } from '../lib/roles';
import { ROLES } from '../lib/roles';
import { formatRange, eventPhase, nowIso, newId, todayYmd } from '../lib/time';
import { Button, Card, Chip, Empty, Field, Input, Notice, Select, Spinner, Stat, Textarea, PageHeader, Avatar } from '../components/ui';

// ------------------------------------------------------------------ layout
export const AdminLayout: React.FC = () => {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const items = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/events', label: 'Events', icon: CalendarDays },
    ...(admin ? [
      { to: '/admin/people', label: 'People', icon: Users },
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ] : []),
  ];
  return (
    <div className="max-w-6xl mx-auto px-5 py-6 lg:py-8">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none mb-6 -mx-1 px-1">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-white text-blue-700 border border-sand-200 shadow-[var(--shadow-card)]' : 'text-ink-500 hover:text-ink-900 hover:bg-sand-200/70'}`}>
            <it.icon className="w-4 h-4" />{it.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
};

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

// ------------------------------------------------------------------ overview
export const AdminHome: React.FC = () => {
  const { profile } = useAuth();
  const events = useWatch('events', []);
  const users = useWatch('users', [], isAdmin(profile));
  const sessions = useWatch('sessions', []);
  const next = [...events.items].filter((e) => eventPhase(e.startDate, e.endDate) !== 'past').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!events.ready) return <Spinner />;
  return (
    <div>
      <PageHeader title="Administration" description={isAdmin(profile) ? 'Everything: events, programmes, people, announcements.' : 'The programmes of the events you help run.'} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat value={events.items.length} label="Events" note={`${events.items.filter((e) => e.status === 'published').length} published`} />
        <Stat value={sessions.items.length} label="Sessions" note="across all events" />
        {isAdmin(profile) && <Stat value={users.items.length} label="People" note={`${users.items.filter((u) => u.role !== 'user').length} with a role`} />}
        {next && <Stat value={`${Math.max(0, Math.ceil((new Date(next.startDate + 'T00:00:00').getTime() - Date.now()) / 86400000))}d`} label="Until the next event" note={next.name} />}
      </div>
      {next ? (
        <Card className="p-5">
          <div className="eyebrow mb-1">Next event</div>
          <div className="text-xl font-bold text-ink-900">{next.name}</div>
          <div className="text-sm text-ink-500">{formatRange(next.startDate, next.endDate)} · {next.venueName} · {sessions.items.filter((s) => s.eventId === next.id).length} sessions</div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" to={`/admin/events/${next.id}/schedule`}><ListTree className="w-3.5 h-3.5" />Schedule</Button>
            {isAdmin(profile) && <Button size="sm" variant="secondary" to={`/admin/events/${next.id}/access`}><KeyRound className="w-3.5 h-3.5" />Access</Button>}
            <Button size="sm" variant="secondary" to={`/admin/events/${next.id}/checkin`}><ClipboardCheck className="w-3.5 h-3.5" />Check-in</Button>
            {isAdmin(profile) && <Button size="sm" variant="secondary" to={`/admin/events/${next.id}`}><Pencil className="w-3.5 h-3.5" />Edit</Button>}
          </div>
        </Card>
      ) : (
        <Empty icon={CalendarDays} title="No events yet" action={isAdmin(profile) ? <Button to="/admin/events/new"><Plus className="w-4 h-4" />New event</Button> : undefined} />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ events
export const AdminEvents: React.FC = () => {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const events = useWatch('events', []);
  const sessions = useWatch('sessions', []);
  const rows = [...events.items].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <div>
      <PageHeader title="Events" description={admin ? 'Drafts are yours until you publish them.' : 'Open a programme to manage its sessions, rooms and tracks.'}
        actions={admin ? <Button to="/admin/events/new"><Plus className="w-4 h-4" />New event</Button> : undefined} />
      {!events.ready ? <Spinner /> : rows.length === 0 ? <Empty icon={CalendarDays} title="No events yet" /> : (
        <div className="space-y-3">
          {rows.map((e) => {
            const n = sessions.items.filter((s) => s.eventId === e.id).length;
            const phase = eventPhase(e.startDate, e.endDate);
            return (
              <Card key={e.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="w-full md:w-28 aspect-[16/9] md:aspect-[4/3] rounded-lg bg-sand-200 overflow-hidden shrink-0"><img src={e.coverUrl} alt="" className="w-full h-full object-cover" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900">{e.name}</span>
                    {e.status === 'draft' ? <Chip tone="amber">Draft</Chip> : <Chip tone="green">Published</Chip>}
                    {phase === 'past' && <Chip>Past</Chip>}
                  </div>
                  <div className="text-sm text-ink-500 mt-0.5">{formatRange(e.startDate, e.endDate)} · {e.venueName} · {n} session{n === 1 ? '' : 's'}</div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" to={`/admin/events/${e.id}/schedule`}><ListTree className="w-3.5 h-3.5" />Schedule</Button>
                  {admin && <Button size="sm" variant="secondary" to={`/admin/events/${e.id}/access`}><KeyRound className="w-3.5 h-3.5" />Access</Button>}
                  <Button size="sm" variant="secondary" to={`/admin/events/${e.id}/checkin`}><ClipboardCheck className="w-3.5 h-3.5" />Check-in</Button>
                  {admin && <Button size="sm" variant="secondary" to={`/admin/events/${e.id}`}><Pencil className="w-3.5 h-3.5" />Edit</Button>}
                  <Link to={`/events/${e.slug}`} className="btn-ghost btn-sm" title="Public page"><ExternalLink className="w-3.5 h-3.5" /></Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const blankEvent = (uid: string): Event => ({
  id: newId('evt'), slug: '', name: '', tagline: '', description: '',
  startDate: todayYmd(), endDate: todayYmd(), venueName: 'Chadwick International, Songdo',
  venueAddress: '45 Art center-daero 97beon-gil, Yeonsu-gu, Incheon',
  coverUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1800&auto=format&fit=crop&q=80',
  status: 'draft', registrationOpen: true, createdBy: uid, createdAt: nowIso(),
});

export const AdminEventEdit: React.FC = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;
  const { doc: existing, ready } = useDoc('events', id ?? null);
  const sessions = useWatch('sessions', id ? [{ field: 'eventId', op: '==', value: id }] : [], Boolean(id));
  const [form, setForm] = useState<Event | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (isNew && profile && !form) setForm(blankEvent(profile.id));
    if (!isNew && existing && !form) { setForm(existing); setSlugTouched(true); }
  }, [isNew, existing, profile, form]);
  if (!isNew && !ready) return <Spinner />;
  if (!isNew && ready && !existing) return <Empty icon={CalendarDays} title="No such event" action={<Button to="/admin/events">Events</Button>} />;
  if (!form) return <Spinner />;
  const set = (patch: Partial<Event>) => setForm({ ...form, ...patch });
  const save = async () => {
    setError(null);
    if (!form.name.trim()) return setError('Give the event a name.');
    if (!form.slug.trim()) return setError('The address needs a slug.');
    if (form.endDate < form.startDate) return setError('The end date is before the start date.');
    setBusy(true);
    try {
      await store.set('events', form.id, { ...form, name: form.name.trim(), slug: slugify(form.slug) });
      navigate('/admin/events');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    await store.remove('events', form.id);
    navigate('/admin/events');
  };
  return (
    <div className="max-w-3xl">
      <Link to="/admin/events" className="btn-ghost btn-sm mb-4"><ArrowLeft className="w-4 h-4" />Events</Link>
      <PageHeader title={isNew ? 'New event' : form.name || 'Edit event'} description={isNew ? 'It starts as a draft only organisers can see.' : undefined}
        actions={!isNew ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" to={`/admin/events/${form.id}/schedule`}><ListTree className="w-3.5 h-3.5" />Schedule</Button>
            <Button size="sm" variant="secondary" to={`/admin/events/${form.id}/access`}><KeyRound className="w-3.5 h-3.5" />Access</Button>
          </div>) : undefined} />
      <Card className="p-6 space-y-5">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => { const name = e.target.value; set({ name, ...(slugTouched ? {} : { slug: slugify(name) }) }); }} placeholder="KORCOS 2026" /></Field>
          <Field label="Address" hint={`/events/${slugify(form.slug) || '…'}`}><Input value={form.slug} onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value }); }} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set({ status: e.target.value as Event['status'] })}>
              <option value="draft">Draft — organisers only</option>
              <option value="published">Published — on the public site</option>
            </Select>
          </Field>
          <Field label="Tagline" className="sm:col-span-2"><Input value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="One line under the name" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} className="min-h-32" /></Field>
          <Field label="Starts"><Input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value, ...(form.endDate < e.target.value ? { endDate: e.target.value } : {}) })} /></Field>
          <Field label="Ends"><Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
          <Field label="Venue"><Input value={form.venueName} onChange={(e) => set({ venueName: e.target.value })} /></Field>
          <Field label="Address"><Input value={form.venueAddress ?? ''} onChange={(e) => set({ venueAddress: e.target.value || undefined })} /></Field>
          <Field label="Cover image URL" className="sm:col-span-2" hint="A wide photograph. Unsplash links work."><Input value={form.coverUrl} onChange={(e) => set({ coverUrl: e.target.value })} /></Field>
        </div>
        {form.coverUrl && <div className="aspect-[21/9] rounded-lg overflow-hidden bg-sand-200"><img src={form.coverUrl} alt="" className="w-full h-full object-cover" /></div>}
        <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.registrationOpen} onChange={(e) => set({ registrationOpen: e.target.checked })} />Registration open</label>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-sand-200">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {sessions.items.length > 0 ? <span className="text-ink-700">Remove its {sessions.items.length} sessions first.</span> : <><span>Delete for good?</span><Button size="sm" variant="danger" onClick={() => void remove()} busy={busy}>Delete</Button></>}
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" />Delete</Button>
          ) : <span />}
          <Button onClick={() => void save()} busy={busy}>{isNew ? 'Create draft' : 'Save'}</Button>
        </div>
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------ people
export const AdminPeople: React.FC = () => {
  const { realProfile } = useAuth();
  const users = useWatch('users', []);
  const events = useWatch('events', []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const admins = users.items.filter((u) => u.role === 'admin').length;
  const rows = useMemo(() => users.items.filter((u) => !q || `${u.name} ${u.email} ${u.org ?? ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [users.items, q]);
  const setRole = async (id: string, role: Role) => { setBusy(id); await store.update('users', id, { role }); setBusy(null); };
  return (
    <div>
      <PageHeader title="People" description="Everyone who has signed in. Roles decide what they can run; lists decide what they can see." />
      <div className="relative mb-4 max-w-md"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, school" /></div>
      {!users.ready ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-500 border-b border-sand-200"><tr><th className="p-3 font-semibold">Person</th><th className="p-3 font-semibold">Role</th><th className="p-3 font-semibold">On the list of</th></tr></thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map((u) => {
                const self = u.id === realProfile?.id;
                const lastAdmin = u.role === 'admin' && admins <= 1;
                return (
                  <tr key={u.id}>
                    <td className="p-3"><div className="flex items-center gap-3"><Avatar name={u.name} photoUrl={u.photoUrl} /><div className="min-w-0"><div className="font-semibold text-ink-900">{u.name}{self && <span className="text-ink-500 font-normal"> (you)</span>}</div><div className="text-xs text-ink-500">{u.email}{u.org ? ` · ${u.org}` : ''}</div></div></div></td>
                    <td className="p-3">
                      <Select value={u.role} disabled={self || lastAdmin || busy === u.id} onChange={(e) => void setRole(u.id, e.target.value as Role)} className="py-1.5 text-xs w-44" title={self ? 'You cannot change your own role' : lastAdmin ? 'The last administrator stays one' : ''}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </Select>
                    </td>
                    <td className="p-3 text-xs text-ink-500">{u.role !== 'user' ? 'Every event' : u.eventAccess.map((id) => events.items.find((e) => e.id === id)?.name ?? id).join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ announcements
export const AdminAnnouncements: React.FC = () => {
  const { profile } = useAuth();
  const list = useWatch('announcements', []);
  const events = useWatch('events', []);
  const [form, setForm] = useState({ title: '', body: '', level: 'info' as Announcement['level'], eventId: '' });
  const [busy, setBusy] = useState(false);
  const rows = [...list.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const post = async () => {
    if (!form.title.trim() || !profile) return;
    setBusy(true);
    const a: Announcement = { id: newId('ann'), eventId: form.eventId || null, title: form.title.trim(), body: form.body.trim(), level: form.level, active: true, createdAt: nowIso(), createdBy: profile.id };
    await store.set('announcements', a.id, a);
    setForm({ title: '', body: '', level: 'info', eventId: '' }); setBusy(false);
  };
  return (
    <div>
      <PageHeader title="Announcements" description="A banner at the top of the dashboard, or inside one event. Urgent ones sort first." />
      <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-6">
        <Card className="p-5 space-y-3 h-fit">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Room change" /></Field>
          <Field label="Detail"><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="The afternoon panel moves to the Black Box." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level"><Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Announcement['level'] })}><option value="info">Information</option><option value="urgent">Urgent</option></Select></Field>
            <Field label="Where"><Select value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}><option value="">Everywhere</option>{events.items.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
          </div>
          <Button onClick={() => void post()} busy={busy} disabled={!form.title.trim()} className="w-full"><Megaphone className="w-4 h-4" />Post</Button>
        </Card>
        <div className="space-y-3">
          {rows.length === 0 && <Empty icon={Megaphone} title="Nothing posted yet" />}
          {rows.map((a) => (
            <Card key={a.id} className={`p-4 ${a.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-ink-900">{a.title}</span>{a.level === 'urgent' && <Chip tone="amber">Urgent</Chip>}<Chip>{a.eventId ? (events.items.find((e) => e.id === a.eventId)?.name ?? 'One event') : 'Everywhere'}</Chip>{!a.active && <Chip>Off</Chip>}</div>
                  {a.body && <p className="text-sm text-ink-700 mt-1">{a.body}</p>}
                  <div className="text-[11px] text-ink-500 mt-1">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => void store.update('announcements', a.id, { active: !a.active })}>{a.active ? 'Turn off' : 'Turn on'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => void store.remove('announcements', a.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ settings
export const AdminSettings: React.FC = () => {
  const { doc: site, ready } = useDoc('settings', 'site');
  const [form, setForm] = useState<SiteSettings>({ id: 'site', name: 'CI Connects', tagline: '', contactEmail: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (site) setForm(site); }, [site]);
  if (!ready) return <Spinner />;
  const save = async () => { setBusy(true); await store.set('settings', 'site', form); setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="The platform's name and voice." />
      <Card className="p-6 space-y-4">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tagline" hint="The first line on the front page."><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
        <Field label="Contact email" hint="Where people write when they expected to be on a list."><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
        <div className="flex items-center justify-end gap-2">{saved && <Notice tone="success" className="py-1.5">Saved</Notice>}<Button onClick={() => void save()} busy={busy}>Save</Button></div>
      </Card>
    </div>
  );
};
