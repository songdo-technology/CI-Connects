import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, MapPin, ArrowRight, Clock, ShieldCheck, Users, Megaphone, Settings, Sparkles, Mail } from 'lucide-react';
import { Event, Session } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useWatch, useDoc } from '../lib/hooks';
import { store } from '../lib/store';
import { isStaff, isAdmin, canSeeEvent } from '../lib/roles';
import { formatRange, formatDate, formatTime, eventPhase, daysUntil, todayYmd } from '../lib/time';
import { byStart } from '../lib/schedule';
import { Button, Card, Chip, Empty, Field, Input, Notice, Spinner, PageHeader } from '../components/ui';
import { AnnouncementBar } from '../components/layouts';
import { ROLE_LABEL } from '../lib/types';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/** My reserved sessions across the events I can see, soonest first. */
function useNextUp(events: Event[], uid: string | undefined) {
  const [byEvent, setByEvent] = useState<Record<string, Session[]>>({});
  const ids = events.map((e) => e.id).join('|');
  useEffect(() => {
    if (!uid) return;
    const offs = events.map((e) => store.watch('sessions', [{ field: 'eventId', op: '==', value: e.id }], (list) =>
      setByEvent((prev) => ({ ...prev, [e.id]: list.filter((s) => s.reservedUserIds.includes(uid)) }))));
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, uid]);
  return useMemo(() => Object.values(byEvent).flat().filter((s) => s.date >= todayYmd()).sort(byStart), [byEvent]);
}

