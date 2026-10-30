import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Course, Program, PaperType } from '@/types/database';
import { PAPER_TYPE_LABELS, PAPER_TYPE_COLORS } from '@/types/database';
import { Plus, Search, BookOpen, Edit2, Trash2, Users } from 'lucide-react';

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    program_id: '',
    credit_hours: 3,
    semester: 1,
    strength: 0,
    paper_type: 'REGULAR' as PaperType,
    shared_paper_group: '',
    faculty_name: '',
    faculty_emp_code: '',
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [coursesRes, programsRes] = await Promise.all([
      supabase.from('courses').select('*, program:programs(*)').order('created_at', { ascending: false }),
      supabase.from('programs').select('*').eq('is_active', true).order('name'),
    ]);
    if (coursesRes.error) setError(coursesRes.error.message);
    else setCourses((coursesRes.data as Course[]) || []);
    if (programsRes.error) setError(programsRes.error.message);
    else setPrograms((programsRes.data as Program[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = courses.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = programFilter === 'all' || c.program_id === programFilter;
    return matchesSearch && matchesProgram;
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ code: '', title: '', program_id: programs[0]?.id || '', credit_hours: 3, semester: 1, strength: 0, paper_type: 'REGULAR', shared_paper_group: '', faculty_name: '', faculty_emp_code: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setFormData({ code: c.code, title: c.title, program_id: c.program_id, credit_hours: c.credit_hours, semester: c.semester, strength: c.strength, paper_type: c.paper_type, shared_paper_group: c.shared_paper_group || '', faculty_name: c.faculty_name || '', faculty_emp_code: c.faculty_emp_code || '', is_active: c.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.title || !formData.program_id || !tenantId) {
      setError('All fields are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      program_id: formData.program_id,
      code: formData.code.toUpperCase(),
      title: formData.title,
      credit_hours: formData.credit_hours,
      semester: formData.semester,
      strength: formData.strength,
      paper_type: formData.paper_type,
      shared_paper_group: formData.shared_paper_group || null,
      faculty_name: formData.faculty_name || null,
      faculty_emp_code: formData.faculty_emp_code || null,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('courses').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (c: Course) => {
    if (!confirm(`Delete course "${c.title}"?`)) return;
    const { error } = await supabase.from('courses').delete().eq('id', c.id);
    if (error) setError(error.message);
    loadData();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500 mt-1">Manage subjects offered across all programs</p>
        </div>
        <Button onClick={openCreate} disabled={programs.length === 0}>
          <Plus className="h-4 w-4" />
          Add Course
        </Button>
      </div>

      {programs.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create a program first before adding courses.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search by title or code..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-56">
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="all">All Programs</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading courses...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No courses found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Code</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Title</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Program</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Semester</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Strength</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Paper Type</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Credits</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{c.code}</code></td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.title}</td>
                    <td className="px-4 py-3 text-slate-600">{c.program?.code || '—'} {c.program?.name || ''}</td>
                    <td className="px-4 py-3 text-slate-600">Sem {c.semester}</td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-slate-600"><Users className="h-3 w-3 text-slate-400" />{c.strength}</span></td>
                    <td className="px-4 py-3"><Badge className={PAPER_TYPE_COLORS[c.paper_type]}>{PAPER_TYPE_LABELS[c.paper_type]}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{c.credit_hours} cr</td>
                    <td className="px-4 py-3">
                      {c.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'Edit Course' : 'Add Course'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Course'}</Button></>}
      >
        <div className="space-y-4">
          <Select label="Program" value={formData.program_id} onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}>
            <option value="">Select a program...</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Course Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="CS101" />
            <Input label="Credit Hours" type="number" min={1} max={6} value={formData.credit_hours} onChange={(e) => setFormData({ ...formData, credit_hours: parseInt(e.target.value) || 1 })} />
          </div>
          <Input label="Course Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Introduction to Programming" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Semester" type="number" min={1} max={16} value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })} />
            <Input label="Student Strength" type="number" min={0} value={formData.strength} onChange={(e) => setFormData({ ...formData, strength: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Paper Type" value={formData.paper_type} onChange={(e) => setFormData({ ...formData, paper_type: e.target.value as PaperType })}>
              <option value="REGULAR">Regular (full cohort)</option>
              <option value="BACKLOG">Backlog (repeat/retake)</option>
            </Select>
            <Input label="Shared Paper Group (optional)" value={formData.shared_paper_group} onChange={(e) => setFormData({ ...formData, shared_paper_group: e.target.value })} placeholder="e.g. CS-SEM3-GROUP-A" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Faculty Name (optional)" value={formData.faculty_name} onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })} placeholder="Dr. John Smith" />
            <Input label="Faculty Emp Code (optional)" value={formData.faculty_emp_code} onChange={(e) => setFormData({ ...formData, faculty_emp_code: e.target.value })} placeholder="EMP-001" />
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
