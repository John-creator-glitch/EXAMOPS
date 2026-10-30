import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  STATUS_LABELS, STATUS_COLORS, PLAN_LABELS, PLAN_COLORS,
  type Tenant, type TenantStatus, type TenantPlan
} from '@/types/database';
import { Plus, Search, Building2, Edit2, Trash2 } from 'lucide-react';

export default function TenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    slug: '',
    status: 'TRIAL' as TenantStatus,
    plan: 'STARTER' as TenantPlan,
    primary_color: '#1d4ed8',
    timezone: 'Asia/Karachi',
    locale: 'en',
  });

  const loadTenants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setTenants((data as Tenant[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filtered = tenants.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', short_name: '', slug: '', status: 'TRIAL', plan: 'STARTER', primary_color: '#1d4ed8', timezone: 'Asia/Karachi', locale: 'en' });
    setModalOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditing(tenant);
    setFormData({
      name: tenant.name,
      short_name: tenant.short_name || '',
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
      primary_color: tenant.primary_color,
      timezone: tenant.timezone,
      locale: tenant.locale,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (!formData.name || !formData.slug) {
      setError('Name and slug are required');
      setSaving(false);
      return;
    }

    const payload = {
      name: formData.name,
      short_name: formData.short_name || null,
      slug: formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      status: formData.status,
      plan: formData.plan,
      primary_color: formData.primary_color,
      timezone: formData.timezone,
      locale: formData.locale,
    };

    if (editing) {
      const { error } = await supabase.from('tenants').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('tenants').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }

    setSaving(false);
    loadTenants();
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Delete tenant "${tenant.name}"? This will also delete all associated data.`)) return;
    const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
    if (error) setError(error.message);
    loadTenants();
  };

  if (user?.profile?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 text-center max-w-md">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">Only Super Admins can manage tenants.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Manage universities on the platform</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Tenant
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading tenants...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No tenants found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">University</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Slug</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Plan</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Created</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: tenant.primary_color }}
                        >
                          {(tenant.short_name || tenant.slug).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{tenant.name}</p>
                          {tenant.short_name && <p className="text-xs text-slate-500">{tenant.short_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tenant.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[tenant.status]}>{STATUS_LABELS[tenant.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={PLAN_COLORS[tenant.plan]}>{PLAN_LABELS[tenant.plan]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(tenant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(tenant)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(tenant)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Tenant' : 'Add Tenant'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Tenant'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="University Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Green International University" />
          </div>
          <Input label="Short Name" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} placeholder="GIU" />
          <Input label="Slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="giu" />
          <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as TenantStatus })}>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select label="Plan" value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value as TenantPlan })}>
            <option value="STARTER">Starter</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="DEDICATED">Dedicated</option>
          </Select>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Primary Color</label>
            <div className="flex gap-2">
              <input type="color" value={formData.primary_color} onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })} className="h-10 w-12 rounded-lg border border-slate-300 cursor-pointer" />
              <input type="text" value={formData.primary_color} onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })} className="flex-1 h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            </div>
          </div>
          <Input label="Timezone" value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} placeholder="Asia/Karachi" />
        </div>
      </Modal>
    </div>
  );
}