export const Dashboard: React.FC = () => {
  const { profile, invitedEventIds } = useAuth();
  const staff = isStaff(profile);
  const published = useWatch('events', [{ field: 'status', op: '==', value: 'published' }], !staff);
  const all = useWatch('events', [], staff);
  const events = staff ? all.items : published.items;
  const ready = staff ? all.ready : published.ready;
  const mine = useMemo(() => events.filter((e) => canSeeEvent(profile, e.id, invitedEventIds)).sort((a, b) => a.startDate.localeCompare(b.startDate)), [events, profile, invitedEventIds]);
  const upcoming = mine.filter((e) => eventPhase(e.startDate, e.endDate) !== 'past');
  const nextUp = useNextUp(mine, profile?.id);
  const { doc: site } = useDoc('settings', 'site');
  if (!profile) return null;

  return (
    <div className="max-w-6xl mx-auto px-5 py-6 lg:py-8">
      <PageHeader eyebrow={formatDate(todayYmd())} title={`${greeting()}, ${profile.name.split(' ')[0]}`} description={staff ? `You run things here as ${ROLE_LABEL[profile.role].toLowerCase()}.` : undefined} />
      <AnnouncementBar eventId={null} />

      {staff && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { to: '/admin/events', icon: CalendarDays, t: 'Events', b: 'Create, publish, schedule' },
            ...(isAdmin(profile) ? [
              { to: '/admin/people', icon: Users, t: 'People', b: 'Roles and who is listed' },
              { to: '/admin/announcements', icon: Megaphone, t: 'Announcements', b: 'Banners for everyone' },
              { to: '/admin/settings', icon: Settings, t: 'Settings', b: 'Name, contact' },
            ] : [{ to: '/admin', icon: ShieldCheck, t: 'Administration', b: 'Your schedules' }]),
          ].map((x) => (
            <Link key={x.to} to={x.to} className="card p-4 hover:border-blue-300 transition-colors">
              <x.icon className="w-4 h-4 text-blue-400 mb-2" />
              <div className="font-semibold text-ink-900 text-sm">{x.t}</div>
              <div className="text-xs text-ink-500">{x.b}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-8">
        <section>
          <div className="eyebrow mb-3">Your events</div>
          {!ready ? <Spinner /> : upcoming.length === 0 ? (
            <Empty icon={CalendarDays} title="You are not on an event's list yet"
              body={`An organiser adds you to an event, and it appears here with its programme.${site?.contactEmail ? ` Ask ${site.contactEmail} if you expected one.` : ''}`}
              action={site?.contactEmail ? <a href={`mailto:${site.contactEmail}`} className="btn-secondary btn-sm"><Mail className="w-3.5 h-3.5" />Email the organisers</a> : undefined} />
          ) : (
            <div className="space-y-4">
              {upcoming.map((e) => {
                const phase = eventPhase(e.startDate, e.endDate);
                return (
                  <Link key={e.id} to={`/e/${e.slug}`} className="card overflow-hidden grid sm:grid-cols-[12rem_minmax(0,1fr)] hover:border-blue-300 transition-colors">
                    <div className="aspect-[16/9] sm:aspect-auto bg-sand-200"><img src={e.coverUrl} alt="" className="w-full h-full object-cover" /></div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-1.5">
                        {phase === 'live' ? <Chip tone="green">Happening now</Chip> : <Chip tone="blue">In {daysUntil(e.startDate)} days</Chip>}
                        {e.status === 'draft' && <Chip tone="amber">Draft</Chip>}
                      </div>
                      <div className="text-xl font-bold text-ink-900">{e.name}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-ink-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatRange(e.startDate, e.endDate)}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{e.venueName}</span>
                      </div>
                      <span className="btn-primary btn-sm mt-4 w-fit">Open<ArrowRight className="w-3.5 h-3.5" /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <div className="eyebrow mb-3">Next up for you</div>
          {nextUp.length === 0 ? (
            <Card className="p-5 text-sm text-ink-500">Seats you reserve show up here, soonest first.</Card>
          ) : (
            <div className="space-y-2">
              {nextUp.slice(0, 5).map((s) => {
                const e = mine.find((x) => x.id === s.eventId);
                return (
                  <Link key={s.id} to={`/e/${e?.slug}/schedule/${s.id}`} className="card p-3.5 block hover:border-blue-300 transition-colors">
                    <div className="text-[11px] text-ink-500 tabular-nums inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(s.date, { day: 'numeric', month: 'short' })} · {formatTime(s.start)}</div>
                    <div className="text-sm font-semibold text-ink-900 mt-0.5 leading-snug">{s.title}</div>
                    <div className="text-[11px] text-ink-500">{e?.name}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { realProfile, signOut } = useAuth();
  const [form, setForm] = useState({ name: '', org: '', title: '', dietary: '' });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (realProfile) setForm({ name: realProfile.name, org: realProfile.org ?? '', title: realProfile.title ?? '', dietary: realProfile.dietary ?? '' }); }, [realProfile]);
  if (!realProfile) return null;
  const save = async () => {
    setBusy(true);
    await store.update('users', realProfile.id, { name: form.name.trim() || realProfile.name, org: form.org.trim() || undefined, title: form.title.trim() || undefined, dietary: form.dietary.trim() || undefined });
    setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div className="max-w-2xl mx-auto px-5 py-6 lg:py-8">
      <PageHeader title="Your profile" description="What organisers and the kitchen see. Your sign-in address cannot be changed here." />
      <Card className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input value={realProfile.email} disabled /></Field>
          <Field label="School or organisation"><Input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} placeholder="Chadwick International" /></Field>
          <Field label="Role or title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Teacher of Mathematics" /></Field>
        </div>
        <Field label="Dietary requirements" hint="Passed to the kitchen for events with meals."><Input value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} placeholder="Vegetarian, no nuts…" /></Field>
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-xs text-ink-500 inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{ROLE_LABEL[realProfile.role]}</div>
          <div className="flex items-center gap-2">
            {saved && <Notice tone="success" className="py-1.5">Saved</Notice>}
            <Button onClick={() => void save()} busy={busy}>Save</Button>
          </div>
        </div>
      </Card>
      <div className="mt-6"><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></div>
    </div>
  );
};

export const NotFound: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center px-5">
    <Empty icon={CalendarDays} title="Nothing here" body="That address does not exist." action={<Button to="/">Home</Button>} />
  </div>
);
