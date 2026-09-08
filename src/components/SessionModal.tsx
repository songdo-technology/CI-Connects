import React from 'react';
import { 
  X, 
  Clock, 
  MapPin, 
  Users, 
  Download, 
  FileText, 
  ExternalLink, 
  BookmarkCheck, 
  Bookmark, 
  CalendarPlus, 
  Building2, 
  Sparkles,
  Share2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { Session, Track, Room, Sponsor, UserProfile } from '../types';

interface SessionModalProps {
  session: Session | null;
  onClose: () => void;
  tracks: Track[];
  rooms: Room[];
  sponsors: Sponsor[];
  profiles: UserProfile[];
  currentUser: UserProfile;
  onToggleReservation: (sessionId: string) => { success: boolean; message: string };
  onNavigateToCommunity: (searchTag?: string) => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({
  session,
  onClose,
  tracks,
  rooms,
  sponsors,
  profiles,
  currentUser,
  onToggleReservation,
  onNavigateToCommunity,
}) => {
  if (!session) return null;

  const track = tracks.find(t => t.id === session.trackId);
  const room = rooms.find(r => r.id === session.roomId);
  const sponsor = sponsors.find(s => s.id === session.primarySponsorId);
  const speakers = profiles.filter(p => session.speakerIds.includes(p.id));

  const isReserved = session.reservedUserIds.includes(currentUser.id);
  const isWaitlisted = session.waitlistUserIds.includes(currentUser.id);
  const reservedCount = session.reservedUserIds.length;
  const isFull = reservedCount >= session.maxAttendees;
  const seatsRemaining = Math.max(0, session.maxAttendees - reservedCount);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {track && (
                <span 
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: track.colorHex }}
                >
                  {track.name}
                </span>
              )}
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                Day {session.day}: {session.dateStr}
              </span>
              {session.isFeatured && (
                <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Keynote
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {session.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 flex-1">
          
          {/* Key Logistics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs sm:text-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Scheduled Time</p>
                <p className="font-bold text-slate-900">{session.startTime} – {session.endTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-700">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Room & Campus Wing</p>
                <p className="font-bold text-slate-900">{room?.name}</p>
                <p className="text-xs text-slate-500">{room?.floorLabel} • {room?.building}</p>
              </div>
            </div>
          </div>

          {/* Session Abstract & Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Session Abstract
            </h3>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {session.description}
            </p>
          </div>

          {/* Session-Level Sponsor Showcase (Non-Negotiable Requirement #4) */}
          {sponsor && (
            <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Featured Session Partner
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {sponsor.tier} Partner
                </span>
              </div>
              <div className="flex items-start gap-3">
                <img
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900">{sponsor.name}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{sponsor.description}</p>
                  <a
                    href={sponsor.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 mt-1"
                  >
                    <span>Visit Partner Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Presentation Slides Attachment */}
          {session.slidesUrl && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {session.slidesName || 'Presentation-Deck.pdf'}
                  </p>
                  <p className="text-[11px] text-slate-500">Official conference slide deck for offline review</p>
                </div>
              </div>
              <a
                href={session.slidesUrl}
                download
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Downloading ${session.slidesName || 'presentation slides'} (simulated download).`);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
          )}

          {/* Presenters Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Presenters & Facilitators
            </h3>
            <div className="space-y-3">
              {speakers.map(speaker => (
                <div key={speaker.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-start gap-3">
                  <img
                    src={speaker.avatarUrl}
                    alt={speaker.fullName}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{speaker.fullName}</h4>
                      {speaker.userType === 'internal_faculty' && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Faculty
                        </span>
                      )}
                      {speaker.userType === 'external_guest' && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Guest Speaker
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{speaker.title} • {speaker.organization}</p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{speaker.bio}</p>
                    
                    {speaker.linkedInUrl && (
                      <a
                        href={speaker.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                      >
                        LinkedIn profile
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {session.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              <span className="text-xs font-semibold text-slate-400">Tags:</span>
              {session.tags.map(tag => (
                <span key={tag} className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Modal Sticky Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span>
              <strong>{reservedCount}</strong> of <strong>{session.maxAttendees}</strong> seats booked
            </span>
            {isFull && (
              <span className="text-rose-600 font-bold ml-1 flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" />
                (Full)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose();
                onNavigateToCommunity(session.title);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Discuss this session in Community Board"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Discuss</span>
            </button>

            <button
              onClick={() => onToggleReservation(session.id)}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                isReserved
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : isWaitlisted
                  ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                  : isFull
                  ? 'bg-slate-800 text-white hover:bg-slate-900'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isReserved ? (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Cancel Reservation</span>
                </>
              ) : isWaitlisted ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Leave Waitlist</span>
                </>
              ) : isFull ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Join Session Waitlist</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Reserve Seat (Atomic RSVP)</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
