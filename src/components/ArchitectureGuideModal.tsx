import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Database, 
  ShieldCheck, 
  Cpu, 
  Smartphone, 
  CheckCircle2, 
  Code2, 
  FileSpreadsheet, 
  Calendar, 
  ExternalLink,
  Lock,
  ArrowRight
} from 'lucide-react';

interface ArchitectureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureGuideModal: React.FC<ArchitectureGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'schema' | 'auth' | 'capacity' | 'pwa'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                CI Connects: Architectural Blueprint
              </h2>
              <p className="text-xs text-slate-500">
                Engineering specification & implementation notes based on your architecture document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto scrollbar-none py-2 text-xs font-semibold">
          <button
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'overview' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Core Strategy (Sched + Whova)
          </button>
          <button
            onClick={() => setActiveSection('auth')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'auth' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Dual SSO & Domain Governance
          </button>
          <button
            onClick={() => setActiveSection('capacity')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'capacity' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Atomic Capacity Reservations
          </button>
          <button
            onClick={() => setActiveSection('schema')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'schema' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. PostgreSQL Schema & RLS
          </button>
          <button
            onClick={() => setActiveSection('pwa')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeSection === 'pwa' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5. PWA vs Native App Stores
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          
          {/* Section 1: Overview */}
          {activeSection === 'overview' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-2">
                <h3 className="text-sm font-bold text-indigo-900">
                  Deconstructing Sched & Whova to Eliminate Commercial Bloat
                </h3>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  Commercial platforms bundle monetization engines, payment gateways, sponsor lead traps, and push ads designed for trade shows. For an internal or educational summit (like KORCOS or Chadwick), these introduce friction and privacy concerns.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    Retained from Sched
                  </span>
                  <ul className="text-xs space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Multi-track chronological grid</li>
                    <li>Room capacity limits & waitlists</li>
                    <li>Speaker presentation slide hosting</li>
                    <li>Idempotent spreadsheet ingestion</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                    Retained from Whova
                  </span>
                  <ul className="text-xs space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Community discussion boards</li>
                    <li>Self-organized lunch meetups</li>
                    <li>Searchable colleague directory</li>
                    <li>Real-time emergency broadcast toasts</li>
                  </ul>
                </div>

                <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Excised Commercial Bloat
                  </span>
                  <ul className="text-xs space-y-1.5 text-rose-800 list-disc list-inside">
                    <li>No paid ticketing or merchant fees</li>
                    <li>No invasive lead retrieval scanning</li>
                    <li>No spammy automated email marketing</li>
                    <li>Zero 3rd-party SaaS licensing fees</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Auth */}
          {activeSection === 'auth' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Dual Identity & Google Workspace SSO with Domain Claim (`hd`)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Internal faculty and staff authenticate through Google Workspace SSO with the <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">hd=chadwickschool.org</code> claim. The server validates both cryptographic JWT signatures and the authoritative enterprise domain, denying unverified personal Gmail addresses. External guests and speakers register via passwordless email Magic Links with restricted privileges.
                </p>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto space-y-2">
                <p className="text-slate-400">// Server-side verification callback in NextAuth / Auth.js</p>
                <p className="text-blue-300">async signIn(&#123; account, profile &#125;) &#123;</p>
                <p className="pl-4 text-emerald-300">const isVerified = profile?.email_verified === true;</p>
                <p className="pl-4 text-emerald-300">const hasValidDomain = profile?.hd === "chadwickschool.org";</p>
                <p className="pl-4 text-purple-300">if (isVerified && hasValidDomain) &#123;</p>
                <p className="pl-8 text-slate-300">return true; // Authorize internal faculty / staff role</p>
                <p className="pl-4">&#125;</p>
                <p className="pl-4 text-amber-300">return false; // Reject or route to guest access</p>
                <p>&#125;</p>
              </div>
            </div>
          )}

          {/* Section 3: Capacity */}
          {activeSection === 'capacity' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Atomic Seat Capacity Enforcement & Anti-Overbooking
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Unlike a generic schedule where attendees merely bookmark sessions, physical conference rooms have strict fire code capacities. Client-side checks fail under concurrent clicks. The platform uses an atomic PostgreSQL function with row-locking (<code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">FOR UPDATE</code>):
                </p>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto space-y-1">
                <p className="text-slate-400">-- Atomic RSVP procedure executing within a single transaction</p>
                <p className="text-blue-300">CREATE OR REPLACE FUNCTION reserve_session_seat(target_session_id uuid, target_user_id uuid)</p>
                <p className="text-blue-300">RETURNS json AS $$</p>
                <p className="pl-4 text-slate-400">-- Lock the session row to prevent race conditions</p>
                <p className="pl-4 text-emerald-300">SELECT max_attendees INTO max_cap FROM sessions WHERE id = target_session_id FOR UPDATE;</p>
                <p className="pl-4 text-emerald-300">SELECT count(*) INTO current_count FROM personal_schedules WHERE session_id = target_session_id;</p>
                <p className="pl-4 text-amber-300">IF max_cap IS NOT NULL AND current_count &gt;= max_cap THEN</p>
                <p className="pl-8 text-rose-300">RETURN json_build_object('success', false, 'message', 'Room capacity reached.');</p>
                <p className="pl-4">END IF;</p>
                <p className="pl-4 text-emerald-300">INSERT INTO personal_schedules (user_id, session_id) VALUES (target_user_id, target_session_id);</p>
                <p className="pl-4 text-purple-300">RETURN json_build_object('success', true, 'message', 'Seat confirmed.');</p>
                <p>$$ LANGUAGE plpgsql;</p>
              </div>
            </div>
          )}

          {/* Section 4: Schema */}
          {activeSection === 'schema' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Normalized Relational PostgreSQL Schema & Row-Level Security
                </h3>
                <p className="text-xs text-slate-600">
                  The data model isolates tenant events while linking sessions to rooms, tracks, speakers, and sponsors:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong className="text-slate-900 font-mono">1. profiles</strong>
                  <p className="text-slate-500 mt-1">UUID, email, full_name, user_type (faculty/guest), role (attendee/speaker/admin), avatar_url, is_directory_visible.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong className="text-slate-900 font-mono">2. sessions</strong>
                  <p className="text-slate-500 mt-1">UUID, event_id, room_id, track_id, title, start_time, end_time, max_attendees, slides_url, primary_sponsor_id.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong className="text-slate-900 font-mono">3. personal_schedules</strong>
                  <p className="text-slate-500 mt-1">Unique composite constraint (user_id, session_id). RLS ensures users only read & modify their own records.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong className="text-slate-900 font-mono">4. community_topics</strong>
                  <p className="text-slate-500 mt-1">Author UUID, title, content, category (meetups/general), location, meetup_time, rsvp counts.</p>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: PWA */}
          {activeSection === 'pwa' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Why PWA Outperforms Native App Store Binaries
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Commercial platforms like Whova force attendees to download iOS and Android native apps. For institutional conferences, native app store reviews (24–72 hours) prevent live bug fixes during the event. A Progressive Web App (PWA) with Service Worker caching provides instant home-screen installability and full offline agenda resilience during venue Wi-Fi congestion.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Integrated In This Prototype:</span>
                </div>
                <p className="text-slate-600">
                  Use the <strong>"Mobile App"</strong> switch in the header bar above to experience the prototype inside a simulated iPhone/Android frame with bottom tab navigation, digital wallet pass, and touch-optimized layout!
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Chadwick School / KORCOS Summit Architecture
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Blueprint
          </button>
        </div>

      </div>
    </div>
  );
};
