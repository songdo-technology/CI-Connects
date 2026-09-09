import React, { useState, useMemo, useEffect } from 'react';
// Only the event catalogue is still read directly; every other collection
// now arrives through the store.
import { EVENT_CONFIG, EVENTS } from './data/initialData';
import {
  ActiveTab,
  Session,
  UserProfile,
  Track,
  Room,
  CommunityTopic,
  BroadcastAnnouncement,
  AttendanceRecord,
  FeedbackEntry,
  AuthSession,
  AuthMethod,
  UserRole,
  EventConfig,
} from './types';
import { Header } from './components/Header';
import { AgendaView } from './components/AgendaView';
import { SessionModal } from './components/SessionModal';
import { DigitalBadge } from './components/DigitalBadge';
import { CheckInScanner } from './components/CheckInScanner';
import { DirectoryView } from './components/DirectoryView';
import { CommunityBoard } from './components/CommunityBoard';
import { LuckyDraw } from './components/LuckyDraw';
import { AdminConsole } from './components/AdminConsole';
import { ArchitectureGuideModal } from './components/ArchitectureGuideModal';
import { MobileAppFrame } from './components/MobileAppFrame';
import { PublicEventPage } from './components/PublicEventPage';
import { LandingPage } from './components/LandingPage';
import { DiningView } from './components/DiningView';
import { MessagesView } from './components/MessagesView';
import { DoorScanner } from './components/DoorScanner';
import { ContactCardModal } from './components/ContactCardModal';
import { PrintableBadge } from './components/PrintableBadge';
import { RoomSignage } from './components/RoomSignage';
import { EventsHub } from './components/EventsHub';
import { useData } from './lib/data/DataProvider';
import { FirstRunSetup } from './components/FirstRunSetup';
import { useAuth } from './lib/AuthProvider';
import { AdminPanel } from './components/admin/AdminPanel';
import { MyProfile } from './components/MyProfile';
import { GuestLinkReturn } from './components/GuestLinkReturn';
import { can } from './lib/permissions';
import { profileGaps } from './lib/profileCompleteness';
import { takeSignInIntent, hasSignInIntent, clearSignInIntent } from './lib/signInIntent';
import { isGuestLinkInUrl } from './lib/auth';
import { FeedbackView } from './components/FeedbackView';
import { SignageDirectory } from './components/SignageDirectory';
import { ProposeSession } from './components/ProposeSession';
import { AdminDashboard } from './components/AdminDashboard';

/** The public surfaces of the product: a hub listing every event Chadwick
 *  runs, one page per event, a sign-in gate, and the attendee portal behind
 *  it. Signage resolves ahead of all of them, straight from the URL. */
