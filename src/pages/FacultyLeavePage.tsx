import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { FacultyLeave, Faculty } from '@/types/database';
import { Plus, Search, CalendarX, Edit2, Trash2, Plane } from 'lucide-react';

export default function FacultyLeavePage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<FacultyLeave[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FacultyLeave | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    faculty_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [leaveRes, facultyRes] = await Promise.all([
      supabase.from('faculty_leave').select('*, faculty:faculty(*)').order('start_date', { ascending: false }),
      supabase.from('faculty').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (leaveRes.error) setError(leaveRes.error.message);
    else setLeaves((leaveRes.data as FacultyLeave[]) || []);
    if (facultyRes.error) setError(facultyRes.error.message);
    else setFaculty((facultyRes.data as Faculty[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = leaves.filter((l) => {
    const name = l.faculty?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const openCreate = () => {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ faculty_id: faculty[0]?.id || '', start_date: today, end_date: today, reason: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (l: FacultyLeave) => {
    setEditing(l);
    setFormData({ faculty_id: l.faculty_id, start_date: l.start_date, end_date: l.end_date, reason: l.reason || '', is_active: l.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.faculty_id || !formData.start_date || !formData.end_date || !tenantId) {
      setError('Faculty, start date, and end date are required');
      setSaving(false);
      return;
    }
    if (formData.end_date < formData.start_date) {
      setError('End date cannot be before start date');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      faculty_id: formData.faculty_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason || null,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('faculty_leave').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('faculty_leave').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (l: FacultyLeave) => {
    if (!confirm(`Delete leave record for ${l.faculty?.full_name}?`)) return;
    const { error } = await supabase.from('faculty_leave').delete().eq('id', l.id);
    if (error) setError(error.message);
    loadData();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty Leave</h1>
          <p className="text-sm text-slate-500 mt-1">Manage faculty leave periods — the scheduler excludes these faculty from invigilator assignment</p>
        </div>
        <Button onClick={openCreate} disabled={faculty.length === 0}>
          <Plus className="h-4 w-4" />
          Add Leave
        </Button>
      </div>

      {faculty.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to add faculty members first before recording leave.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Records</p><p className="text-2xl font-bold text-slate-900 mt-1">{leaves.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">On Leave Now</p><p className="text-2xl font-bold text-slate-900 mt-1">{leaves.filter((l) => l.is_active && l.start_date <= todayStr && l.end_date >= todayStr).length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Upcoming</p><p className="text-2xl font-bold text-slate-900 mt-1">{leaves.filter((l) => l.start_date > todayStr).length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Past</p><p className="text-2xl font-bold text-slate-900 mt-1">{leaves.filter((l) => l.end_date < todayStr).length}</p></Card>
      </div>

      <div className="flex-1">
        <Input placeholder="Search by faculty name..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading leave records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CalendarX className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No leave records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Faculty</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Leave Period</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Reason</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => {
                  const onLeaveNow = l.is_active && l.start_date <= todayStr && l.end_date >= todayStr;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">{l.faculty?.full_name?.charAt(0).toUpperCase() || '?'}</div>
                          <div>
                            <p className="font-medium text-slate-900">{l.faculty?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{l.faculty?.department || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(l.start_date)} — {formatDate(l.end_date)}</td>
                      <td className="px-4 py-3 text-slate-600">{l.reason || '—'}</td>
                      <td className="px-4 py-3">
                        {onLeaveNow ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 w-fit"><Plane className="h-3 w-3" />On Leave</Badge> : l.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(l)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(l)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Leave Record' : 'Add Leave Record'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Record'}</Button></>}
      >
        <div className="space-y-4">
          <Select label="Faculty Member" value={formData.faculty_id} onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}>
            <option value="">Select faculty...</option>
            {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name} — {f.department || 'No Dept'}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
          <Input label="Reason (optional)" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Medical leave, conference, etc." />
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
