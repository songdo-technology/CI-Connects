import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, AlertTriangle, Check } from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { ROLE_LABEL, ROLE_DESCRIPTION, can, assignableRoles } from '../../lib/permissions';
import { BOOTSTRAP_ADMIN_EMAILS } from '../../lib/auth';

interface AdminPeopleProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onChangeRole: (userId: string, role: UserRole) => Promise<void> | void;
}

const ROLE_ORDER: UserRole[] =
  ['technical_admin', 'event_organizer', 'speaker', 'sponsor', 'front_desk', 'attendee'];

const ROLE_CHIP: Record<UserRole, string> = {
  technical_admin: 'bg-blue-600 text-white',
  event_organizer: 'bg-emerald-700 text-white',
  speaker:         'bg-amber-600 text-white',
  sponsor:         'bg-indigo-600 text-white',
  front_desk:      'bg-slate-600 text-white',
  attendee:        'bg-slate-100 text-slate-700 border border-slate-300',
};

/**
 * Role management.
 *
 * This is what removes the dependency on the bootstrap list in auth.ts: once a
 * real administrator exists, further administrators are made here rather than
 * by editing source and redeploying rules.
 *
 * Two guards matter. An administrator cannot change their own role, because
 * the obvious mistake — demoting yourself — locks the last admin out of the
 * only screen that could undo it. And the last remaining administrator cannot
 * be demoted by anyone, for the same reason from the other direction.
 */
export const AdminPeople: React.FC<AdminPeopleProps> = ({ users, currentUser, onChangeRole }) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mayManage = can(currentUser, 'users:manage_roles');
  const options = assignableRoles(currentUser);

  const adminCount = users.filter((u) => u.role === 'technical_admin').length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => roleFilter === 'all' || u.role === roleFilter)
      .filter((u) =>
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q))
      .sort((a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.fullName.localeCompare(b.fullName));
  }, [users, query, roleFilter]);

  /** Why a given user's role cannot be changed, or null if it can. */
  const lockReason = (u: UserProfile): string | null => {
    if (!mayManage) return 'You do not have permission to change roles.';
    if (u.id === currentUser.id) {
      return 'You cannot change your own role — that is how an administrator locks themselves out.';
    }
    if (u.role === 'technical_admin' && adminCount <= 1) {
      return 'This is the last technical admin. Promote someone else first.';
    }
    return null;
  };

  const change = async (u: UserProfile, role: UserRole) => {
    setError(null);
    setSaving(u.id);
    try {
      await onChangeRole(u.id, role);
      setSaved(u.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      setError(`Could not update ${u.fullName}: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">People &amp; roles</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {users.length} accounts · {adminCount} technical admin{adminCount === 1 ? '' : 's'}.
          Roles take effect immediately and are enforced by the security rules,
          not just the interface.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or department…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All roles</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400 italic">
            No accounts match that search.
          </p>
        )}

        {visible.map((u) => {
          const locked = lockReason(u);
          const isBootstrap = BOOTSTRAP_ADMIN_EMAILS.includes(u.email.toLowerCase());
          return (
            <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 truncate">{u.fullName}</span>
                  {u.id === currentUser.id && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      You
                    </span>
                  )}
                  {isBootstrap && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                      Bootstrap
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
                {u.department && (
                  <div className="text-[11px] text-slate-400 truncate">{u.department}</div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${ROLE_CHIP[u.role]}`}>
                  {ROLE_LABEL[u.role]}
                </span>

                {locked ? (
                  <span className="text-[11px] text-slate-400 max-w-[16rem] leading-snug" title={locked}>
                    {locked}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      disabled={saving === u.id}
                      onChange={(e) => change(u, e.target.value as UserRole)}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                      title={ROLE_DESCRIPTION[u.role]}
                    >
                      {options.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                    {saved === u.id && <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-3">What each role can do</h4>
        <dl className="space-y-2">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="sm:w-40 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ROLE_CHIP[r]}`}>
                  {ROLE_LABEL[r]}
                </span>
              </dt>
              <dd className="text-xs text-slate-600 leading-relaxed">{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
