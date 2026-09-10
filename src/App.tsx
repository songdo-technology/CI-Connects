import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Invite,
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
import { takeSignInIntent, hasSignInIntent, clearSignInIntent, markSignInIntent } from './lib/signInIntent';
import { isGuestLinkInUrl } from './lib/auth';
import { lookupDocFor, checkInviteCode } from './lib/inviteCodes';
import { FeedbackView } from './components/FeedbackView';
import { SignageDirectory } from './components/SignageDirectory';
import { ProposeSession } from './components/ProposeSession';
import { AdminDashboard } from './components/AdminDashboard';
import { VerifyCertificate } from './components/VerifyCertificate';
import { MyCertificates } from './components/MyCertificates';
import { GateStation } from './components/GateStation';
import { SelfCheckIn } from './components/SelfCheckIn';
import { MyLearning } from './components/MyLearning';

/** The public surfaces of the product: a hub listing every event Chadwick
 *  runs, one page per event, a sign-in gate, and the attendee portal behind
 *  it. Signage resolves ahead of all of them, straight from the URL. */
type Surface = 'hub' | 'event' | 'signin' | 'portal' | 'dashboard' | 'gate' | 'learning';

/**
 * Where each surface lives in the address bar.
 *
 * Signed-in surfaces are paths, so the browser's Back button moves inside the
 * platform instead of out of it, and a bookmark to the dashboard opens the
 * dashboard. The public catalogue keeps its `/?event=<slug>` address because
 * invitations and printed links already carry it.
 */
type Route =
  | { kind: 'hub' }
  | { kind: 'event'; slug: string }
  | { kind: 'signin' }
  | { kind: 'dashboard' }
  | { kind: 'admin' }
  | { kind: 'learning' }
  | { kind: 'gate' }
  | { kind: 'portal'; slug: string; tab: ActiveTab };

const PORTAL_TABS: ActiveTab[] = [
  'agenda', 'badge', 'dining', 'community', 'directory', 'messages',
  'profile', 'propose', 'feedback', 'admin', 'luckydraw',
];

function parseRoute(loc: Location): Route {
  const parts = loc.pathname.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'signin': return { kind: 'signin' };
    case 'dashboard': return { kind: 'dashboard' };
    case 'admin': return { kind: 'admin' };
    case 'me': return { kind: 'learning' };
    case 'gate': return { kind: 'gate' };
    case 'event':
      if (parts[1]) {
        const tab = PORTAL_TABS.includes(parts[2] as ActiveTab) ? (parts[2] as ActiveTab) : 'agenda';
        return { kind: 'portal', slug: decodeURIComponent(parts[1]), tab };
      }
  }
  const slug = new URLSearchParams(loc.search).get('event');
  return slug ? { kind: 'event', slug } : { kind: 'hub' };
}

/** The address for a route, keeping every query parameter that is not ours
 *  (a check-in token, a certificate code, a guest sign-in link). */
function routeUrl(route: Route, current: URL): URL {
  const url = new URL(current.href);
  url.searchParams.delete('event');
  switch (route.kind) {
    case 'hub': url.pathname = '/'; break;
    case 'event': url.pathname = '/'; url.searchParams.set('event', route.slug); break;
    case 'signin': url.pathname = '/signin'; break;
    case 'dashboard': url.pathname = '/dashboard'; break;
    case 'admin': url.pathname = '/admin'; break;
    case 'learning': url.pathname = '/me'; break;
    case 'gate': url.pathname = '/gate'; break;
    case 'portal':
      url.pathname = `/event/${encodeURIComponent(route.slug)}`
        + (route.tab === 'agenda' ? '' : `/${route.tab}`);
      break;
  }
  return url;
}

/** The surface underneath a route. The admin panel is an overlay, so it sits
 *  on the dashboard when nothing else was there. */
