import React, { useState } from 'react';
import { 
  Search, 
  Mail, 
  MessageSquare, 
  ShieldCheck, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Users, 
  Filter, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  Lock, Linkedin } from 'lucide-react';
import { can } from '../lib/permissions';
import { UserProfile, AttendeeType } from '../types';

interface DirectoryViewProps {
  profiles: UserProfile[];
  currentUser: UserProfile;
  onToggleDirectoryVisibility: () => void;
  onMessage: (userId: string) => void;
  onViewContactCard: (profile: UserProfile) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  profiles,
  currentUser,
  onMessage,
  onViewContactCard,
  onToggleDirectoryVisibility,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  const departments = Array.from(new Set(profiles.map(p => p.department)));

  const filteredProfiles = profiles.filter(profile => {
    // Privacy check: If not visible, only organizers/admins or the user themselves can see it,
    // otherwise it's hidden from the public roster
    const isSelf = profile.id === currentUser.id;
    const isAdmin = can(currentUser, 'users:view_all');
    if (!profile.isDirectoryVisible && !isSelf && !isAdmin) {
      return false;
    }

    // Type filter
    if (selectedTypeFilter === 'internal') {
      if (profile.userType !== 'internal_faculty' && profile.userType !== 'internal_staff') return false;
    } else if (selectedTypeFilter === 'external') {
      if (profile.userType !== 'external_guest') return false;
    }

    // Department filter
    if (selectedDeptFilter !== 'all' && profile.department !== selectedDeptFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = profile.fullName.toLowerCase().includes(q);
      const matchTitle = profile.title.toLowerCase().includes(q);
      const matchDept = profile.department.toLowerCase().includes(q);
      const matchOrg = profile.organization.toLowerCase().includes(q);
      const matchInterests = profile.interests?.some(i => i.toLowerCase().includes(q));
      if (!matchName && !matchTitle && !matchDept && !matchOrg && !matchInterests) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Privacy Control Card for the logged-in User (Requirement #6) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Directory Privacy Settings
            </span>
            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-slate-300">
              Attendee Sovereignty
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            Public Directory Visibility for {currentUser.fullName}
          </h3>
          <p className="text-xs text-slate-300 max-w-xl">
            {currentUser.isDirectoryVisible 
              ? 'Your profile, title, and contact links are currently visible in the conference directory so colleagues can connect.'
              : 'Your profile is currently private (opted out). Other attendees cannot see your listing in this directory.'}
          </p>
        </div>

        <button
          id="toggle-directory-privacy"
          onClick={onToggleDirectoryVisibility}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm ${
            currentUser.isDirectoryVisible
              ? 'bg-white text-slate-900 hover:bg-slate-100'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {currentUser.isDirectoryVisible ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-700" />
              <span>Opt Out / Hide Me</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-white" />
              <span>Make Visible to Colleagues</span>
            </>
          )}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, title, department, or interests..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Type Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Attendees</option>
              <option value="internal">School Faculty & Staff (SSO)</option>
              <option value="external">External Guests & Speakers</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
          <span>Showing {filteredProfiles.length} of {profiles.length} registered conference attendees</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">Verified Google SSO & Guest Access</span>
        </div>
      </div>

      {/* Attendee Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfiles.map(profile => {
          const isSelf = profile.id === currentUser.id;
          return (
            <div 
              key={profile.id}
              className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-4 ${
                isSelf ? 'border-blue-300 ring-1 ring-blue-500/20 shadow-xs' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="relative">
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                    />
                    {profile.checkedIn && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white" title="Checked in at venue">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {profile.userType === 'internal_faculty' && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Faculty SSO
                      </span>
                    )}
                    {profile.userType === 'internal_staff' && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Staff SSO
                      </span>
                    )}
                    {profile.userType === 'external_guest' && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        External Guest
                      </span>
                    )}
                    {profile.userType === 'student' && (
                      <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        Student Ambassador
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                        You
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    {profile.fullName}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {profile.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span>{profile.department} • {profile.organization}</span>
                  </p>
                </div>

                {/* Bio */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {profile.bio}
                </p>

                {/* Interests Pills */}
                {profile.interests && profile.interests.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    {profile.interests.map(interest => (
                      <span key={interest} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact routes: email, LinkedIn, and in-platform messaging */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {profile.allowMessages === false ? (
                  <div className="w-full py-2 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Messages turned off</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onMessage(profile.id)}
                    className="w-full py-2 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                    title={`Send email to ${profile.email}`}
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Email</span>
                  </a>

                  {profile.linkedInUrl ? (
                    <a
                      href={profile.linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700 flex items-center justify-center gap-1.5 transition-colors"
                      title={`Open ${profile.fullName}'s LinkedIn profile`}
                    >
                      <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                      <span>LinkedIn</span>
                    </a>
                  ) : (
                    <span className="flex-1 text-center text-[11px] text-slate-400 italic py-1.5">
                      No LinkedIn
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onViewContactCard(profile)}
                  className="w-full text-[11px] font-semibold text-slate-400 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  View contact card
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
