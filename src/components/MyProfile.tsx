import React, { useMemo, useRef, useState } from 'react';
import { Presentation, Linkedin, Upload, Link2, Trash2, Check, FileText, Loader2, Mail, UserRound, Plus, EyeOff, MessageSquareOff, ScanLine, ListChecks } from 'lucide-react';
import { Session, UserProfile, SessionMaterial, Room } from '../types';
import { Field, inputClass, Notice } from './admin/formKit';
import { initialsAvatar } from '../lib/avatar';
import { profileGaps } from '../lib/profileCompleteness';
import { uploadSessionMaterial, materialKindFor, describeUploadProblem, uploadProfilePhoto } from '../lib/storage';
import { can } from '../lib/permissions';

interface MyProfileProps {
  currentUser: UserProfile;
  sessions: Session[];
  rooms: Room[];
  onSaveProfile: (patch: Partial<UserProfile>) => Promise<void> | void;
  /** Privacy toggles write immediately rather than waiting for Save — a
   *  person turning off messages expects that to take effect now. */
  onTogglePrivacy: (patch: Partial<UserProfile>) => Promise<void> | void;
  onSaveSession: (sessionId: string, patch: Partial<Session>) => Promise<void> | void;
  /** False when Firebase Storage is unavailable, e.g. the demo build. */
  uploadsEnabled: boolean;
}

/**
 * Everyone's own space.
 *
 * The platform is meant to run with as little day-to-day intervention from
 * organisers as possible, so anything a person can reasonably maintain about
 * themselves lives here rather than in an admin queue: their name, how they
 * are described, their links, and who may contact them.
 *
 * The speaker section appears only for people actually presenting something.
 * That scoping is repeated in the security rules — a speaker may edit a session
 * only when their uid appears in its speakerIds, and may not touch capacity,
 * room or reservations.
 *
 * Materials can be uploaded or linked. Linking matters as much as uploading:
 * most decks live in Slides or Canva and are better referenced than copied,
 * and a 60 MB Keynote export should not go into our bucket at all.
 */