function surfaceOfRoute(route: Route): Surface {
  return route.kind === 'admin' ? 'dashboard' : route.kind;
}

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
    certificates,
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
  /** Read once from the URL, so every address here is real and shareable. An
   *  event slug is not checked against a list yet: at first paint the store
   *  has answered nothing, so every slug would look unknown. It is resolved
   *  below, once the data is in. */
  const [initialRoute] = useState<Route>(() => parseRoute(window.location));

  const [surface, setSurface] = useState<Surface>(surfaceOfRoute(initialRoute));
  /** Where the visitor was when they chose to sign in.
   *
   *  Leaving the sign-in screen used to go to the flagship event's page
   *  whenever that event had a portal — so anyone arriving from the hub was
   *  quietly moved somewhere they had not been. Back means back. */
  const [returnSurface, setReturnSurface] = useState<'hub' | 'event'>('hub');
  /** Which event the public pages and the portal are scoped to. */
  const [activeEventSlug, setActiveEventSlug] = useState<string>(
    'slug' in initialRoute ? initialRoute.slug : EVENT_CONFIG.slug,
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  /** Set when someone scanned a station's code with their own phone. */
  const [checkInToken, setCheckInToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('checkin'));
  /** Set when the page was opened from a certificate's QR or printed code. */
  const [verifyCode, setVerifyCode] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('verify'));
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
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialRoute.kind === 'portal' ? initialRoute.tab : 'agenda',
  );
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<Session | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDoorScannerOpen, setIsDoorScannerOpen] = useState(false);
  const [isPrintBadgeOpen, setIsPrintBadgeOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(initialRoute.kind === 'admin');
  /** Signed in, profile on its way: the move to the person's home is pending. */
  const [awaitingHome, setAwaitingHome] = useState(false);
  /** The next address change replaces the current history entry instead of
   *  adding one — for corrections, and for leaving the sign-in page behind. */
  const replaceNextRef = useRef(false);
  const surfaceRef = useRef<Surface>(surface);
  surfaceRef.current = surface;
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

  const openEvent = (slug: string) => {
    setActiveEventSlug(slug);
    setSurface('event');
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
    replaceNextRef.current = true;
    setSurface('hub');
  }, [ready, surface, allEvents, activeEventSlug]);

  const openSignIn = () => {
    if (surface === 'hub' || surface === 'event') setReturnSurface(surface);
    setEnteringPortal(true);
    setSurface('signin');
  };

  const openHub = () => setSurface('hub');

  /** The signed-in user, resolved from the auth session rather than held
   *  separately, so there is exactly one source of truth for identity. */
  /** Undefined until the store delivers. The render gate below gives every
   *  consumer a non-null value; only the memos above it must guard. */
  const currentUser: UserProfile | undefined = useMemo(
    // No fallback to the first profile in the directory: that was a demo
    // convenience, and it rendered somebody else's name — and aimed writes at
    // somebody else's record — for the moment before one's own profile
    // arrived. Undefined is handled below by holding the screen.
    () => allUsers.find((u) => u.id === authSession?.userId),
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
   * then appears to do nothing. Waits for `profileReady` because the home
   * surface reads a role, and the role lives in the Firestore profile written
   * just after sign-in. The move home itself happens in the effect below, once
   * that profile has actually arrived through the subscription: deciding it
   * here, against a directory that may not contain the person yet, is how a
   * sign-in was once routed as whoever happened to be first in the list.
   *
   * `signInWithRedirect` comes back to a cold load, so whether this sign-in
   * should move the person home cannot be read from the surface alone; the
   * stored intent says so, and an emailed guest link is the same trip.
   */
  useEffect(() => {
    if (!auth.live) return;
    if (auth.status === 'signed_in' && auth.profileReady && auth.firebaseUser) {
      const uid = auth.firebaseUser.uid;
      setAuthSession((current) =>
        current?.userId === uid ? current : { userId: uid, method: 'google_sso', signedInAt: now() },
      );
      const intent = takeSignInIntent();
      if (intent?.eventSlug) setActiveEventSlug(intent.eventSlug);
      if (surfaceRef.current === 'signin' || enteringPortal) setAwaitingHome(true);
      setEnteringPortal(false);
    }
    if (auth.status === 'signed_out') {
      setAuthSession(null);
    }
  }, [auth.live, auth.status, auth.profileReady, auth.firebaseUser, enteringPortal]);

  /**
   * The move home, made only once the signed-in person's own profile is here.
   *
   * Replaces the sign-in entry in history rather than stacking on it, so Back
   * from the dashboard does not reopen a sign-in form for somebody already in.
   */
  useEffect(() => {
    if (!awaitingHome || !authSession || currentUser?.id !== authSession.userId) return;
    replaceNextRef.current = true;
    setIsAdminPanelOpen(false);
    setSurface(homeSurfaceFor(currentUser));
    setAwaitingHome(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingHome, authSession, currentUser]);

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
   * Where a person lands once they are in: their own dashboard, always.
   *
   * By role, and never inside a conference. An organiser opens the platform
   * onto the events they run, an attendee onto their own record, and the
   * front desk onto the gate, because a queue waits while somebody finds the
   * scanner. An event is a click from each of these; it is not where signing
   * in puts you, which is how an administrator once opened the platform onto
   * a sample programme with nothing to say it was one.
   */
  const homeSurfaceFor = (user: UserProfile): Surface => {
    if (user.role === 'front_desk') return 'gate';
    if (can(user, 'events:create')) return 'dashboard';
    return 'learning';
  };

  /** The design-preview sign-in: no identity provider, a seeded profile. */
  const handleSignIn = (user: UserProfile, method: AuthMethod) => {
    takeSignInIntent();
    setAuthSession({ userId: user.id, method, signedInAt: now() });
    setActiveTab('agenda');
    replaceNextRef.current = true;
    setSurface(homeSurfaceFor(user));
  };

  /** The person's own dashboard — the brand mark and the Dashboard button. */
  const openHome = () => {
    if (!currentUser) { openHub(); return; }
    setIsAdminPanelOpen(false);
    setSurface(homeSurfaceFor(currentUser));
  };

  // ------------------------------------------------------------- Routing

  /** Surfaces that need a signed-in person. */
  const authRequired = isAdminPanelOpen
    || surface === 'portal' || surface === 'dashboard'
    || surface === 'gate' || surface === 'learning';

  const route: Route = isAdminPanelOpen ? { kind: 'admin' }
    : surface === 'portal' ? { kind: 'portal', slug: activeEventSlug, tab: activeTab }
    : surface === 'event' ? { kind: 'event', slug: activeEventSlug }
    : { kind: surface };

  /**
   * The address bar follows the surface, as history entries.
   *
   * Every move used to rewrite the URL in place, so the browser's Back button
   * — the one control every visitor already knows — left the site entirely,
   * usually onto the sign-in provider's pages. Now each move is an entry, and
   * Back means back.
   */
  useEffect(() => {
    const current = new URL(window.location.href);
    const next = routeUrl(route, current);
    if (next.pathname === current.pathname && next.search === current.search) {
      replaceNextRef.current = false;
      return;
    }
    if (replaceNextRef.current) {
      window.history.replaceState({}, '', next.toString());
      replaceNextRef.current = false;
    } else {
      window.history.pushState({}, '', next.toString());
      window.scrollTo(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, activeEventSlug, activeTab, isAdminPanelOpen]);

  /** What Back and Forward should see, without re-subscribing per render. */
  const latestRef = useRef({ authSession, currentUser });
  latestRef.current = { authSession, currentUser };

  useEffect(() => {
    const onPop = () => {
      const r = parseRoute(window.location);
      const { authSession: session, currentUser: user } = latestRef.current;
      if (r.kind === 'signin' && session && user) {
        // Back onto the sign-in page while signed in: step over it.
        replaceNextRef.current = true;
        setIsAdminPanelOpen(false);
        setSurface(homeSurfaceFor(user));
        return;
      }
      setIsAdminPanelOpen(r.kind === 'admin');
      if ('slug' in r) setActiveEventSlug(r.slug);
      if (r.kind === 'portal') setActiveTab(r.tab);
      setSurface((s) => r.kind === 'admin'
        ? (s === 'hub' || s === 'event' || s === 'signin' ? 'dashboard' : s)
        : surfaceOfRoute(r));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A signed-out visitor on a signed-in address is sent to sign in — once
   *  Firebase has actually decided they are signed out, not on its first,
   *  provisional answer. */
  useEffect(() => {
    if (!authRequired || authSession) return;
    if (auth.live && (!auth.settled || auth.status === 'signed_in')) return;
    replaceNextRef.current = true;
    setIsAdminPanelOpen(false);
    setReturnSurface('hub');
    setEnteringPortal(false);
    setSurface('signin');
  }, [authRequired, authSession, auth.live, auth.settled, auth.status]);

  /** A signed-in person on a surface their role does not have goes home,
   *  rather than falling through to whatever rendered last. */
  useEffect(() => {
    if (!authSession || !currentUser) return;
    const organiser = can(currentUser, 'events:create');
    if (isAdminPanelOpen && !organiser) {
      replaceNextRef.current = true;
      setIsAdminPanelOpen(false);
      return;
    }
    if ((surface === 'dashboard' && !organiser)
        || (surface === 'gate' && !can(currentUser, 'attendance:scan'))) {
      replaceNextRef.current = true;
      setSurface(homeSurfaceFor(currentUser));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession, currentUser, surface, isAdminPanelOpen]);

  /**
   * Saving an invitation also publishes its access-code lookup.
   *
   * Kept in one action deliberately: an invitation whose code cannot be
   * checked is one nobody can use, and the two drifting apart would stay
   * invisible until a guest was standing at the door.
   */
  const handleSaveInvite = async (invite: Invite, isNew: boolean) => {
    if (isNew) await create('invites', invite);
    else await update('invites', invite.id, invite);
    const lookup = await lookupDocFor(invite);
    await create('inviteCodes', { id: lookup.id, ...lookup.data });
  };

  /** Republishes every lookup. Idempotent, and the repair for invitations made
   *  before this existed or brought in through a spreadsheet. */
  const republishInviteCodes = async () => {
    const docs = await Promise.all(invites.map(lookupDocFor));
    await batch(docs.map((d) => ({
      op: 'create' as const, key: 'inviteCodes' as const, item: { id: d.id, ...d.data },
    })));
    return docs.length;
  };

  /**
   * Redeeming an invitation code.
   *
   * Checked against the same hashed lookup the sign-in screen used, so the
   * code still proves an organiser issued it for this address — moving the
   * step later did not weaken it. Returns the problem to show, or null.
   */
  const handleRedeemCode = async (code: string): Promise<string | null> => {
    const match = await checkInviteCode(currentUser.email, code);
    if (!match) {
      return 'That code does not match an invitation for ' + currentUser.email
        + '. Codes are issued for one address — if yours was sent to a different '
        + 'one, sign in with that address instead.';
    }
    const invite = invites.find((i) => i.id === match.inviteId);
    if (invite && !invite.claimedAt) {
      await update('invites', invite.id, {
        claimedAt: now(), claimedByUid: currentUser.id,
      });
    }
    // A confirmed place is what opens the directory. Holding an account is
    // not, or self-registration would publish every colleague to the internet.
    if (!currentUser.hasEventAccess) {
      await update('users', currentUser.id, { hasEventAccess: true });
    }
    return null;
  };

  /**
   * Asking for a place on something.
   *
   * A mail draft rather than a request queue: places are confirmed outside the
   * platform — payment, headcount, whether the person is a fit — and inventing
   * a workflow that ends in somebody being emailed anyway would add a step
   * without adding a decision.
   */
  const handleRequestPlace = (eventId: string) => {
    const event = allEvents.find((e) => e.id === eventId);
    if (!event) return;
    const subject = `Requesting a place: ${event.name}`;
    const body = [
      `I would like to attend ${event.name} (${event.dateLabel}).`,
      '',
      `Name: ${currentUser.fullName}`,
      `Organisation: ${currentUser.organization || '—'}`,
      `Role: ${currentUser.title || '—'}`,
      `Account email: ${currentUser.email}`,
      '',
      'Please let me know about availability, cost and how to confirm.',
    ].join('\n');
    window.location.href = `mailto:songdo-technology@chadwickschool.org`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  // A verification link is checked before anything else on the page. Somebody
  // holding a printed certificate has no account and no interest in the rest
  // of the platform, and asking them to load it would be an obstacle.
  if (verifyCode !== null) {
    return (
      <VerifyCertificate
        code={verifyCode}
        onOpenHub={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('verify');
          window.history.replaceState({}, '', url.toString());
          setVerifyCode(null);
          setSurface('hub');
        }}
      />
    );
  }

  /**
   * Somebody scanned a check-in code with their own phone.
   *
   * Their own session does the authenticating — the station is a screen and
   * is trusted for nothing. Signed out, they are sent to sign in and the token
   * survives the trip, because being bounced to a front page while standing at
   * a door with a queue behind you is the whole failure this replaces.
   */
  if (checkInToken !== null) {
    return (
      <SelfCheckIn
        token={checkInToken}
        currentUser={authSession ? currentUser : null}
        events={allEvents}
        sessions={sessions}
        rooms={rooms}
        attendance={attendance}
        onCheckInToVenue={(userId) => update('users', userId, { checkedIn: true })}
        onRecordAttendance={handleRecordAttendance}
        onRecordDeparture={(recordId) => update('attendance', recordId, { leftAt: now() })}
        onSignIn={() => { markSignInIntent(); setEnteringPortal(true); setSurface('signin'); }}
        onDone={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('checkin');
          window.history.replaceState({}, '', url.toString());
          setCheckInToken(null);
        }}
      />
    );
  }

  // Subscriptions attach in an effect, so the first render has empty
  // collections. Everything below assumes data is present, so hold rendering
  // until the store has delivered.
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
  const signInInFlight = auth.live && !auth.error
    && (!auth.settled || auth.status === 'signed_in')
    && !(auth.status === 'signed_in' && auth.profileReady);
  if ((enteringPortal && signInInFlight) || awaitingHome
      || (authRequired && !authSession && signInInFlight)) {
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

  // Signed in, but the person's own profile has not come through the
  // subscription yet. Every signed-in surface renders against it.
  if (authRequired && authSession && !viewUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-slate-500">Preparing your profile…</p>
        </div>
      </div>
    );
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
        certificates={certificates}
        onSaveInvite={handleSaveInvite}
        onDeleteInvite={remover('invites')}
        onRepublishInviteCodes={republishInviteCodes}
      />
    );
  }

  // -------------------------------------------------- Surface: learning
  if (surface === 'learning' && authSession && viewUser) {
    return (
      <MyLearning
        currentUser={viewUser}
        events={allEvents}
        sessions={sessions}
        rooms={rooms}
        certificates={certificates}
        attendance={attendance}
        invites={invites}
        onOpenEventPortal={(slug) => {
          setActiveEventSlug(slug);
          setActiveTab('agenda');
          setSurface('portal');
        }}
        onOpenPublicPage={openEvent}
        onOpenHub={openHub}
        profilePanel={(
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
        onRedeemCode={handleRedeemCode}
        onRequestPlace={handleRequestPlace}
        onBackToAdmin={can(viewUser, 'events:create') ? () => setSurface('dashboard') : undefined}
        onSignOut={handleSignOut}
      />
    );
  }

  // ------------------------------------------------------ Surface: gate
  if (surface === 'gate' && authSession && viewUser && can(viewUser, 'attendance:scan')) {
    return (
      <GateStation
        currentUser={viewUser}
        events={allEvents}
        sessions={sessions}
        rooms={rooms}
        profiles={allUsers}
        invites={invites}
        attendance={attendance}
        mealServices={mealServices}
        onCheckInToVenue={(userId) => update('users', userId, { checkedIn: true })}
        onRecordAttendance={handleRecordAttendance}
        onRecordDeparture={(recordId) =>
          update('attendance', recordId, { leftAt: now() })}
        onSignOut={handleSignOut}
      />
    );
  }

  // ------------------------------------------------- Surface: dashboard
  if (surface === 'dashboard' && authSession && viewUser && can(viewUser, 'events:create')) {
    return (
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
        }}
        onOpenPublicPage={openEvent}
        onOpenHub={openHub}
        onOpenGate={() => setSurface('gate')}
        onOpenMyLearning={() => setSurface('learning')}
        onSignOut={handleSignOut}
      />
    );
  }

  // ------------------------------------------------------- Surface: hub
  if (surface === 'hub') {
    return (
      <EventsHub
        events={allEvents}
        sessions={sessions}
        signedInAs={authSession ? currentUser ?? null : null}
        isOrganiser={Boolean(authSession) && can(currentUser, 'events:create')}
        onOpenPortal={openHome}
        onCreateEvent={() => {
          setAdminIntent('events-new');
          setSurface('dashboard');
          setIsAdminPanelOpen(true);
        }}
        onSignOut={handleSignOut}
        onOpenEvent={openEvent}
        onRegister={(slug) => {
          // Remember which event: the redirect comes back to a cold load with
          // none of this state, and the dashboard can then point at it.
          setActiveEventSlug(slug);
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
        <div className="mb-5">
          <MyCertificates
            currentUser={viewUser}
            certificates={certificates}
            events={allEvents}
            gaveFeedbackFor={(eventId) => {
              const ids = new Set(sessions.filter((s) => s.eventId === eventId).map((s) => s.id));
              return feedback.some((f) => f.userId === viewUser.id
                && (ids.has(f.targetId) || f.targetKind !== 'session'));
            }}
            onGiveFeedback={() => setActiveTab('feedback')}
          />
        </div>
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
        eventName={activeEvent.name}
        announcements={announcements}
        bookmarkedCount={bookmarkedSessionsCount}
        unreadMessageCount={unreadMessageCount}
        profileGapCount={profileGaps(viewUser).length}
        onSignOut={handleSignOut}
        onGoHome={openHub}
        onOpenHome={openHome}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        realRole={currentUser?.role ?? viewUser.role}
        previewRole={previewRole}
        onPreviewRole={setPreviewRole}
      />

      {/* Main View Area */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {mainContent}
        </div>
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
              onClick={openHome}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              My dashboard
            </button>
            <span>•</span>
            <button
              onClick={openHub}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              All Chadwick events
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
        viewerIsSecurity={viewUser.role === 'front_desk'}
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

    </div>
  );
}
