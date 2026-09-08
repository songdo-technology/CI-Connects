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
import { Session, Track, Room, UserProfile, BroadcastAnnouncement } from '../types';
import { SAMPLE_CSV_TEMPLATE } from '../data/initialData';

interface AdminConsoleProps {
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  profiles: UserProfile[];
  announcements: BroadcastAnnouncement[];
  onBroadcastAnnouncement: (title: string, message: string, priority: 'normal' | 'urgent') => void;
  onImportCsvSessions: (newSessions: Session[], newTracks: Track[], newRooms: Room[], newProfiles: UserProfile[]) => {
    insertedSessionsCount: number;
    updatedSessionsCount: number;
    roomsCount: number;
    tracksCount: number;
  };
}

interface ParsedRow {
  index: number;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  track: string;
  trackColor: string;
  room: string;
  roomCapacity: number;
  speakerName: string;
  speakerEmail: string;
  speakerTitle: string;
  isValid: boolean;
  error?: string;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  sessions,
  tracks,
  rooms,
  profiles,
  announcements,
  onBroadcastAnnouncement,
  onImportCsvSessions,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'broadcast' | 'capacity'>('import');
  const [csvContent, setCsvContent] = useState<string>(SAMPLE_CSV_TEMPLATE);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importReport, setImportReport] = useState<{
    insertedSessionsCount: number;
    updatedSessionsCount: number;
    roomsCount: number;
    tracksCount: number;
  } | null>(null);

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState('Room Relocation Notice');
  const [broadcastMessage, setBroadcastMessage] = useState('Keynote Workshop starting at 10:45 AM will now begin with a 10-minute introduction.');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'urgent'>('normal');
  const [broadcastSentFeedback, setBroadcastSentFeedback] = useState(false);

  // Parse CSV
  const parseCsvText = (text: string): ParsedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const rows: ParsedRow[] = [];
    // skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV parsing with quotes
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const values: string[] = [];
      let match;
      while ((match = regex.exec(line)) && values.length < 12) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        values.push(val.trim());
      }

      const [
        title, description, date, startTime, endTime, 
        track, trackColor, room, roomCapacity, 
        speakerName, speakerEmail, speakerTitle
      ] = values;

      const isValid = Boolean(title && startTime && endTime && track && room);
      const capNum = parseInt(roomCapacity || '30', 10) || 30;

      rows.push({
        index: i,
        title: title || 'Untitled Session',
        description: description || '',
        date: date || '2026-10-16',
        startTime: startTime || '09:00 AM',
        endTime: endTime || '10:15 AM',
        track: track || 'General',
        trackColor: trackColor || '#2563EB',
        room: room || 'Main Hall',
        roomCapacity: capNum,
        speakerName: speakerName || 'Staff Presenter',
        speakerEmail: speakerEmail || 'speaker@school.edu',
        speakerTitle: speakerTitle || 'Faculty Member',
        isValid,
        error: !isValid ? 'Missing required fields (Title, Times, Track, or Room)' : undefined,
      });
    }

    return rows;
  };

  const handleRunValidation = () => {
    const parsed = parseCsvText(csvContent);
    setParsedRows(parsed);
    setImportReport(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const parsed = parseCsvText(text);
      setParsedRows(parsed);
      setImportReport(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    const validRows = parsedRows.length > 0 ? parsedRows.filter(r => r.isValid) : parseCsvText(csvContent).filter(r => r.isValid);
    if (validRows.length === 0) return;

    // Idempotent UPSERT generation
    const newRooms: Room[] = [];
    const newTracks: Track[] = [];
    const newProfiles: UserProfile[] = [];
    const newSessions: Session[] = [];

    validRows.forEach((row, idx) => {
      // 1. Resolve room
      let roomId = rooms.find(r => r.name.toLowerCase() === row.room.toLowerCase())?.id;
      if (!roomId) {
        const existingNewRoom = newRooms.find(r => r.name.toLowerCase() === row.room.toLowerCase());
        if (existingNewRoom) {
          roomId = existingNewRoom.id;
        } else {
          roomId = `room-custom-${Date.now()}-${idx}`;
          newRooms.push({
            id: roomId,
            name: row.room,
            capacity: row.roomCapacity,
            floorLabel: 'Floor 1',
            building: 'Academic Campus',
          });
        }
      }

      // 2. Resolve track
      let trackId = tracks.find(t => t.name.toLowerCase() === row.track.toLowerCase())?.id;
      if (!trackId) {
        const existingNewTrack = newTracks.find(t => t.name.toLowerCase() === row.track.toLowerCase());
        if (existingNewTrack) {
          trackId = existingNewTrack.id;
        } else {
          trackId = `track-custom-${Date.now()}-${idx}`;
          newTracks.push({
            id: trackId,
            name: row.track,
            colorHex: row.trackColor || '#2563EB',
            orderIndex: tracks.length + newTracks.length + 1,
          });
        }
      }

      // 3. Resolve speaker
      let speakerId = profiles.find(p => p.email.toLowerCase() === row.speakerEmail.toLowerCase())?.id;
      if (!speakerId) {
        const existingNewProf = newProfiles.find(p => p.email.toLowerCase() === row.speakerEmail.toLowerCase());
        if (existingNewProf) {
          speakerId = existingNewProf.id;
        } else {
          speakerId = `prof-import-${Date.now()}-${idx}`;
          newProfiles.push({
            id: speakerId,
            email: row.speakerEmail,
            fullName: row.speakerName,
            title: row.speakerTitle,
            department: 'Faculty Presenter',
            organization: 'Chadwick International',
            userType: row.speakerEmail.includes('@chadwickschool.org') ? 'internal_faculty' : 'external_guest',
            role: 'speaker',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
            bio: `${row.speakerName} presenting at KORCOS Summit.`,
            isDirectoryVisible: true,
            checkedIn: false,
          });
        }
      }

      // 4. Session
      const isDay2 = row.date.includes('17');
      newSessions.push({
        id: `sess-imported-${Date.now()}-${idx}`,
        eventId: 'evt-korcos-2026',
        roomId: roomId!,
        trackId: trackId!,
        title: row.title,
        description: row.description || 'Imported via master conference spreadsheet.',
        day: isDay2 ? 2 : 1,
        dateStr: isDay2 ? 'Saturday, Oct 17, 2026' : 'Friday, Oct 16, 2026',
        startTime: row.startTime,
        endTime: row.endTime,
        startMinutes: 660 + (idx * 30),
        endMinutes: 720 + (idx * 30),
        maxAttendees: row.roomCapacity,
        reservedUserIds: [],
        waitlistUserIds: [],
        speakerIds: [speakerId!],
        tags: [row.track, 'Spreadsheet Import'],
      });
    });

    const report = onImportCsvSessions(newSessions, newTracks, newRooms, newProfiles);
    setImportReport(report);
  };

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
              Administrative Operations & Bulk Ingestion Engine
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Organizer Console
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Replicate Sched's spreadsheet-first workflow with idempotent CSV uploads, live capacity monitoring, and campus emergency announcements.
          </p>
        </div>

        {/* Console Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'import' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spreadsheet Importer
          </button>
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
        </div>
      </div>

      {/* Tab 1: Spreadsheet Importer */}
      {activeTab === 'import' && (
        <div className="space-y-5">
          
          {/* Ingestion Workflow Explainer */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-4 rounded-2xl border border-blue-100 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Idempotent Database UPSERT Workflow</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Organizers can repeatedly re-upload this CSV workbook without generating duplicate records, severing attendee bookmarks, or invalidating user accounts. Rooms, tracks, and speakers are automatically matched or provisioned on the fly.
            </p>
          </div>

          {/* Import Controls */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">CSV Ingestion Pipeline</h3>
                <p className="text-xs text-slate-500">Edit the workbook data below or upload an external .csv file</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload .CSV File</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleRunValidation}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Validate Rows
                </button>

                <button
                  onClick={handleExecuteImport}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Execute Idempotent Import</span>
                </button>
              </div>
            </div>

            {/* Editable Raw CSV Text Box */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Spreadsheet Raw Text (12 Column Schema):</span>
                <span className="text-[11px] text-slate-400 font-mono">Title, Description, Date, StartTime, EndTime, Track...</span>
              </label>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-normal"
              />
            </div>

            {/* Ingestion Report Success Banner */}
            {importReport && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ingestion Completed Successfully!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-medium text-emerald-800">
                  <div className="bg-white/60 p-2 rounded-lg">
                    <span>New Sessions: </span><strong>+{importReport.insertedSessionsCount}</strong>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg">
                    <span>New Tracks: </span><strong>+{importReport.tracksCount}</strong>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg">
                    <span>New Rooms: </span><strong>+{importReport.roomsCount}</strong>
                  </div>
                  <div className="bg-white/60 p-2 rounded-lg">
                    <span>Total Active Sessions: </span><strong>{sessions.length}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pre-flight Row Validation ({parsedRows.length} rows parsed)
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Session Title</th>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Track</th>
                        <th className="p-2.5">Room & Cap</th>
                        <th className="p-2.5">Speaker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {parsedRows.map((row) => (
                        <tr key={row.index} className={row.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/50'}>
                          <td className="p-2.5">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded" title={row.error}>
                                Error
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 max-w-xs truncate">{row.title}</td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">{row.startTime}–{row.endTime}</td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: row.trackColor }}
                            >
                              {row.track}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">{row.room} ({row.roomCapacity})</td>
                          <td className="p-2.5 text-slate-700 max-w-xs truncate">{row.speakerName} ({row.speakerEmail})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Tab 2: Live Announcements Broadcaster */}
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
