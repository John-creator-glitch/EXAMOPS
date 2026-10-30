import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { BridgingStudent, Program } from '@/types/database';
import { Plus, Search, Edit2, Trash2, Users2 } from 'lucide-react';

export default function BridgingStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<BridgingStudent[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BridgingStudent | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    student_name: '',
    roll_number: '',
    primary_program_id: '',
    primary_semester: 1,
    bridging_program_id: '',
    bridging_semester: 1,
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [studentsRes, programsRes] = await Promise.all([
      supabase.from('bridging_students').select('*, primary_program:programs!primary_program_id(*), bridging_program:programs!bridging_program_id(*)').order('created_at', { ascending: false }),
      supabase.from('programs').select('*').eq('is_active', true).order('name'),
    ]);
    if (studentsRes.error) setError(studentsRes.error.message);
    else setStudents((studentsRes.data as BridgingStudent[]) || []);
    if (programsRes.error) setError(programsRes.error.message);
    else setPrograms((programsRes.data as Program[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = students.filter((s) =>
    s.student_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({ student_name: '', roll_number: '', primary_program_id: programs[0]?.id || '', primary_semester: 1, bridging_program_id: programs[1]?.id || programs[0]?.id || '', bridging_semester: 1, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (s: BridgingStudent) => {
    setEditing(s);
    setFormData({ student_name: s.student_name, roll_number: s.roll_number, primary_program_id: s.primary_program_id, primary_semester: s.primary_semester, bridging_program_id: s.bridging_program_id, bridging_semester: s.bridging_semester, is_active: s.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.student_name || !formData.roll_number || !formData.primary_program_id || !formData.bridging_program_id || !tenantId) {
      setError('Student name, roll number, and both programs are required');
      setSaving(false);
      return;
    }
    if (formData.primary_program_id === formData.bridging_program_id && formData.primary_semester === formData.bridging_semester) {
      setError('Bridging program must differ from primary (different program or different semester)');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      student_name: formData.student_name,
      roll_number: formData.roll_number,
      primary_program_id: formData.primary_program_id,
      primary_semester: formData.primary_semester,
      bridging_program_id: formData.bridging_program_id,
      bridging_semester: formData.bridging_semester,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('bridging_students').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('bridging_students').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (s: BridgingStudent) => {
    if (!confirm(`Delete bridging student "${s.student_name}"?`)) return;
    const { error } = await supabase.from('bridging_students').delete().eq('id', s.id);
    if (error) setError(error.message);
    loadData();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bridging Students</h1>
          <p className="text-sm text-slate-500 mt-1">Students sitting exams across multiple programs — the scheduler checks for cross-cohort clashes</p>
        </div>
        <Button onClick={openCreate} disabled={programs.length < 2}>
          <Plus className="h-4 w-4" />
          Add Student
        </Button>
      </div>

      {programs.length < 2 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need at least 2 programs to set up bridging students.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Students</p><p className="text-2xl font-bold text-slate-900 mt-1">{students.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-slate-900 mt-1">{students.filter((s) => s.is_active).length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Programs Involved</p><p className="text-2xl font-bold text-slate-900 mt-1">{new Set(students.flatMap((s) => [s.primary_program_id, s.bridging_program_id])).size}</p></Card>
      </div>

      <div className="flex-1">
        <Input placeholder="Search by name or roll number..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading bridging students...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Users2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No bridging students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Student</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Roll No.</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Primary Program</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Bridging Program</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-xs font-semibold text-cyan-700">{s.student_name.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-slate-900">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{s.roll_number}</code></td>
                    <td className="px-4 py-3 text-slate-600">{s.primary_program?.code || '—'} <span className="text-xs text-slate-400">(Sem {s.primary_semester})</span></td>
                    <td className="px-4 py-3 text-slate-600">{s.bridging_program?.code || '—'} <span className="text-xs text-slate-400">(Sem {s.bridging_semester})</span></td>
                    <td className="px-4 py-3">{s.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'Edit Bridging Student' : 'Add Bridging Student'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Student'}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Student Name" value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })} placeholder="John Doe" />
            <Input label="Roll Number" value={formData.roll_number} onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })} placeholder="2025-CS-001" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Primary Program" value={formData.primary_program_id} onChange={(e) => setFormData({ ...formData, primary_program_id: e.target.value })}>
              <option value="">Select program...</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </Select>
            <Input label="Primary Semester" type="number" min={1} max={16} value={formData.primary_semester} onChange={(e) => setFormData({ ...formData, primary_semester: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Bridging Program" value={formData.bridging_program_id} onChange={(e) => setFormData({ ...formData, bridging_program_id: e.target.value })}>
              <option value="">Select program...</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </Select>
            <Input label="Bridging Semester" type="number" min={1} max={16} value={formData.bridging_semester} onChange={(e) => setFormData({ ...formData, bridging_semester: parseInt(e.target.value) || 1 })} />
          </div>
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
