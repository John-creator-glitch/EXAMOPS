import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  ROLE_LABELS, ROLE_COLORS,
  type Profile, type UserRole, type Tenant
} from '@/types/database';
import { Search, Users as UsersIcon, Shield, CheckCircle, XCircle, Mail } from 'lucide-react';

interface ProfileWithTenant extends Profile {
  tenant?: Tenant | null;
  email?: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithTenant[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileWithTenant | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('VIEWER');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.profile?.role === 'SUPER_ADMIN';
  const isTenantAdmin = user?.profile?.role === 'TENANT_ADMIN' || isSuperAdmin;

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        tenant:tenants(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProfiles((data as ProfileWithTenant[]) || []);
    }
    setLoading(false);
  }, []);

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return;
    const { data } = await supabase.from('tenants').select('*').order('name');
    setTenants((data as Tenant[]) || []);
  }, [isSuperAdmin]);

  useEffect(() => {
    loadProfiles();
    loadTenants();
  }, [loadProfiles, loadTenants]);

  const filtered = profiles.filter((p) => {
    const name = p.full_name.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || (p.email || '').includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openEdit = (profile: ProfileWithTenant) => {
    setEditing(profile);
    setEditRole(profile.role);
    setEditActive(profile.is_active);
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from('profiles')
      .update({ role: editRole, is_active: editActive })
      .eq('id', editing.id);

    if (error) {
      setError(error.message);
    } else {
      setEditModalOpen(false);
      loadProfiles();
    }
    setSaving(false);
  };

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 text-center max-w-md">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">Only admins can manage users.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isSuperAdmin ? 'Manage all users across tenants' : 'Manage users in your university'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="TENANT_ADMIN">Tenant Admin</option>
            <option value="EXAM_OFFICER">Exam Officer</option>
            <option value="REGISTRAR">Registrar</option>
            <option value="HOD">Head of Department</option>
            <option value="FACULTY">Faculty</option>
            <option value="VIEWER">Viewer</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <UsersIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">User</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Role</th>
                  {isSuperAdmin && <th className="text-left font-semibold text-slate-700 px-4 py-3">Tenant</th>}
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Joined</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                          {profile.full_name.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{profile.full_name || 'Unnamed'}</p>
                          {profile.email && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {profile.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ROLE_COLORS[profile.role]}>{ROLE_LABELS[profile.role]}</Badge>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-slate-600">
                        {profile.tenant?.name || (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {profile.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(profile)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                {editing.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900">{editing.full_name}</p>
                {editing.email && <p className="text-xs text-slate-500">{editing.email}</p>}
              </div>
            </div>

            <Select label="Role" value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
              <option value="VIEWER">Viewer</option>
              <option value="FACULTY">Faculty</option>
              <option value="HOD">Head of Department</option>
              <option value="REGISTRAR">Registrar</option>
              <option value="EXAM_OFFICER">Exam Officer</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Status</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditActive(true)}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                    editActive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setEditActive(false)}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                    !editActive ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
