import React, { useState } from 'react';
import {
  ShieldCheck, CalendarPlus, Database, X, Cloud, CloudOff, ExternalLink,
  CalendarDays, DoorOpen, UtensilsCrossed, Handshake, Gift, Wallet, UserPlus, ClipboardCheck,
} from 'lucide-react';
import {
  EventConfig, UserProfile, UserRole, Session, Track, Room, MealService, Sponsor,
  Prize, CostEntry, Invite, AttendanceRecord,
} from '../../types';
import { can, ROLE_LABEL } from '../../lib/permissions';
import { AdminPeople } from './AdminPeople';
import { AdminEvents } from './AdminEvents';
import { AdminProgramme } from './AdminProgramme';
import { AdminRooms, AdminDining, AdminSponsors } from './AdminResources';
import { AdminPrizes, AdminCosts } from './AdminOperations';
import { AdminGuests } from './AdminGuests';
import { AdminAttendance } from './AdminAttendance';

interface AdminPanelProps {
  currentUser: UserProfile;
  users: UserProfile[];
  events: EventConfig[];
  sessions: Session[];
  tracks: Track[];
  rooms: Room[];
  mealServices: MealService[];
  sponsors: Sponsor[];
  prizes: Prize[];
  costs: CostEntry[];
  invites: Invite[];
  attendance: AttendanceRecord[];
  counts: Record<string, number>;
  isRemote: boolean;
  onClose: () => void;
  onChangeRole: (userId: string, role: UserRole) => Promise<void> | void;
  onSaveEvent: (event: EventConfig, isNew: boolean) => Promise<void> | void;
  onDeleteEvent: (eventId: string) => Promise<void> | void;
  onSaveSession: (session: Session, isNew: boolean) => Promise<void> | void;
  onDeleteSession: (id: string) => Promise<void> | void;
  onSaveRoom: (room: Room, isNew: boolean) => Promise<void> | void;
  onDeleteRoom: (id: string) => Promise<void> | void;
  onSaveMeal: (service: MealService, isNew: boolean) => Promise<void> | void;
  onDeleteMeal: (id: string) => Promise<void> | void;
  onSaveSponsor: (sponsor: Sponsor, isNew: boolean) => Promise<void> | void;
  onDeleteSponsor: (id: string) => Promise<void> | void;
  onSavePrize: (prize: Prize, isNew: boolean) => Promise<void> | void;
  onDeletePrize: (id: string) => Promise<void> | void;
  onSaveCost: (cost: CostEntry, isNew: boolean) => Promise<void> | void;
  onDeleteCost: (id: string) => Promise<void> | void;
  onSaveInvite: (invite: Invite, isNew: boolean) => Promise<void> | void;
  onDeleteInvite: (id: string) => Promise<void> | void;
}

type Section =
  | 'people' | 'events' | 'programme' | 'rooms' | 'dining' | 'sponsors'
  | 'prizes' | 'costs' | 'guests' | 'attendance' | 'system';

