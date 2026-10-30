import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Program, ProgramLevel } from '@/types/database';
import { PROGRAM_LEVEL_LABELS, PROGRAM_LEVEL_COLORS, PROGRAM_LEVEL_TRACK } from '@/types/database';
import { Plus, Search, BookOpen, Edit2, Trash2, GraduationCap, Building } from 'lucide-react';

export default function ProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    department: '',
    program_level: 'BACHELOR' as ProgramLevel,
    duration_years: 4,
    total_semesters: 8,
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('programs').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setPrograms((data as Program[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const filtered = programs.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({ code: '', name: '', department: '', program_level: 'BACHELOR', duration_years: 4, total_semesters: 8, is_active: true });
    setModalOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditing(p);
    setFormData({
      code: p.code,
      name: p.name,
      department: p.department || '',
      program_level: p.program_level || 'BACHELOR',
      duration_years: p.duration_years,
      total_semesters: p.total_semesters,
      is_active: p.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !tenantId) {
      setError('Code and name are required');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      code: formData.code.toUpperCase(),
      name: formData.name,
      department: formData.department || null,
      program_level: formData.program_level,
      duration_years: formData.duration_years,
      total_semesters: formData.total_semesters,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('programs').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('programs').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadPrograms();
  };

  const handleDelete = async (p: Program) => {
    if (!confirm(`Delete program "${p.name}"? This will also delete all courses in this program.`)) return;
    const { error } = await supabase.from('programs').delete().eq('id', p.id);
    if (error) setError(error.message);
    loadPrograms();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
          <p className="text-sm text-slate-500 mt-1">Manage degree programs offered by your university</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Program
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading programs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No programs found. Create your first program to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Code</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Program Name</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Department</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Level</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Duration</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Semesters</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{p.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.department || '—'}</td>
                    <td className="px-4 py-3"><Badge className={PROGRAM_LEVEL_COLORS[p.program_level]}>{PROGRAM_LEVEL_LABELS[p.program_level]}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{p.duration_years} years</td>
                    <td className="px-4 py-3 text-slate-600">{p.total_semesters}</td>
                    <td className="px-4 py-3">
                      {p.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors">
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Program' : 'Add Program'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Program'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Program Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="BSCS" />
          <Input label="Program Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="BS Computer Science" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="Computer Science" icon={<Building className="h-4 w-4" />} />
            <Select label="Program Level" value={formData.program_level} onChange={(e) => setFormData({ ...formData, program_level: e.target.value as ProgramLevel })}>
              <option value="ASSOCIATE_DEGREE">Associate Degree</option>
              <option value="BACHELOR">Bachelor</option>
              <option value="PROFESSIONAL_DOCTORATE">Professional Doctorate</option>
              <option value="MS">MS</option>
              <option value="MPHIL">MPhil</option>
              <option value="PHD">PhD</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Duration (Years)" type="number" min={1} max={8} value={formData.duration_years} onChange={(e) => setFormData({ ...formData, duration_years: parseInt(e.target.value) || 1 })} />
            <Input label="Total Semesters" type="number" min={1} max={16} value={formData.total_semesters} onChange={(e) => setFormData({ ...formData, total_semesters: parseInt(e.target.value) || 1 })} />
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
