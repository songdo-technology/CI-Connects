import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Radio, 
  Users, 
  Calendar, 
  Database, 
  Sliders, 
  Sparkles,
  ShieldCheck,
  Send
} from 'lucide-react';
import { Session, Track, Room, UserProfile, BroadcastAnnouncement, MealService, AttendanceRecord, EventConfig, FeedbackEntry } from '../types';
import { SignageControl } from './SignageControl';
import { FeedbackReport } from './FeedbackReport';

interface AdminConsoleProps {
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  profiles: UserProfile[];
  announcements: BroadcastAnnouncement[];
  onBroadcastAnnouncement: (title: string, message: string, priority: 'normal' | 'urgent') => void;
  mealServices: MealService[];
  attendance: AttendanceRecord[];
  feedback: FeedbackEntry[];
  event: EventConfig;
}


export const AdminConsole: React.FC<AdminConsoleProps> = ({
  event,
  sessions,
  rooms,
  profiles,
  announcements,
  mealServices,
  attendance,
  feedback,
  onBroadcastAnnouncement,
}) => {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'capacity' | 'signage' | 'feedback'>('broadcast');

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState('Room Relocation Notice');
  const [broadcastMessage, setBroadcastMessage] = useState('Keynote Workshop starting at 10:45 AM will now begin with a 10-minute introduction.');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'urgent'>('normal');
  const [broadcastSentFeedback, setBroadcastSentFeedback] = useState(false);


  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    onBroadcastAnnouncement(broadcastTitle.trim(), broadcastMessage.trim(), broadcastPriority);
    setBroadcastSentFeedback(true);
    setTimeout(() => setBroadcastSentFeedback(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Event operations
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              {event.shortName}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Announcements, room capacity, signage and feedback for the event while it is on.
            The programme, rooms, guests and spreadsheet imports live in Admin.
          </p>
        </div>

        {/* Console Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'broadcast' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Announcements
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'capacity' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Capacity Audit
          </button>
          <button
            onClick={() => setActiveTab('signage')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'signage' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Digital Signage
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'feedback' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Feedback Report
          </button>
        </div>
      </div>

      {/* Live announcements */}
      {activeTab === 'broadcast' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Campus Emergency & Schedule Shift Broadcaster
            </h3>
            <p className="text-xs text-slate-500">
              Push real-time alert banners across attendee screens via WebSockets/Web Push. Use for room relocations, bus delays, or schedule updates.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs max-w-xl">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alert Headline</label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Urgent Room Relocation"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Message Description</label>
              <textarea
                rows={3}
                required
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Describe the schedule change or emergency instruction..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={broadcastPriority === 'normal'}
                  onChange={() => setBroadcastPriority('normal')}
                />
                <span>Normal Alert (Amber Banner)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-rose-700 font-bold">
                <input
                  type="radio"
                  name="priority"
                  checked={broadcastPriority === 'urgent'}
                  onChange={() => setBroadcastPriority('urgent')}
                />
                <span>Urgent Emergency (Red Banner)</span>
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Announcement Now</span>
            </button>

            {broadcastSentFeedback && (
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Alert active and pushed to attendee screens!
              </p>
            )}
          </form>
        </div>
      )}

      {activeTab === 'feedback' && (
        <FeedbackReport
          feedback={feedback}
          sessions={sessions}
          mealServices={mealServices}
          profiles={profiles}
        />
      )}

      {activeTab === 'signage' && (
        <SignageControl event={event} rooms={rooms} sessions={sessions} />
      )}

      {/* Tab 3: Capacity Audit */}
      {activeTab === 'capacity' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Atomic Room Capacity Monitoring</h3>
              <p className="text-xs text-slate-500">Real-time breakdown of seat reservations vs fire code limits</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">{sessions.length} sessions active</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Session Title</th>
                  <th className="p-2.5">Day & Time</th>
                  <th className="p-2.5">Room</th>
                  <th className="p-2.5">Cap Limit</th>
                  <th className="p-2.5">Reserved</th>
                  <th className="p-2.5">Occupancy %</th>
                  <th className="p-2.5">Waitlist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sessions.map(s => {
                  const room = rooms.find(r => r.id === s.roomId);
                  const occupancy = Math.round((s.reservedUserIds.length / s.maxAttendees) * 100);
                  const isFull = s.reservedUserIds.length >= s.maxAttendees;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-bold text-slate-900 max-w-xs truncate">{s.title}</td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">Day {s.day} • {s.startTime}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{room?.name}</td>
                      <td className="p-2.5 text-slate-600">{s.maxAttendees}</td>
                      <td className="p-2.5">
                        <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-slate-800'}`}>
                          {s.reservedUserIds.length}
                        </span>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isFull ? 'bg-rose-500' : occupancy > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, occupancy)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500">{occupancy}%</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        {s.waitlistUserIds.length > 0 ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                            {s.waitlistUserIds.length} waiting
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
