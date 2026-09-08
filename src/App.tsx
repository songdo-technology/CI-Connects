import React, { useState, useMemo } from 'react';
import {
  INITIAL_TRACKS,
  INITIAL_ROOMS,
  INITIAL_SPONSORS,
  INITIAL_PROFILES,
  INITIAL_SESSIONS,
  INITIAL_COMMUNITY_TOPICS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_MEAL_SERVICES,
  INITIAL_ATTENDANCE,
  INITIAL_MESSAGES,
  EVENT_CONFIG,
  EVENTS,
} from './data/initialData';
import {
  ActiveTab,
  Session,
  UserProfile,
  Track,
  Room,
  Sponsor,
  CommunityTopic,
  BroadcastAnnouncement,
  MealService,
  AttendanceRecord,
  DirectMessage,
  AuthSession,
  AuthMethod,
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
import { SessionDoorScanner } from './components/SessionDoorScanner';
import { ContactCardModal } from './components/ContactCardModal';
import { PrintableBadge } from './components/PrintableBadge';
import { RoomSignage } from './components/RoomSignage';
import { EventsHub } from './components/EventsHub';
import { SignageDirectory } from './components/SignageDirectory';

/** The public surfaces of the product: a hub listing every event Chadwick
 *  runs, one page per event, a sign-in gate, and the attendee portal behind
 *  it. Signage resolves ahead of all of them, straight from the URL. */
type Surface = 'hub' | 'event' | 'signin' | 'portal';

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  // Application Data State
  const [allUsers, setAllUsers] = useState<UserProfile[]>(INITIAL_PROFILES);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [sponsors] = useState<Sponsor[]>(INITIAL_SPONSORS);
  const [communityTopics, setCommunityTopics] = useState<CommunityTopic[]>(INITIAL_COMMUNITY_TOPICS);
  const [announcements, setAnnouncements] = useState<BroadcastAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [mealServices, setMealServices] = useState<MealService[]>(INITIAL_MEAL_SERVICES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [messages, setMessages] = useState<DirectMessage[]>(INITIAL_MESSAGES);

  // Auth & surface routing
  /** Read once from the URL so /?event=<slug> is a real, shareable address
   *  rather than only an in-app transition. */
  const initialEventSlug = (() => {
    const slug = new URLSearchParams(window.location.search).get('event');
    return slug && EVENTS.some(e => e.slug === slug) ? slug : null;
  })();

  const [surface, setSurface] = useState<Surface>(initialEventSlug ? 'event' : 'hub');
  /** Which event the public pages and the portal are scoped to. */
  const [activeEventSlug, setActiveEventSlug] = useState<string>(
    initialEventSlug ?? EVENT_CONFIG.slug,
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<Session | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDoorScannerOpen, setIsDoorScannerOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isPrintBadgeOpen, setIsPrintBadgeOpen] = useState(false);
  const [contactCardProfile, setContactCardProfile] = useState<UserProfile | null>(null);
  const [pendingThreadUserId, setPendingThreadUserId] = useState<string | null>(null);

  const activeEvent = useMemo(
    () => EVENTS.find(e => e.slug === activeEventSlug) ?? EVENT_CONFIG,
    [activeEventSlug],
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

  const openHub = () => {
    setSurface('hub');
    syncUrl(null);
    window.scrollTo(0, 0);
  };

  /** The signed-in user, resolved from the auth session rather than held
   *  separately, so there is exactly one source of truth for identity. */
  const currentUser = useMemo(
    () => allUsers.find((u) => u.id === authSession?.userId) ?? allUsers[0],
    [allUsers, authSession],
  );

  // ---------------------------------------------------------------- Auth
  const handleSignIn = (user: UserProfile, method: AuthMethod) => {
    setAuthSession({ userId: user.id, method, signedInAt: now() });
    setActiveTab('agenda');
    setSurface('portal');
  };

  const handleSignOut = () => {
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

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        reservedUserIds: nextReserved,
        waitlistUserIds: nextWaitlist,
      } : s));

      return { success: true, message: `Reservation cancelled for "${session.title}".` };
    } else if (isWaitlisted) {
      // Remove from waitlist
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        waitlistUserIds: s.waitlistUserIds.filter(id => id !== currentUser.id),
      } : s));
      return { success: true, message: `Removed from waitlist for "${session.title}".` };
    } else {
      // Attempt atomic reservation
      if (session.reservedUserIds.length < session.maxAttendees) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          reservedUserIds: [...s.reservedUserIds, currentUser.id],
        } : s));
        const roomName = rooms.find(r => r.id === session.roomId)?.name || 'Venue';
        return { success: true, message: `Seat confirmed for "${session.title}" in ${roomName}.` };
      } else {
        // Over capacity: place on atomic waitlist
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          waitlistUserIds: [...s.waitlistUserIds, currentUser.id],
        } : s));
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
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = !u.checkedIn;
        return {
          ...u,
          checkedIn: nextStatus,
          checkedInAt: nextStatus ? now() : undefined,
        };
      }
      return u;
    }));
  };

  // Directory Privacy Toggle for active user
  const handleToggleDirectoryVisibility = () => {
    setAllUsers(prev => prev.map(u =>
      u.id === currentUser.id ? { ...u, isDirectoryVisible: !u.isDirectoryVisible } : u
    ));
  };

  /** Opt in or out of handing over contact details when the badge is scanned. */
  const handleToggleContactSharing = () => {
    setAllUsers(prev => prev.map(u =>
      u.id === currentUser.id ? { ...u, shareContactOnScan: !u.shareContactOnScan } : u
    ));
  };

  // ------------------------------------------------------------- Dining
  const handleSelectMeal = (serviceId: string, optionId: string | null) => {
    setMealServices(prev => prev.map(service => {
      if (service.id !== serviceId) return service;
      const next = { ...service.selections };
      if (optionId === null) {
        delete next[currentUser.id];
      } else {
        next[currentUser.id] = optionId;
      }
      return { ...service, selections: next };
    }));
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

    setAttendance(prev => [record, ...prev]);

    // A door scan also admits them to the venue if they were not already in.
    setAllUsers(prev => prev.map(u =>
      u.id === userId && !u.checkedIn ? { ...u, checkedIn: true, checkedInAt: record.scannedAt } : u
    ));

    return record;
  };

  // ----------------------------------------------------------- Messaging
  const handleSendMessage = (toUserId: string, content: string) => {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId,
      content,
      createdAt: 'Just now',
      read: false,
    }]);
  };

  const handleMarkRead = (fromUserId: string) => {
    setMessages(prev => prev.map(m =>
      m.fromUserId === fromUserId && m.toUserId === currentUser.id ? { ...m, read: true } : m
    ));
  };

  const handleOpenThread = (userId: string) => {
    setPendingThreadUserId(userId);
    setActiveTab('messages');
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
    setCommunityTopics(prev => [newTopic, ...prev]);
  };

  const handleToggleRsvp = (topicId: string) => {
    setCommunityTopics(prev => prev.map(topic => {
      if (topic.id === topicId) {
        const isRsvped = topic.rsvpUserIds.includes(currentUser.id);
        return {
          ...topic,
          rsvpUserIds: isRsvped
            ? topic.rsvpUserIds.filter(id => id !== currentUser.id)
            : [...topic.rsvpUserIds, currentUser.id],
        };
      }
      return topic;
    }));
  };

  const handleAddReply = (topicId: string, replyText: string) => {
    setCommunityTopics(prev => prev.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
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
        };
      }
      return topic;
    }));
  };

  const handleToggleLike = (topicId: string) => {
    setCommunityTopics(prev => prev.map(topic => {
      if (topic.id === topicId) {
        return { ...topic, likesCount: topic.likesCount + 1 };
      }
      return topic;
    }));
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
    setAnnouncements(prev => [newAnn, ...prev]);
  };

  // CSV Batch Ingestion Handler
  const handleImportCsvSessions = (
    newSessions: Session[],
    newTracks: Track[],
    newRooms: Room[],
    newProfiles: UserProfile[]
  ) => {
    if (newTracks.length > 0) {
      setTracks(prev => [...prev, ...newTracks]);
    }
    if (newRooms.length > 0) {
      setRooms(prev => [...prev, ...newRooms]);
    }
    if (newProfiles.length > 0) {
      setAllUsers(prev => [...prev, ...newProfiles]);
    }
    setSessions(prev => [...prev, ...newSessions]);

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
    return sessions.filter(s => s.reservedUserIds.includes(currentUser.id)).length;
  }, [sessions, currentUser.id]);

  const reservedSessionsForUser = useMemo(() => {
    return sessions.filter(s => s.reservedUserIds.includes(currentUser.id));
  }, [sessions, currentUser.id]);

  const unreadMessageCount = useMemo(
    () => messages.filter(m => m.toUserId === currentUser.id && !m.read).length,
    [messages, currentUser.id],
  );

  const myMealSelections = useMemo(
    () => mealServices
      .filter(s => s.selections[currentUser.id])
      .map(s => ({
        service: s,
        option: s.options.find(o => o.id === s.selections[currentUser.id])!,
      }))
      .filter(x => x.option),
    [mealServices, currentUser.id],
  );

  const myAttendance = useMemo(
    () => attendance.filter(a => a.userId === currentUser.id),
    [attendance, currentUser.id],
  );

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

  // ------------------------------------------------------- Surface: hub
  if (surface === 'hub') {
    return (
      <EventsHub
        events={EVENTS}
        onOpenEvent={openEvent}
        onSignIn={() => setSurface('signin')}
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
        onSignIn={() => setSurface('signin')}
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
        onBackToEvent={() => setSurface(activeEvent.hasPortal ? 'event' : 'hub')}
        eventName={activeEvent.shortName}
      />
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
          currentUser={currentUser}
          onToggleReservation={handleToggleReservation}
          onSelectSession={(session) => setSelectedSessionForModal(session)}
        />
      )}

      {activeTab === 'badge' && (
        <DigitalBadge
          currentUser={currentUser}
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
          currentUser={currentUser}
          onSelectMeal={handleSelectMeal}
        />
      )}

      {activeTab === 'community' && (
        <CommunityBoard
          topics={communityTopics}
          currentUser={currentUser}
          onAddTopic={handleAddTopic}
          onToggleRsvp={handleToggleRsvp}
          onAddReply={handleAddReply}
          onToggleLike={handleToggleLike}
        />
      )}

      {activeTab === 'directory' && (
        <DirectoryView
          profiles={allUsers}
          currentUser={currentUser}
          onToggleDirectoryVisibility={handleToggleDirectoryVisibility}
          onMessage={handleOpenThread}
          onViewContactCard={(p) => setContactCardProfile(p)}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesView
          messages={messages}
          profiles={allUsers}
          currentUser={currentUser}
          initialThreadUserId={pendingThreadUserId}
          onSendMessage={handleSendMessage}
          onMarkRead={handleMarkRead}
        />
      )}

      {activeTab === 'luckydraw' && (
        <LuckyDraw
          profiles={allUsers}
          sessions={sessions}
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
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
        announcements={announcements}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        bookmarkedCount={bookmarkedSessionsCount}
        unreadMessageCount={unreadMessageCount}
        onSignOut={handleSignOut}
        onViewPublicPage={() => { setSurface('event'); window.scrollTo(0, 0); }}
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
            currentUser={currentUser}
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
        currentUser={currentUser}
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

      {/* Session door scanner — verified attendance capture */}
      <SessionDoorScanner
        isOpen={isDoorScannerOpen}
        onClose={() => setIsDoorScannerOpen(false)}
        sessions={sessions}
        rooms={rooms}
        profiles={allUsers}
        attendance={attendance}
        currentUser={currentUser}
        onRecordAttendance={handleRecordAttendance}
      />

      {/* Badge scan result — contact card or security verification */}
      <ContactCardModal
        profile={contactCardProfile}
        onClose={() => setContactCardProfile(null)}
        onMessage={handleOpenThread}
        viewerIsSecurity={currentUser.role === 'security'}
      />

      {/* Print-ready lanyard badges, single or bulk */}
      <PrintableBadge
        isOpen={isPrintBadgeOpen}
        onClose={() => setIsPrintBadgeOpen(false)}
        event={activeEvent}
        profiles={allUsers}
        currentUser={currentUser}
        sessions={sessions}
        rooms={rooms}
        tracks={tracks}
        sponsors={sponsors}
      />

      {/* Architectural Blueprint Modal */}
      <ArchitectureGuideModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />

    </div>
  );
}