type Surface = 'hub' | 'event' | 'signin' | 'portal' | 'dashboard';

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  // All application data comes from the store. Nothing below keeps a local
  // copy: every mutation writes, and the screen updates when the subscription
  // delivers the result. That is what makes the Firestore swap a one-line
  // change in main.tsx rather than a rewrite of this file.
  const {
    users: allUsers,
    events,
    sessions,
    tracks,
    rooms,
    sponsors,
    mealServices,
    announcements,
    communityTopics,
    attendance,
    messages,
    feedback,
    prizes,
    costs,
    invites,
    create,
    update,
    remove,
    batch,
    ready,
    isRemote,
    store,
  } = useData();

  /**
   * Every event the platform knows about.
   *
   * Live records win. The seed constants are the fallback only for the design
   * preview and for the first paint, before the first snapshot lands —
   * otherwise an event created or edited in the admin panel would never reach
   * the public hub, the calendar, or an invitation's /?event= link, because
   * those would still be reading a compiled-in copy of the original data.
   */
  const allEvents = events.length > 0 ? events : EVENTS;

  // Auth & surface routing
  /** Read once from the URL so /?event=<slug> is a real, shareable address
   *  rather than only an in-app transition. The slug is not checked against a
   *  list here: at first paint the store has answered nothing, so every slug
   *  would look unknown. It is resolved below, once the data is in. */
  const initialEventSlug = new URLSearchParams(window.location.search).get('event');

  const [surface, setSurface] = useState<Surface>(initialEventSlug ? 'event' : 'hub');
  /** Where the visitor was when they chose to sign in.
   *
   *  Leaving the sign-in screen used to go to the flagship event's page
   *  whenever that event had a portal — so anyone arriving from the hub was
   *  quietly moved somewhere they had not been. Back means back. */
  const [returnSurface, setReturnSurface] = useState<'hub' | 'event'>('hub');
  /** Which event the public pages and the portal are scoped to. */
  const [activeEventSlug, setActiveEventSlug] = useState<string>(
    initialEventSlug ?? EVENT_CONFIG.slug,
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  /**
   * Somebody is on their way into the portal and has not arrived yet.
   *
   * True from the moment they choose to sign in, and on a cold load when the
   * page is the tail end of a redirect or an emailed link. It stays true until
   * they are actually in, so the hand-off no longer depends on a single
   * storage read landing in the one effect pass where everything happens to be
   * ready — the failure that put people on the sign-in screen and was undone
   * by pressing reload.
   */
  const [enteringPortal, setEnteringPortal] = useState(
    () => hasSignInIntent() || isGuestLinkInUrl(),
  );
  const auth = useAuth();

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<Session | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDoorScannerOpen, setIsDoorScannerOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isPrintBadgeOpen, setIsPrintBadgeOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  /** Set when the panel is opened for a specific job rather than to browse. */
  const [adminIntent, setAdminIntent] = useState<'events-new' | undefined>(undefined);
  /** Lets a technical admin view the app as another role. Affects only what
   *  this browser renders — the security rules still see the real account, so
   *  previewing a lower role cannot be used to escape one. */
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [contactCardProfile, setContactCardProfile] = useState<UserProfile | null>(null);
  const [pendingThreadUserId, setPendingThreadUserId] = useState<string | null>(null);

  const activeEvent = useMemo(
    () => allEvents.find(e => e.slug === activeEventSlug)
      ?? allEvents.find(e => e.isFeatured)
      ?? allEvents[0]
      ?? EVENT_CONFIG,
    [allEvents, activeEventSlug],
  );

  /** Sessions belonging to the active event. Only the flagship has a
   *  programme today; other events render as landing pages. */
  const eventSessions = useMemo(
    () => sessions.filter(s => s.eventId === activeEvent.id),
    [sessions, activeEvent.id],
  );

  /** Keeps the address bar in step with the surface, so a visitor can copy the
   *  URL of the event they are looking at and it opens there. */
  const syncUrl = (slug: string | null) => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('event', slug);
    else url.searchParams.delete('event');
    window.history.replaceState({}, '', url.toString());
  };

  const openEvent = (slug: string) => {
    setActiveEventSlug(slug);
    setSurface('event');
    syncUrl(slug);
    window.scrollTo(0, 0);
  };

  /**
   * A link to an event that no longer exists lands on the hub.
   *
   * Judged only once the store has answered: before that, every slug looks
   * unknown and this would bounce a perfectly good link. Without it, a stale
   * invitation would quietly open a *different* event — the featured one —
   * which is worse than an honest "here is everything on".
   */
  useEffect(() => {
    if (!ready || surface !== 'event' || allEvents.length === 0) return;
    if (allEvents.some(e => e.slug === activeEventSlug)) return;
    setSurface('hub');
    syncUrl(null);
  }, [ready, surface, allEvents, activeEventSlug]);

  const openSignIn = () => {
    if (surface === 'hub' || surface === 'event') setReturnSurface(surface);
    setEnteringPortal(true);
    setSurface('signin');
  };

  const openHub = () => {
    setSurface('hub');
    syncUrl(null);
    window.scrollTo(0, 0);
  };

  /** The signed-in user, resolved from the auth session rather than held
   *  separately, so there is exactly one source of truth for identity. */
  /** Undefined until the store delivers. The render gate below gives every
   *  consumer a non-null value; only the memos above it must guard. */
  const currentUser: UserProfile | undefined = useMemo(
    () => allUsers.find((u) => u.id === authSession?.userId) ?? allUsers[0],
    [allUsers, authSession],
  );
  const currentUserId = currentUser?.id;

  /** The identity the interface renders against. Distinct from the real
   *  account, which is what every write is still performed as. */
  const viewUser: UserProfile | undefined = useMemo(
    () => (currentUser && previewRole ? { ...currentUser, role: previewRole } : currentUser),
    [currentUser, previewRole],
  );

  /**
   * Mirrors the Firebase session into the app's own session.
   *
   * Without this, signing in with Google succeeds at the identity provider and
   * then appears to do nothing: the persona-based `authSession` stays null, so
   * the surface never leaves the public hub. Waits for `profileReady` because
   * the portal reads a role, and the role lives in the Firestore profile that
   * is written just after sign-in.
   *
   * Entering the portal cannot be decided by looking at the current surface
   * alone. That works for a popup, which returns to the same React tree, but
   * `signInWithRedirect` comes back to a cold load where the surface has
   * re-initialised to the hub — so the visitor arrives signed in and stares at
   * the public front page. The stored intent survives that trip; an emailed
   * guest link is the same trip and counts as the same intent.
   */
  useEffect(() => {
    if (!auth.live) return;
    if (auth.status === 'signed_in' && auth.profileReady && auth.firebaseUser) {
      setAuthSession((current) =>
        current?.userId === auth.firebaseUser!.uid
          ? current
          : { userId: auth.firebaseUser!.uid, method: 'google_sso', signedInAt: now() },
      );

      const intent = takeSignInIntent();
      if (intent?.eventSlug) setActiveEventSlug(intent.eventSlug);
      // Running the platform is a different job from attending an event on it.
      // Sending an organiser into a conference portal — necessarily one
      // specific conference — was why signing in always landed on the sample
      // flagship, and why there appeared to be no administration at all.
      const home = homeSurfaceFor(currentUser, Boolean(intent?.eventSlug));
      setSurface((s) => (s === 'signin' || enteringPortal ? home : s));
      setEnteringPortal(false);
    }
    if (auth.status === 'signed_out') {
      setAuthSession(null);
    }
  }, [auth.live, auth.status, auth.profileReady, auth.firebaseUser, enteringPortal]);

  /**
   * A sign-in that Firebase has finished deciding on, and decided against.
   *
   * Only judged once `settled` is true, because a signed-out status before
   * that is provisional. Clearing the marker here stops the message following
   * the visitor into their next visit.
   */
  useEffect(() => {
    if (!auth.live || !auth.settled || !enteringPortal) return;
    if (auth.status !== 'signed_out') return;
    setEnteringPortal(false);
    clearSignInIntent();
  }, [auth.live, auth.settled, auth.status, enteringPortal]);

  // ---------------------------------------------------------------- Auth

  /**
   * Where a person belongs once they are in.
   *
   * One rule, used by both sign-in paths. When the Firebase route and the
   * demo route each decided this for themselves they drifted apart, and the
   * demo build kept sending organisers into a conference portal after the
   * live one had stopped.
   */
  const homeSurfaceFor = (user: UserProfile, eventInMind: boolean): Surface =>
    (can(user, 'events:create') && !eventInMind ? 'dashboard' : 'portal');

  const handleSignIn = (user: UserProfile, method: AuthMethod) => {
    setAuthSession({ userId: user.id, method, signedInAt: now() });
    setActiveTab('agenda');
    setSurface(homeSurfaceFor(user, Boolean(takeSignInIntent()?.eventSlug)));
  };

  const handleSignOut = () => {
    if (auth.live) void auth.signOut();
    setAuthSession(null);
    // Back to the hub rather than the event page: signing out is a step away
    // from this event, not deeper into it.
    openHub();
  };

  // Atomic Capacity Reservation & Waitlist Procedure
  const handleToggleReservation = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { success: false, message: 'Session not found.' };

    const isReserved = session.reservedUserIds.includes(currentUser.id);
    const isWaitlisted = session.waitlistUserIds.includes(currentUser.id);

    if (isReserved) {
      // Cancel reservation & atomically promote first waitlisted attendee
      let nextWaitlist = [...session.waitlistUserIds];
      let nextReserved = session.reservedUserIds.filter(id => id !== currentUser.id);

      if (nextWaitlist.length > 0) {
        const promotedUser = nextWaitlist.shift()!;
        nextReserved.push(promotedUser);
      }

      update('sessions', sessionId, {
        reservedUserIds: nextReserved,
        waitlistUserIds: nextWaitlist,
      });

      return { success: true, message: `Reservation cancelled for "${session.title}".` };
    } else if (isWaitlisted) {
      // Remove from waitlist
      update('sessions', sessionId, {
        waitlistUserIds: session.waitlistUserIds.filter(id => id !== currentUser.id),
      });
      return { success: true, message: `Removed from waitlist for "${session.title}".` };
    } else {
      // Attempt atomic reservation
      if (session.reservedUserIds.length < session.maxAttendees) {
        update('sessions', sessionId, {
          reservedUserIds: [...session.reservedUserIds, currentUser.id],
        });
        const roomName = rooms.find(r => r.id === session.roomId)?.name || 'Venue';
        return { success: true, message: `Seat confirmed for "${session.title}" in ${roomName}.` };
      } else {
        // Over capacity: place on atomic waitlist
        update('sessions', sessionId, {
          waitlistUserIds: [...session.waitlistUserIds, currentUser.id],
        });
        return {
          success: true,
          message: `Room capacity full (${session.maxAttendees} seats). Added to waitlist (#${session.waitlistUserIds.length + 1}).`,
          waitlisted: true
        };
      }
    }
  };

  // Check-In toggle handler
  const handleToggleCheckIn = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    const nextStatus = !user.checkedIn;
    update('users', userId, {
      checkedIn: nextStatus,
      checkedInAt: nextStatus ? now() : undefined,
    });
  };

  // Directory Privacy Toggle for active user
  const handleToggleDirectoryVisibility = () => {
    update('users', currentUser.id, { isDirectoryVisible: !currentUser.isDirectoryVisible });
  };

  /** Opt in or out of handing over contact details when the badge is scanned. */
  const handleToggleContactSharing = () => {
    update('users', currentUser.id, { shareContactOnScan: !currentUser.shareContactOnScan });
  };

  // ------------------------------------------------------------- Dining
  const handleSelectMeal = (serviceId: string, optionId: string | null) => {
    const service = mealServices.find(s => s.id === serviceId);
    if (!service) return;
    const selections = { ...service.selections };
    if (optionId === null) delete selections[currentUser.id];
    else selections[currentUser.id] = optionId;
    update('mealServices', serviceId, { selections });
  };

  // --------------------------------------------------------- Attendance
  /**
   * Records a door scan. The status is derived, not chosen: a scan is
   * `verified` only when the attendee actually holds a reservation for the
   * session whose door they are standing at. Anyone reserved for a different
   * session running at the same time is recorded as `wrong_session` rather
   * than being silently admitted, which is what makes the resulting log
   * usable as evidence of attendance.
   */
  const handleRecordAttendance = (userId: string, sessionId: string): AttendanceRecord => {
    const session = sessions.find(s => s.id === sessionId);
    const room = rooms.find(r => r.id === session?.roomId);
    const isReservedHere = session?.reservedUserIds.includes(userId) ?? false;

    const clashesElsewhere = sessions.some(s =>
      s.id !== sessionId &&
      s.day === session?.day &&
      s.reservedUserIds.includes(userId) &&
      s.startMinutes < (session?.endMinutes ?? 0) &&
      s.endMinutes > (session?.startMinutes ?? 0)
    );

    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      userId,
      sessionId,
      scannedAt: now(),
      location: room ? `${room.name} (${room.floorLabel})` : 'Unknown location',
      status: isReservedHere ? 'verified' : clashesElsewhere ? 'wrong_session' : 'walk_in',
      scannedBy: currentUser.id,
    };

    // One batch: a scan that recorded attendance but failed to admit the
    // person would leave the door staff looking at a contradiction.
    const scanned = allUsers.find(u => u.id === userId);
    batch([
      { op: 'create', key: 'attendance', item: record },
      ...(scanned && !scanned.checkedIn
        ? [{ op: 'update' as const, key: 'users' as const, id: userId,
             patch: { checkedIn: true, checkedInAt: record.scannedAt } }]
        : []),
    ]);

    return record;
  };

  // ----------------------------------------------------------- Messaging
  const handleSendMessage = (toUserId: string, content: string) => {
    create('messages', {
      id: `msg-${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId,
      content,
      createdAt: 'Just now',
      read: false,
    });
  };

  const handleMarkRead = (fromUserId: string) => {
    const unread = messages.filter(
      m => m.fromUserId === fromUserId && m.toUserId === currentUser.id && !m.read,
    );
    if (unread.length === 0) return;
    batch(unread.map(m => ({
      op: 'update' as const, key: 'messages' as const, id: m.id, patch: { read: true },
    })));
  };

  const handleOpenThread = (userId: string) => {
    setPendingThreadUserId(userId);
    setActiveTab('messages');
  };

  // -------------------------------------------------- Administration
  const handleChangeRole = async (userId: string, role: UserRole) => {
    await update('users', userId, { role });
  };

  const handleSaveEvent = async (event: EventConfig, isNew: boolean) => {
    // Ownership is stamped on creation and never rewritten: reassigning an
    // event by editing it would be a silent transfer of control.
    if (isNew) await create('events', { ...event, ownerId: event.ownerId || currentUser.id });
    else await update('events', event.id, event);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await remove('events', eventId);
  };

  /** Save helper shared by the programme, room, dining and sponsor editors. */
  const saver = <K extends 'sessions' | 'rooms' | 'mealServices' | 'sponsors' | 'prizes' | 'costs' | 'invites'>(key: K) =>
    async (item: { id: string }, isNew: boolean) => {
      if (isNew) await create(key, item as never);
      else await update(key, item.id, item as never);
    };
  const remover = (key: 'sessions' | 'rooms' | 'mealServices' | 'sponsors' | 'prizes' | 'costs' | 'invites') =>
    async (id: string) => { await remove(key, id); };

  /** A person editing their own profile, from My Profile. */
  const handleSaveOwnProfile = async (patch: Partial<UserProfile>) => {
    await update('users', currentUser.id, patch);
  };

  /** A speaker attaching materials to a session they present. */
  const handleSaveOwnSession = async (sessionId: string, patch: Partial<Session>) => {
    await update('sessions', sessionId, patch);
  };

  // ------------------------------------------------------- Feedback
  const handleSubmitFeedback = (
    entry: Omit<FeedbackEntry, 'id' | 'userId' | 'submittedAt'>,
  ) => {
    create('feedback', {
      ...entry,
      id: `fb-${Date.now()}`,
      userId: currentUser.id,
      submittedAt: new Date().toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    });
  };

  // Community Topic Handlers
  const handleAddTopic = (newTopicData: Omit<CommunityTopic, 'id' | 'createdAt' | 'likesCount' | 'replies' | 'rsvpUserIds'>) => {
    const newTopic: CommunityTopic = {
      ...newTopicData,
      id: `topic-${Date.now()}`,
      createdAt: 'Just now',
      likesCount: 1,
      replies: [],
      rsvpUserIds: newTopicData.category === 'Informal Meetups' ? [currentUser.id] : [],
    };
    create('communityTopics', newTopic);
  };

  const handleToggleRsvp = (topicId: string) => {
    const topic = communityTopics.find(x => x.id === topicId);
    if (!topic) return;
    const isRsvped = topic.rsvpUserIds.includes(currentUser.id);
    update('communityTopics', topicId, {
      rsvpUserIds: isRsvped
        ? topic.rsvpUserIds.filter(id => id !== currentUser.id)
        : [...topic.rsvpUserIds, currentUser.id],
    });
  };

  const handleAddReply = (topicId: string, replyText: string) => {
    const topic = communityTopics.find(x => x.id === topicId);
    if (!topic) return;
    update('communityTopics', topicId, {
      replies: [
        ...topic.replies,
            {
              id: `rep-${Date.now()}`,
              authorName: currentUser.fullName,
              authorAvatar: currentUser.avatarUrl,
              authorDepartment: currentUser.department,
              content: replyText,
              createdAt: 'Just now',
            },
      ],
    });
  };

  const handleToggleLike = (topicId: string) => {
    const topic = communityTopics.find(x => x.id === topicId);
    if (!topic) return;
    update('communityTopics', topicId, { likesCount: topic.likesCount + 1 });
  };

  // Emergency Broadcast Broadcaster
  const handleBroadcastAnnouncement = (title: string, message: string, priority: 'normal' | 'urgent') => {
    const newAnn: BroadcastAnnouncement = {
      id: `ann-${Date.now()}`,
      title,
      message,
      priority,
      timestamp: 'Just now',
      active: true,
    };
    create('announcements', newAnn);
  };

  // CSV Batch Ingestion Handler
  const handleImportCsvSessions = (
    newSessions: Session[],
    newTracks: Track[],
    newRooms: Room[],
    newProfiles: UserProfile[]
  ) => {
    // A spreadsheet import is one action from the organiser's point of view,
    // so it lands as one batch rather than four partial writes.
    batch([
      ...newTracks.map(x => ({ op: 'create' as const, key: 'tracks' as const, item: x })),
      ...newRooms.map(x => ({ op: 'create' as const, key: 'rooms' as const, item: x })),
      ...newProfiles.map(x => ({ op: 'create' as const, key: 'users' as const, item: x })),
      ...newSessions.map(x => ({ op: 'create' as const, key: 'sessions' as const, item: x })),
    ]);

    return {
      insertedSessionsCount: newSessions.length,
      updatedSessionsCount: 0,
      roomsCount: newRooms.length,
      tracksCount: newTracks.length,
    };
  };

  // Switch Active Persona (prototype affordance, not a real auth action)
  const handleSwitchUser = (user: UserProfile) => {
    setAuthSession({ userId: user.id, method: 'google_sso', signedInAt: now() });
  };

  // Active bookmarked sessions count for user
  const bookmarkedSessionsCount = useMemo(() => {
    return sessions.filter(s => currentUserId && s.reservedUserIds.includes(currentUserId)).length;
  }, [sessions, currentUserId]);

  const reservedSessionsForUser = useMemo(() => {
    return sessions.filter(s => currentUserId && s.reservedUserIds.includes(currentUserId));
  }, [sessions, currentUserId]);

  const unreadMessageCount = useMemo(
    () => messages.filter(m => m.toUserId === currentUserId && !m.read).length,
    [messages, currentUserId],
  );

  const myMealSelections = useMemo(
    () => mealServices
      .filter(s => currentUserId && s.selections[currentUserId])
      .map(s => ({
        service: s,
        option: s.options.find(o => o.id === s.selections[currentUserId!])!,
      }))
      .filter(x => x.option),
    [mealServices, currentUserId],
  );

  const myAttendance = useMemo(
    () => attendance.filter(a => a.userId === currentUserId),
    [attendance, currentUserId],
  );

  // An empty Firestore is indistinguishable from a loading one to everything
  // below, so the first run is handled explicitly rather than left to hang on
  // the loading gate.
  //
  // Emptiness is judged by `events`, not by `users`. Signing in provisions a
  // user document, so the moment anyone authenticated the users collection was
  // non-empty and this screen hid itself — leaving the app pointed at a
  // catalogue with nothing in it. Only seeding creates events.
  //
  // ?setup=1 reopens it deliberately, so an administrator can reach the seeder
  // once data exists without having to empty the database first.
  const setupRequested = new URLSearchParams(window.location.search).get('setup') === '1';
  if (isRemote && ready && (events.length === 0 || setupRequested)) {
    return <FirstRunSetup store={store} onDone={() => { window.location.search = ''; }} />;
  }

  // Gate placed after every hook: returning earlier would change the hook
  // count between the loading and loaded renders, which React rejects.
  // Subscriptions attach in an effect, so the first render has empty
  // collections. Everything below assumes data is present — currentUser falls
  // back to allUsers[0] — so hold rendering until the store has delivered.
  // This is not a workaround for the in-memory store: Firestore has the same
  // shape, only slower, so the gate has to exist either way.
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-slate-500">Loading CI Connects…</p>
        </div>
      </div>
    );
  }

  // Coming back from Google, the identity resolves a beat after the data does.
  // Without this the public hub paints first and is then replaced by the
  // portal — which looks exactly like the bug where sign-in dumped you on the
  // front page, so it is worth the extra gate.
  // Hold the screen while a sign-in is still in flight. Releasing on the first
  // signed-out answer painted the sign-in form over a session that was about
  // to arrive — the bug a reload appeared to fix.
  if (enteringPortal && auth.live && !auth.error
      && (!auth.settled || auth.status === 'signed_in')
      && !(auth.status === 'signed_in' && auth.profileReady)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-slate-500">Signing you in…</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------- Surface: guest sign-in link
  // A returning sign-in link carries credentials in the URL and must be
  // redeemed before any other surface renders a form.
  if (auth.guestLinkPending) return <GuestLinkReturn />;

  // ------------------------------------------------------ Surface: signage
  // Read straight from the URL rather than from state: a CI Vision Live Cast
  // opens a bare URL with no way to click through an app shell, so the display
  // has to resolve from the address alone and stay put.
  const params = new URLSearchParams(window.location.search);
  const signageParam = params.get('signage');

  if (signageParam) {
    if (signageParam === 'index') {
      return <SignageDirectory event={activeEvent} rooms={rooms} sessions={sessions} />;
    }
    const signageRoom = rooms.find(r => r.id === signageParam);
    if (signageRoom) {
      // Optional ?t=HH:MM previews any moment of the programme without
      // waiting for the real clock to reach it.
      const tParam = params.get('t');
      const simulated = tParam && /^\d{1,2}:\d{2}$/.test(tParam)
        ? Number(tParam.split(':')[0]) * 60 + Number(tParam.split(':')[1])
        : null;
      return (
        <RoomSignage
          event={activeEvent}
          room={signageRoom}
          sessions={sessions}
          tracks={tracks}
          profiles={allUsers}
          sponsors={sponsors}
          simulatedMinutes={simulated}
        />
      );
    }
  }

  // ------------------------------------------------- Surface: admin panel
  if (isAdminPanelOpen && can(viewUser, 'events:create')) {
    return (
      <AdminPanel
        currentUser={viewUser}
        users={allUsers}
        events={events}
        counts={{
          users: allUsers.length, events: events.length, sessions: sessions.length,
          tracks: tracks.length, rooms: rooms.length, sponsors: sponsors.length,
          mealServices: mealServices.length, announcements: announcements.length,
          communityTopics: communityTopics.length, attendance: attendance.length,
          messages: messages.length, feedback: feedback.length,
          prizes: prizes.length, costs: costs.length, invites: invites.length,
        }}
        isRemote={isRemote}
        onClose={() => { setIsAdminPanelOpen(false); setAdminIntent(undefined); }}
        sessions={sessions}
        tracks={tracks}
        rooms={rooms}
        mealServices={mealServices}
        sponsors={sponsors}
        onChangeRole={handleChangeRole}
        onSaveEvent={handleSaveEvent}
        onDeleteEvent={handleDeleteEvent}
        onSaveSession={saver('sessions')}
        onDeleteSession={remover('sessions')}
        onSaveRoom={saver('rooms')}
        onDeleteRoom={remover('rooms')}
        onSaveMeal={saver('mealServices')}
        onDeleteMeal={remover('mealServices')}
        onSaveSponsor={saver('sponsors')}
        onDeleteSponsor={remover('sponsors')}
        prizes={prizes}
        costs={costs}
        onSavePrize={saver('prizes')}
        onDeletePrize={remover('prizes')}
        onSaveCost={saver('costs')}
        onDeleteCost={remover('costs')}
        invites={invites}
        attendance={attendance}
        onBulkImport={(ops) => batch(ops)}
        openTo={adminIntent}
        communityTopics={communityTopics}
        messages={messages}
        feedback={feedback}
        announcements={announcements}
        onSaveInvite={saver('invites')}
        onDeleteInvite={remover('invites')}
      />
    );
  }

  // ------------------------------------------------- Surface: dashboard
  if (surface === 'dashboard' && authSession && can(viewUser, 'events:create')) {
    return (
      <>
        <AdminDashboard
          currentUser={viewUser}
          events={allEvents}
          sessions={sessions}
          rooms={rooms}
          users={allUsers}
          invites={invites}
          attendance={attendance}
          isTechnical={can(viewUser, 'integrations:manage')}
          isRemote={isRemote}
          onOpenAdmin={(section) => { setAdminIntent(section); setIsAdminPanelOpen(true); }}
          onOpenEventPortal={(slug) => {
            setActiveEventSlug(slug);
            setActiveTab('agenda');
            setSurface('portal');
            syncUrl(slug);
          }}
          onOpenPublicPage={openEvent}
          onOpenHub={openHub}
          onSignOut={handleSignOut}
        />
        {isAdminPanelOpen && (
          <AdminPanel
            currentUser={viewUser} users={allUsers} events={events} sessions={sessions}
            tracks={tracks} rooms={rooms} mealServices={mealServices} sponsors={sponsors}
            prizes={prizes} costs={costs} invites={invites} attendance={attendance}
            counts={{ users: allUsers.length, events: events.length, sessions: sessions.length,
                      rooms: rooms.length, sponsors: sponsors.length }}
            isRemote={isRemote}
            onClose={() => { setIsAdminPanelOpen(false); setAdminIntent(undefined); }}
            onChangeRole={handleChangeRole}
            onSaveEvent={handleSaveEvent} onDeleteEvent={handleDeleteEvent}
            onSaveSession={saver('sessions')} onDeleteSession={remover('sessions')}
            onSaveRoom={saver('rooms')} onDeleteRoom={remover('rooms')}
            onSaveMeal={saver('mealServices')} onDeleteMeal={remover('mealServices')}
            onSaveSponsor={saver('sponsors')} onDeleteSponsor={remover('sponsors')}
            onSavePrize={saver('prizes')} onDeletePrize={remover('prizes')}
            onSaveCost={saver('costs')} onDeleteCost={remover('costs')}
            onBulkImport={(ops) => batch(ops)} openTo={adminIntent}
            communityTopics={communityTopics} messages={messages}
            feedback={feedback} announcements={announcements}
            onSaveInvite={saver('invites')} onDeleteInvite={remover('invites')}
          />
        )}
      </>
    );
  }

  // ------------------------------------------------------- Surface: hub
  if (surface === 'hub') {
    return (
      <EventsHub
        events={allEvents}
        sessions={sessions}
        signedInAs={authSession ? currentUser : null}
        isOrganiser={Boolean(authSession) && can(currentUser, 'events:create')}
        onOpenPortal={() => {
          // Straight to what they manage. An organiser arriving from the front
          // page is going to work, not browsing the catalogue they just left.
          setAdminIntent(undefined);
          if (can(currentUser, 'events:create')) setIsAdminPanelOpen(true);
          setSurface('portal');
        }}
        onCreateEvent={() => {
          setAdminIntent('events-new');
          setIsAdminPanelOpen(true);
          setSurface('portal');
        }}
        onSignOut={handleSignOut}
        onOpenEvent={openEvent}
        onRegister={(slug) => {
          // Remember which event before leaving for Google: the redirect comes
          // back to a cold load with none of this state, and landing on the
          // featured event instead of the one they chose is the whole problem.
          setActiveEventSlug(slug);
          syncUrl(slug);
          setReturnSurface('hub');
          setEnteringPortal(true);
          setSurface('signin');
        }}
        onSignIn={openSignIn}
      />
    );
  }

  // ------------------------------------------------ Surface: one event
  if (surface === 'event') {
    return (
      <PublicEventPage
        event={activeEvent}
        sessions={eventSessions}
        tracks={tracks}
        rooms={rooms}
        profiles={allUsers}
        sponsors={sponsors}
        onSignIn={openSignIn}
        onBackToEvents={openHub}
      />
    );
  }

  // ---------------------------------------------------- Surface: sign-in
  if (surface === 'signin' || !authSession) {
    return (
      <LandingPage
        profiles={allUsers}
        onSignIn={handleSignIn}
        onBack={() => setSurface(returnSurface)}
        backLabel={returnSurface === 'event' ? activeEvent.shortName : 'all events'}
      />
    );
  }

  // Everything below is the authenticated portal, which reads a role and a
  // profile. Anonymous visitors never reach here — the public surfaces above
  // return first — but a signed-in user whose profile has not yet arrived
  // would, so hold rather than render against a missing user.
  if (!viewUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-slate-500">Preparing your profile…</p>
        </div>
      </div>
    );
  }

  // Main Active Content
  const mainContent = (
    <>
      {activeTab === 'agenda' && (
        <AgendaView
          sessions={sessions}
          tracks={tracks}
          rooms={rooms}
          sponsors={sponsors}
          profiles={allUsers}
          currentUser={viewUser}
          onToggleReservation={handleToggleReservation}
          onSelectSession={(session) => setSelectedSessionForModal(session)}
        />
      )}

      {activeTab === 'badge' && (
        <DigitalBadge
          currentUser={viewUser}
          onToggleCheckIn={handleToggleCheckIn}
          reservedSessions={reservedSessionsForUser}
          onOpenScanner={() => setIsScannerOpen(true)}
          mealSelections={myMealSelections}
          attendanceRecords={myAttendance}
          sessions={sessions}
          onToggleContactSharing={handleToggleContactSharing}
          onOpenDoorScanner={() => setIsDoorScannerOpen(true)}
          onOpenPrintBadge={() => setIsPrintBadgeOpen(true)}
        />
      )}

      {activeTab === 'dining' && (
        <DiningView
          mealServices={mealServices}
          currentUser={viewUser}
          onSelectMeal={handleSelectMeal}
        />
      )}

      {activeTab === 'community' && (
        <CommunityBoard
          topics={communityTopics}
          currentUser={viewUser}
          onAddTopic={handleAddTopic}
          onToggleRsvp={handleToggleRsvp}
          onAddReply={handleAddReply}
          onToggleLike={handleToggleLike}
        />
      )}

      {activeTab === 'directory' && (
        <DirectoryView
          profiles={allUsers}
          currentUser={viewUser}
          onToggleDirectoryVisibility={handleToggleDirectoryVisibility}
          onMessage={handleOpenThread}
          onViewContactCard={(p) => setContactCardProfile(p)}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesView
          messages={messages}
          profiles={allUsers}
          currentUser={viewUser}
          initialThreadUserId={pendingThreadUserId}
          onSendMessage={handleSendMessage}
          onMarkRead={handleMarkRead}
        />
      )}

      {activeTab === 'propose' && (
        <ProposeSession
          currentUser={viewUser}
          sessions={sessions}
          tracks={tracks}
          events={allEvents}
          rooms={rooms}
          onSubmit={(session) => create('sessions', session)}
        />
      )}

      {activeTab === 'profile' && (
        <MyProfile
          currentUser={viewUser}
          sessions={sessions}
          rooms={rooms}
          uploadsEnabled={isRemote}
          onSaveProfile={handleSaveOwnProfile}
          onTogglePrivacy={handleSaveOwnProfile}
          onSaveSession={handleSaveOwnSession}
        />
      )}

      {activeTab === 'feedback' && (
        <FeedbackView
          currentUser={viewUser}
          sessions={sessions}
          mealServices={mealServices}
          attendance={attendance}
          feedback={feedback}
          onSubmit={handleSubmitFeedback}
        />
      )}

      {activeTab === 'luckydraw' && (
        <LuckyDraw
          profiles={allUsers}
          prizes={prizes}
          sponsors={sponsors}
          events={events}
          currentUser={viewUser}
          onUpdatePrize={(prizeId, wonBy) => update('prizes', prizeId, { wonBy })}
        />
      )}

      {activeTab === 'admin' && (
        <AdminConsole
          sessions={sessions}
          tracks={tracks}
          rooms={rooms}
          profiles={allUsers}
          announcements={announcements}
          onBroadcastAnnouncement={handleBroadcastAnnouncement}
          onImportCsvSessions={handleImportCsvSessions}
          mealServices={mealServices}
          attendance={attendance}
          feedback={feedback}
          event={activeEvent}
        />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">

      {/* Platform Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={viewUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
        announcements={announcements}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        bookmarkedCount={bookmarkedSessionsCount}
        unreadMessageCount={unreadMessageCount}
        profileGapCount={profileGaps(currentUser).length}
        onSignOut={handleSignOut}
        onGoHome={openHub}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        realRole={currentUser.role}
        previewRole={previewRole}
        onPreviewRole={setPreviewRole}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {deviceMode === 'desktop' ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {mainContent}
          </div>
        ) : (
          <MobileAppFrame
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={viewUser}
            onExitMobile={() => setDeviceMode('desktop')}
          >
            {mainContent}
          </MobileAppFrame>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">CI Connects</span>
            <span>•</span>
            <span>The Chadwick International Event Management Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openHub}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              All Chadwick events
            </button>
            <span>•</span>
            <button
              onClick={() => setIsArchitectureOpen(true)}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Architectural Blueprint & Schema
            </button>
          </div>
        </div>
      </footer>

      {/* Session Details Drawer / Modal */}
      <SessionModal
        session={selectedSessionForModal}
        onClose={() => setSelectedSessionForModal(null)}
        tracks={tracks}
        rooms={rooms}
        sponsors={sponsors}
        profiles={allUsers}
        currentUser={viewUser}
        onToggleReservation={handleToggleReservation}
        onNavigateToCommunity={() => {
          setActiveTab('community');
        }}
      />

      {/* Staff QR Check-In Terminal Modal */}
      <CheckInScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        profiles={allUsers}
        onCheckInUser={(userId) => handleToggleCheckIn(userId)}
      />

      {/* Door scanner — main entrance and session doors */}
      <DoorScanner
        isOpen={isDoorScannerOpen}
        onClose={() => setIsDoorScannerOpen(false)}
        sessions={sessions}
        rooms={rooms}
        profiles={allUsers}
        attendance={attendance}
        currentUser={viewUser}
        onRecordAttendance={handleRecordAttendance}
        onCheckInToVenue={handleToggleCheckIn}
        invites={invites}
      />

      {/* Badge scan result — contact card or security verification */}
      <ContactCardModal
        profile={contactCardProfile}
        onClose={() => setContactCardProfile(null)}
        onMessage={handleOpenThread}
        viewerIsSecurity={currentUser.role === 'front_desk'}
      />

      {/* Print-ready lanyard badges, single or bulk */}
      <PrintableBadge
        isOpen={isPrintBadgeOpen}
        onClose={() => setIsPrintBadgeOpen(false)}
        event={activeEvent}
        profiles={allUsers}
        currentUser={viewUser}
        sessions={sessions}
        rooms={rooms}
        tracks={tracks}
        sponsors={sponsors}
        mealServices={mealServices}
      />

      {/* Architectural Blueprint Modal */}
      <ArchitectureGuideModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />

    </div>
  );
}
