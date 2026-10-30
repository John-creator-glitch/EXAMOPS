import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Faculty } from '@/types/database';
import { Plus, Search, Users, Edit2, Trash2, Mail, Phone, Briefcase } from 'lucide-react';

export default function FacultyPage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    max_duties_per_day: 2,
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadFaculty = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('faculty').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setFaculty((data as Faculty[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFaculty(); }, [loadFaculty]);

  const departments = [...new Set(faculty.map((f) => f.department).filter(Boolean))] as string[];

  const filtered = faculty.filter((f) => {
    const matchesSearch = f.full_name.toLowerCase().includes(search.toLowerCase()) || f.employee_id.toLowerCase().includes(search.toLowerCase()) || (f.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || f.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ employee_id: '', full_name: '', email: '', phone: '', department: '', designation: '', max_duties_per_day: 2, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (f: Faculty) => {
    setEditing(f);
    setFormData({ employee_id: f.employee_id, full_name: f.full_name, email: f.email || '', phone: f.phone || '', department: f.department || '', designation: f.designation || '', max_duties_per_day: f.max_duties_per_day, is_active: f.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.employee_id || !formData.full_name || !tenantId) {
      setError('Employee ID and name are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      employee_id: formData.employee_id,
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone || null,
      department: formData.department || null,
      designation: formData.designation || null,
      max_duties_per_day: formData.max_duties_per_day,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('faculty').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('faculty').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadFaculty();
  };

  const handleDelete = async (f: Faculty) => {
    if (!confirm(`Delete faculty member "${f.full_name}"?`)) return;
    const { error } = await supabase.from('faculty').delete().eq('id', f.id);
    if (error) setError(error.message);
    loadFaculty();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty</h1>
          <p className="text-sm text-slate-500 mt-1">Manage teaching staff and invigilators</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Faculty
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Faculty</p><p className="text-2xl font-bold text-slate-900 mt-1">{filtered.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Departments</p><p className="text-2xl font-bold text-slate-900 mt-1">{departments.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-slate-900 mt-1">{filtered.filter(f => f.is_active).length}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search by name, employee ID, or email..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-56">
          <select className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading faculty...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No faculty members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Emp ID</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Name</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Department</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Designation</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Contact</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Max Duties</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{f.employee_id}</code></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">{f.full_name.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-slate-900">{f.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{f.department || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{f.designation || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                        {f.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{f.email}</span>}
                        {f.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.phone}</span>}
                        {!f.email && !f.phone && '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge className="bg-amber-100 text-amber-800 border-amber-200">{f.max_duties_per_day}/day</Badge></td>
                    <td className="px-4 py-3">{f.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(f)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(f)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Faculty' : 'Add Faculty'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Faculty'}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} placeholder="EMP-001" />
            <Input label="Full Name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Dr. John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@university.edu" />
            <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+92 300 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="Computer Science" />
            <Input label="Designation" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="Professor" />
          </div>
          <Input label="Max Invigilation Duties Per Day" type="number" min={1} max={6} value={formData.max_duties_per_day} onChange={(e) => setFormData({ ...formData, max_duties_per_day: parseInt(e.target.value) || 1 })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <div className="flex gap-3">
              <button onClick={() => setFormData({ ...formData, is_active: true })} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formData.is_active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Active</button>
              <button onClick={() => setFormData({ ...formData, is_active: false })} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${!formData.is_active ? 'border-slate-500 bg-slate-50 text-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Inactive</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