/**
 * Administration console.
 *
 * Separate from the Organizer Console, which is about running an event in
 * progress — announcements, signage, check-in. This is about the platform
 * itself: who has access, what events exist, and where the data lives.
 *
 * Every section is gated by a permission rather than a role name, so granting
 * an organiser access to part of this later is a change to the permission
 * table and not to this file.
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser, users, events, sessions, tracks, rooms, mealServices, sponsors,
  prizes, costs, invites, attendance, counts, isRemote, onClose, onChangeRole, onSaveEvent, onDeleteEvent,
  onSaveSession, onDeleteSession, onSaveRoom, onDeleteRoom,
  onSaveMeal, onDeleteMeal, onSaveSponsor, onDeleteSponsor,
  onSavePrize, onDeletePrize, onSaveCost, onDeleteCost, onSaveInvite, onDeleteInvite,
}) => {
  const mayManageRoles = can(currentUser, 'users:manage_roles');
  const mayManageEvents = can(currentUser, 'events:create');
  const mayManageSystem = can(currentUser, 'integrations:manage');

  const sections = ([
    mayManageEvents && ['events', 'Events', CalendarPlus],
    can(currentUser, 'sessions:edit_any') && ['programme', 'Programme', CalendarDays],
    can(currentUser, 'rooms:manage') && ['rooms', 'Rooms', DoorOpen],
    can(currentUser, 'dining:manage') && ['dining', 'Dining', UtensilsCrossed],
    can(currentUser, 'sponsors:manage') && ['sponsors', 'Sponsors', Handshake],
    can(currentUser, 'users:view_all') && ['guests', 'Guests', UserPlus],
    can(currentUser, 'attendance:view_all') && ['attendance', 'Attendance', ClipboardCheck],
    can(currentUser, 'luckydraw:manage') && ['prizes', 'Lucky Draw', Gift],
    can(currentUser, 'costs:view') && ['costs', 'Spend', Wallet],
    mayManageRoles && ['people', 'People & Roles', ShieldCheck],
    mayManageSystem && ['system', 'System', Database],
  ].filter(Boolean) as [Section, string, typeof ShieldCheck][]);

  const [section, setSection] = useState<Section>(sections[0]?.[0] ?? 'system');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">Administration</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Signed in as {currentUser.fullName} · {ROLE_LABEL[currentUser.role]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
          {sections.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                section === id
                  ? 'border-blue-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {section === 'people' && (
          <AdminPeople users={users} currentUser={currentUser} onChangeRole={onChangeRole} />
        )}

        {section === 'events' && (
          <AdminEvents
            events={events}
            currentUser={currentUser}
            onSave={onSaveEvent}
            onDelete={onDeleteEvent}
          />
        )}

        {section === 'programme' && (
          <AdminProgramme
            events={events} sessions={sessions} tracks={tracks} rooms={rooms}
            profiles={users} onSave={onSaveSession} onDelete={onDeleteSession}
          />
        )}

        {section === 'rooms' && (
          <AdminRooms rooms={rooms} sessions={sessions}
                      onSave={onSaveRoom} onDelete={onDeleteRoom} />
        )}

        {section === 'dining' && (
          <AdminDining mealServices={mealServices}
                       onSave={onSaveMeal} onDelete={onDeleteMeal} />
        )}

        {section === 'sponsors' && (
          <AdminSponsors sponsors={sponsors}
                         onSave={onSaveSponsor} onDelete={onDeleteSponsor} />
        )}

        {section === 'guests' && (
          <AdminGuests invites={invites} profiles={users} events={events}
                       currentUser={currentUser} onSave={onSaveInvite} onDelete={onDeleteInvite} />
        )}

        {section === 'attendance' && (
          <AdminAttendance attendance={attendance} sessions={sessions} rooms={rooms}
                           profiles={users} events={events} />
        )}

        {section === 'prizes' && (
          <AdminPrizes prizes={prizes} events={events} sponsors={sponsors} profiles={users}
                       onSave={onSavePrize} onDelete={onDeletePrize} />
        )}

        {section === 'costs' && (
          <AdminCosts costs={costs} events={events} currentUser={currentUser}
                      onSave={onSaveCost} onDelete={onDeleteCost} />
        )}

        {section === 'system' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                {isRemote
                  ? <Cloud className="w-5 h-5 text-emerald-600" />
                  : <CloudOff className="w-5 h-5 text-amber-600" />}
                <h3 className="font-bold text-slate-900">Data source</h3>
              </div>
              <div className={`rounded-xl border-2 p-4 ${
                isRemote ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="font-bold text-slate-900">
                  {isRemote ? 'Firestore — live' : 'In-memory — demo data'}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {isRemote
                    ? 'Changes are written to the shared database and are visible to everyone immediately.'
                    : 'This build is running on seeded sample data. Nothing you change here is saved, and no one else sees it. Set VITE_USE_FIRESTORE=true to connect.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-4">Collections</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(counts).map(([key, n]) => (
                  <div key={key} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="text-xl font-bold text-slate-900">{n}</div>
                    <div className="text-[11px] text-slate-500 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isRemote && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-900 mb-2">Tools</h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  The seeder writes the bundled sample catalogue. Existing documents
                  with the same ids are overwritten, so re-running it restores
                  sample content without emptying the database.
                </p>
                <a
                  href="/?setup=1"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:border-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Open the seeder
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