export const MyProfile: React.FC<MyProfileProps> = ({
  currentUser, sessions, rooms, onSaveProfile, onTogglePrivacy, onSaveSession, uploadsEnabled,
}) => {
  const [profile, setProfile] = useState({
    fullName: currentUser.fullName,
    preferredName: currentUser.preferredName ?? '',
    title: currentUser.title,
    department: currentUser.department,
    organization: currentUser.organization,
    bio: currentUser.bio,
    linkedInUrl: currentUser.linkedInUrl ?? '',
    interests: (currentUser.interests ?? []).join(', '),
    socialLinks: currentUser.socialLinks ?? [],
  });
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(
    () => sessions
      .filter((s) => s.speakerIds.includes(currentUser.id))
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [sessions, currentUser.id],
  );

  const onPhoto = async (file: File) => {
    setPhotoBusy(true); setError(null);
    try {
      const url = await uploadProfilePhoto(currentUser.id, file);
      await onSaveProfile({ avatarUrl: url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const saveProfile = async () => {
    setProfileBusy(true); setError(null);
    try {
      await onSaveProfile({
        fullName: profile.fullName,
        preferredName: profile.preferredName.trim() || undefined,
        title: profile.title,
        department: profile.department,
        organization: profile.organization,
        bio: profile.bio,
        linkedInUrl: profile.linkedInUrl || undefined,
        interests: profile.interests.split(',').map((x) => x.trim()).filter(Boolean),
        socialLinks: profile.socialLinks.filter((l) => l.url.trim()),
        // A generated avatar follows a rename; a real photograph does not get
        // overwritten by one just because the name changed.
        ...(currentUser.avatarUrl.startsWith('data:')
          ? { avatarUrl: initialsAvatar(profile.preferredName.trim() || profile.fullName) }
          : {}),
        // Editing your own speaker page is the clearest possible signal that
        // the placeholder copy has been replaced.
        isPlaceholder: false,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  };

  const gaps = profileGaps(currentUser);

  return (
    <div className="space-y-5">
      {/* The same list the invitation email asks for. Shown until it is done,
          rather than dismissible: an organiser chasing five people for a
          photo the week of an event is exactly the work this replaces. */}
      {gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <ListChecks className="w-5 h-5 text-amber-700" />
            <h3 className="font-bold text-amber-900">
              {gaps.length === 1 ? 'One thing left' : `${gaps.length} things left`}
            </h3>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Everything below is seen by other people at the event. It takes a minute.
          </p>
          <ul className="space-y-1.5">
            {gaps.map((g) => (
              <li key={g.key} className="flex items-start gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                <span>
                  <span className="font-semibold text-amber-900">{g.label}</span>
                  <span className="text-amber-800"> — {g.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------- Profile ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <UserRound className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Your profile</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          This is what colleagues see in the directory, and — if you are
          presenting — what appears on the public event page and your badge.
        </p>

        <div className="flex items-start gap-5 mb-5">
          <img src={currentUser.avatarUrl} alt=""
               className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-200" />
          <div className="min-w-0 pt-0.5">
            <input
              ref={photoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }}
            />
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <button
                onClick={() => photoInput.current?.click()}
                disabled={photoBusy || !uploadsEnabled}
                title={uploadsEnabled ? undefined : 'Photo upload is unavailable in the demo build.'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {currentUser.avatarUrl.startsWith('data:') ? 'Add a photo' : 'Change photo'}
              </button>
              {!currentUser.avatarUrl.startsWith('data:') && (
                <button
                  onClick={() => onSaveProfile({
                    avatarUrl: initialsAvatar(profile.preferredName.trim() || profile.fullName),
                  })}
                  className="text-xs font-semibold text-slate-400 hover:text-amber-700 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              A clear, professional headshot — head and shoulders, plain background.
              It appears on your badge and in the directory. Without one we
              generate initials, which works but is less useful to someone trying
              to find you.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" hint="First and last name, as it should appear on records.">
              <input className={inputClass} value={profile.fullName}
                     onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                     placeholder="Alexandra Whitfield" />
            </Field>
            <Field label="Title" hint="How you are introduced.">
              <input className={inputClass} value={profile.title}
                     onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                     placeholder="Head of School" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Department">
              <input className={inputClass} value={profile.department}
                     onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
            </Field>
            <Field label="Organisation">
              <input className={inputClass} value={profile.organization}
                     onChange={(e) => setProfile({ ...profile, organization: e.target.value })} />
            </Field>
          </div>
          <Field
            label="Preferred name"
            hint="What you are actually called. This is printed large on your badge — leave it blank to use your first name."
          >
            <input className={inputClass} value={profile.preferredName}
                   onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })}
                   placeholder="Alex" />
          </Field>

          <Field label="Biography" hint="Two or three sentences reads best on the speaker card.">
            <textarea className={`${inputClass} resize-none`} rows={4} value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          </Field>
          <Field label="LinkedIn">
            <div className="relative">
              <Linkedin className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input className={`${inputClass} pl-10`} value={profile.linkedInUrl}
                     onChange={(e) => setProfile({ ...profile, linkedInUrl: e.target.value })}
                     placeholder="https://www.linkedin.com/in/…" />
            </div>
          </Field>
          <Field label="Interests" hint="Comma separated. Shown in the colleague directory.">
            <input className={inputClass} value={profile.interests}
                   onChange={(e) => setProfile({ ...profile, interests: e.target.value })} />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">Other links</label>
              <button
                onClick={() => setProfile({ ...profile,
                  socialLinks: [...profile.socialLinks, { label: '', url: '' }] })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-600 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add link
              </button>
            </div>
            <div className="space-y-2">
              {profile.socialLinks.length === 0 && (
                <p className="text-[11px] text-slate-400">
                  Personal site, X, Instagram, ORCID — anything you want colleagues to find.
                </p>
              )}
              {profile.socialLinks.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input className={`${inputClass} sm:w-40`} value={l.label} placeholder="Label"
                    onChange={(e) => setProfile({ ...profile, socialLinks: profile.socialLinks.map(
                      (x, xi) => xi === i ? { ...x, label: e.target.value } : x) })} />
                  <input className={inputClass} value={l.url} placeholder="https://"
                    onChange={(e) => setProfile({ ...profile, socialLinks: profile.socialLinks.map(
                      (x, xi) => xi === i ? { ...x, url: e.target.value } : x) })} />
                  <button
                    onClick={() => setProfile({ ...profile,
                      socialLinks: profile.socialLinks.filter((_, xi) => xi !== i) })}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-600 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Mail className="w-3.5 h-3.5" />
            {currentUser.email}
            <span className="text-slate-300">·</span>
            <span>Your email comes from your Chadwick account and cannot be edited here.</span>
          </div>

          {error && <Notice>{error}</Notice>}

          <div className="flex items-center gap-3">
            <button onClick={saveProfile} disabled={profileBusy}
                    className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
              {profileBusy ? 'Saving…' : 'Save profile'}
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check className="w-4 h-4" strokeWidth={3} /> Saved
              </span>
            )}
          </div>
        </div>
      </div>


      {/* ---------------- Privacy ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Privacy</h2>
        <p className="text-xs text-slate-500 mb-5">
          These take effect immediately. You can change them at any time, and
          nobody needs to approve it.
        </p>

        <div className="space-y-2.5">
          {([
            {
              key: 'isDirectoryVisible' as const,
              on: currentUser.isDirectoryVisible,
              icon: EyeOff,
              title: 'Show me in the colleague directory',
              onText: 'Colleagues can find you and see your profile.',
              offText: 'You are hidden from the directory. You can still browse and message others.',
            },
            {
              key: 'allowMessages' as const,
              on: currentUser.allowMessages !== false,
              icon: MessageSquareOff,
              title: 'Let colleagues message me',
              onText: 'Others can start a conversation with you in the platform.',
              offText: 'Nobody can start a new conversation with you.',
            },
            {
              key: 'shareContactOnScan' as const,
              on: currentUser.shareContactOnScan,
              icon: ScanLine,
              title: 'Share my contact details when my badge is scanned',
              onText: 'Scanning your badge shares your email and links, like a contact card.',
              offText: 'Your badge verifies who you are but shares no contact details.',
            },
          ]).map(({ key, on, icon: Icon, title, onText, offText }) => (
            <button
              key={key}
              onClick={() => onTogglePrivacy({ [key]: !on } as Partial<UserProfile>)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                on ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${on ? 'text-blue-600' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800">{title}</div>
                <div className="text-xs text-slate-500 leading-snug mt-0.5">
                  {on ? onText : offText}
                </div>
              </div>
              <span className={`shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors relative ${
                on ? 'bg-blue-600' : 'bg-slate-300'
              }`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  on ? 'left-5' : 'left-1'
                }`} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Sessions ---------------- */}
      {mine.length > 0 && (
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Presentation className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Your sessions</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Attach slides, handouts or a link to your presentation. Attendees see
          these on the session page.
        </p>

        <div className="space-y-4">
          {mine.map((s) => (
            <SessionMaterials
              key={s.id}
              session={s}
              room={rooms.find((r) => r.id === s.roomId)}
              currentUser={currentUser}
              uploadsEnabled={uploadsEnabled}
              onSave={onSaveSession}
            />
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const SessionMaterials: React.FC<{
  session: Session;
  room?: Room;
  currentUser: UserProfile;
  uploadsEnabled: boolean;
  onSave: (sessionId: string, patch: Partial<Session>) => Promise<void> | void;
}> = ({ session, room, currentUser, uploadsEnabled, onSave }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);

  const materials = session.materials ?? [];
  const mayUpload = can(currentUser, 'sessions:upload_materials');

  const commit = async (next: SessionMaterial[]) => {
    await onSave(session.id, { materials: next });
  };

  const onFile = async (file: File) => {
    setError(null);
    const problem = describeUploadProblem(file);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      const { url, sizeBytes } = await uploadSessionMaterial(session.id, file);
      await commit([...materials, {
        id: `mat-${Date.now()}`,
        name: file.name,
        url,
        kind: materialKindFor(file),
        addedBy: currentUser.id,
        addedAt: new Date().toLocaleDateString(),
        sizeBytes,
      }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addLink = async () => {
    if (!linkUrl.trim()) { setError('Paste the link to your presentation.'); return; }
    setError(null); setBusy(true);
    try {
      await commit([...materials, {
        id: `mat-${Date.now()}`,
        name: linkName.trim() || linkUrl.trim(),
        url: linkUrl.trim(),
        kind: 'link',
        addedBy: currentUser.id,
        addedAt: new Date().toLocaleDateString(),
      }]);
      setLinkName(''); setLinkUrl(''); setShowLink(false);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="text-sm font-bold text-slate-900 leading-snug">{session.title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Day {session.day} · {session.startTime}–{session.endTime} · {room?.name ?? 'Room TBC'}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {materials.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Nothing attached yet.</p>
        ) : materials.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200">
            {m.kind === 'link'
              ? <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
              : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
            <a href={m.url} target="_blank" rel="noopener noreferrer"
               className="min-w-0 flex-1 text-sm text-slate-800 hover:text-blue-700 truncate">
              {m.name}
            </a>
            <span className="text-[11px] text-slate-400 shrink-0">
              {m.sizeBytes ? `${(m.sizeBytes / 1024 / 1024).toFixed(1)} MB` : 'Link'} · {m.addedAt}
            </span>
            {m.addedBy === currentUser.id && (
              <button
                onClick={() => commit(materials.filter((x) => x.id !== m.id))}
                className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-600 shrink-0 cursor-pointer"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        ))}

        {error && <Notice>{error}</Notice>}

        {mayUpload && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".pdf,.ppt,.pptx,.key,.odp,image/png,image/jpeg"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy || !uploadsEnabled}
              title={uploadsEnabled ? undefined : 'File storage is unavailable in the demo build.'}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload slides
            </button>
            <button
              onClick={() => setShowLink((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              Add a link
            </button>
            <span className="text-[11px] text-slate-400">PDF, PowerPoint or image, up to 25 MB.</span>
          </div>
        )}

        {showLink && (
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <Field label="Link name" hint="What attendees will see.">
              <input className={inputClass} value={linkName}
                     onChange={(e) => setLinkName(e.target.value)}
                     placeholder="Presentation slides" />
            </Field>
            <Field label="URL">
              <input className={inputClass} value={linkUrl}
                     onChange={(e) => setLinkUrl(e.target.value)}
                     placeholder="https://docs.google.com/presentation/…" />
            </Field>
            <button onClick={addLink} disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              Attach link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
