import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Bookmark, 
  BookmarkCheck, 
  Clock, 
  MapPin, 
  Users, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  Check, 
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  CalendarCheck
} from 'lucide-react';
import { Session, Track, Room, Sponsor, UserProfile } from '../types';

interface AgendaViewProps {
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  sponsors: Sponsor[];
  profiles: UserProfile[];
  currentUser: UserProfile;
  onToggleReservation: (sessionId: string) => { success: boolean; message: string; waitlisted?: boolean };
  onSelectSession: (session: Session) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  sessions,
  tracks,
  rooms,
  sponsors,
  profiles,
  currentUser,
  onToggleReservation,
  onSelectSession,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeViewMode, setActiveViewMode] = useState<'all' | 'my-schedule'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [reservationFeedback, setReservationFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const getTrack = (trackId: string) => tracks.find(t => t.id === trackId);
  const getRoom = (roomId: string) => rooms.find(r => r.id === roomId);
  const getSponsor = (sponsorId?: string) => sponsors.find(s => s.id === sponsorId);
  const getSpeakers = (speakerIds: string[]) => profiles.filter(p => speakerIds.includes(p.id));

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Day filter
      if (session.day !== selectedDay) return false;

      // My Schedule filter
      if (activeViewMode === 'my-schedule') {
        const isReserved = session.reservedUserIds.includes(currentUser.id);
        const isWaitlisted = session.waitlistUserIds.includes(currentUser.id);
        if (!isReserved && !isWaitlisted) return false;
      }

      // Track filter
      if (selectedTrackId !== 'all' && session.trackId !== selectedTrackId) return false;

      // Room filter
      if (selectedRoomId !== 'all' && session.roomId !== selectedRoomId) return false;

      // Text Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const speakers = getSpeakers(session.speakerIds);
        const matchTitle = session.title.toLowerCase().includes(q);
        const matchDesc = session.description.toLowerCase().includes(q);
        const matchSpeaker = speakers.some(s => s.fullName.toLowerCase().includes(q) || s.department.toLowerCase().includes(q));
        const matchTag = session.tags.some(t => t.toLowerCase().includes(q));
        const room = getRoom(session.roomId);
        const matchRoom = room?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSpeaker && !matchTag && !matchRoom) return false;
      }

      return true;
    }).sort((a, b) => a.startMinutes - b.startMinutes);
  }, [sessions, selectedDay, activeViewMode, selectedTrackId, selectedRoomId, searchQuery, currentUser.id, profiles, rooms]);

  const handleReservationClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const result = onToggleReservation(session.id);
    setReservationFeedback({
      id: session.id,
      message: result.message,
      success: result.success,
    });
    setTimeout(() => {
      setReservationFeedback(null);
    }, 3500);
  };

  const myScheduleCount = useMemo(() => {
    return sessions.filter(s => 
      s.reservedUserIds.includes(currentUser.id) || s.waitlistUserIds.includes(currentUser.id)
    ).length;
  }, [sessions, currentUser.id]);

  return (
    <div className="space-y-6">
      
      {/* Top Controls: Day Tabs & Schedule Scope */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Day Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              id="day-1-tab"
              onClick={() => setSelectedDay(1)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedDay === 1
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 1: Friday, Oct 16
            </button>
            <button
              id="day-2-tab"
              onClick={() => setSelectedDay(2)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedDay === 2
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 2: Saturday, Oct 17
            </button>
          </div>

          {/* Schedule Scope: All vs My Schedule */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              id="view-all-sessions"
              onClick={() => setActiveViewMode('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeViewMode === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sessions
            </button>
            <button
              id="view-my-schedule"
              onClick={() => setActiveViewMode('my-schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeViewMode === 'my-schedule'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>My Agenda</span>
              {myScheduleCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeViewMode === 'my-schedule' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {myScheduleCount}
                </span>
              )}
            </button>
          </div>

        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          
          {/* Real-time search */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="agenda-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search talks, speakers, workshops, or tags..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Room filter */}
          <div className="md:col-span-6 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              id="agenda-room-filter"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Rooms & Venues</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.floorLabel} - Cap: {room.capacity})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Track Filter Pills (Color-coded like Sched) */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            Tracks:
          </span>
          <button
            onClick={() => setSelectedTrackId('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedTrackId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Tracks
          </button>
          {tracks.map(track => {
            const isSelected = selectedTrackId === track.id;
            return (
              <button
                key={track.id}
                onClick={() => setSelectedTrackId(isSelected ? 'all' : track.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-offset-1 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={{
                  backgroundColor: isSelected ? track.colorHex : undefined,
                  borderColor: isSelected ? track.colorHex : undefined,
                }}
              >
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : track.colorHex }}
                />
                <span>{track.name}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Global Toast for atomic reservation results */}
      {reservationFeedback && (
        <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 ${
          reservationFeedback.success 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-amber-50 text-amber-900 border border-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {reservationFeedback.success ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{reservationFeedback.message}</span>
          </div>
          <button 
            onClick={() => setReservationFeedback(null)} 
            className="text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sessions Timeline & Grid */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No sessions match your filters</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeViewMode === 'my-schedule' 
              ? 'You have not reserved or bookmarked any sessions for this day yet. Switch to "All Sessions" to browse and reserve your seats.'
              : 'Try adjusting your search query, track selection, or room filters.'}
          </p>
          {activeViewMode === 'my-schedule' && (
            <button
              onClick={() => setActiveViewMode('all')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Browse All Sessions
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map(session => {
            const track = getTrack(session.trackId);
            const room = getRoom(session.roomId);
            const sponsor = getSponsor(session.primarySponsorId);
            const speakers = getSpeakers(session.speakerIds);
            
            const isReserved = session.reservedUserIds.includes(currentUser.id);
            const isWaitlisted = session.waitlistUserIds.includes(currentUser.id);
            const reservedCount = session.reservedUserIds.length;
            const isFull = reservedCount >= session.maxAttendees;
            const seatsRemaining = Math.max(0, session.maxAttendees - reservedCount);
            const occupancyPercent = Math.min(100, Math.round((reservedCount / session.maxAttendees) * 100));

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-md cursor-pointer overflow-hidden group ${
                  isReserved 
                    ? 'border-blue-300 ring-1 ring-blue-500/20 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Session-Level Sponsor Banner (Non-negotiable requirement #4) */}
                {sponsor && (
                  <div className="bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 border-b border-slate-100 px-4 py-1.5 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Session Partner
                      </span>
                      <img 
                        src={sponsor.logoUrl} 
                        alt={sponsor.name} 
                        className="w-4 h-4 rounded-full object-cover" 
                      />
                      <span className="font-semibold text-slate-800">{sponsor.name}</span>
                      <span className="hidden sm:inline text-slate-400">• {sponsor.tagline}</span>
                    </div>
                    <span className="text-[10px] font-medium text-blue-600 flex items-center gap-0.5">
                      Sponsored Showcase
                    </span>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    
                    {/* Left details */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      
                      {/* Meta badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Time badge */}
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{session.startTime} – {session.endTime}</span>
                        </div>

                        {/* Track pill */}
                        {track && (
                          <div 
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md text-white"
                            style={{ backgroundColor: track.colorHex }}
                          >
                            <span>{track.name}</span>
                          </div>
                        )}

                        {/* Room label */}
                        {room && (
                          <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="font-medium">{room.name}</span>
                            <span className="text-slate-400 text-[11px]">({room.floorLabel})</span>
                          </div>
                        )}

                        {session.isFeatured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Featured
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {session.title}
                      </h3>

                      {/* Description snippet */}
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {session.description}
                      </p>

                      {/* Speakers Row */}
                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        {speakers.map(speaker => (
                          <div key={speaker.id} className="flex items-center gap-2">
                            <img
                              src={speaker.avatarUrl}
                              alt={speaker.fullName}
                              className="w-6 h-6 rounded-full object-cover border border-slate-200"
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-slate-800">{speaker.fullName}</span>
                              <span className="text-slate-400 ml-1 text-[11px]">({speaker.department})</span>
                            </div>
                          </div>
                        ))}

                        {/* Attached presentation slides */}
                        {session.slidesUrl && (
                          <div className="ml-auto sm:ml-2 flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Slides Attached</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Right side: Atomic Seat Capacity & RSVP Action */}
                    <div className="lg:w-64 shrink-0 flex flex-col justify-between pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5 space-y-3">
                      
                      {/* Capacity Meter (Requirement #3: Capacity Enforcement & Atomic Seat Reservations) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Room Capacity:
                          </span>
                          <span className={`font-bold ${
                            isFull 
                              ? 'text-rose-600' 
                              : seatsRemaining <= 3 
                              ? 'text-amber-600' 
                              : 'text-slate-700'
                          }`}>
                            {reservedCount} / {session.maxAttendees} seats
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFull
                                ? 'bg-rose-500'
                                : seatsRemaining <= 3
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          {isFull ? (
                            <span className="text-rose-600 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Room at Full Capacity
                            </span>
                          ) : (
                            <span className={seatsRemaining <= 3 ? 'text-amber-600 font-semibold' : ''}>
                              {seatsRemaining} seat{seatsRemaining === 1 ? '' : 's'} available
                            </span>
                          )}
                          {session.waitlistUserIds.length > 0 && (
                            <span>{session.waitlistUserIds.length} on waitlist</span>
                          )}
                        </div>
                      </div>

                      {/* Action Button: Atomic RSVP */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleReservationClick(e, session)}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                            isReserved
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                              : isWaitlisted
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                              : isFull
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                          }`}
                        >
                          {isReserved ? (
                            <>
                              <BookmarkCheck className="w-4 h-4 text-blue-600" />
                              <span>Reserved (Seat Confirmed)</span>
                            </>
                          ) : isWaitlisted ? (
                            <>
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>Waitlisted (#1 in line)</span>
                            </>
                          ) : isFull ? (
                            <>
                              <Clock className="w-4 h-4 text-slate-600" />
                              <span>Join Waitlist</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-4 h-4" />
                              <span>Reserve Seat</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSession(session);
                          }}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0 cursor-pointer"
                          title="View Session Details & Slides"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
