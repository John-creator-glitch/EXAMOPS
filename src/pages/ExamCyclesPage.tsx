import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ExamCycle, CycleType, CycleStatus } from '@/types/database';
import { CYCLE_TYPE_LABELS, CYCLE_TYPE_COLORS, CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS } from '@/types/database';
import { Plus, Search, Calendar, Edit2, Trash2, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ExamCyclesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<ExamCycle[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamCycle | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cycle_type: 'MIDTERM' as CycleType,
    start_date: '',
    end_date: '',
    status: 'DRAFT' as CycleStatus,
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadCycles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('exam_cycles').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      const cyclesData = (data as ExamCycle[]) || [];
      setCycles(cyclesData);
      // Load time slot counts per cycle
      if (cyclesData.length > 0) {
        const { data: slots } = await supabase.from('time_slots').select('cycle_id');
        const counts: Record<string, number> = {};
        (slots || []).forEach((s: { cycle_id: string }) => {
          counts[s.cycle_id] = (counts[s.cycle_id] || 0) + 1;
        });
        setSlotCounts(counts);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  const filtered = cycles.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreate = () => {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ name: '', cycle_type: 'MIDTERM', start_date: today, end_date: today, status: 'DRAFT', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (c: ExamCycle) => {
    setEditing(c);
    setFormData({ name: c.name, cycle_type: c.cycle_type, start_date: c.start_date, end_date: c.end_date, status: c.status, is_active: c.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date || !tenantId) {
      setError('Name, start date, and end date are required');
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
      name: formData.name,
      cycle_type: formData.cycle_type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      status: formData.status,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('exam_cycles').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('exam_cycles').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadCycles();
  };

  const handleDelete = async (c: ExamCycle) => {
    if (!confirm(`Delete exam cycle "${c.name}"? This will also delete all time slots in this cycle.`)) return;
    const { error } = await supabase.from('exam_cycles').delete().eq('id', c.id);
    if (error) setError(error.message);
    loadCycles();
  };

  const handleStatusChange = async (c: ExamCycle, newStatus: CycleStatus) => {
    const { error } = await supabase.from('exam_cycles').update({ status: newStatus }).eq('id', c.id);
    if (error) setError(error.message);
    loadCycles();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRange = (c: ExamCycle) => `${formatDate(c.start_date)} — ${formatDate(c.end_date)}`;
  const daysBetween = (c: ExamCycle) => {
    const diff = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000) + 1;
    return diff;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Cycles</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage examination periods</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Cycle
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Cycles</p><p className="text-2xl font-bold text-slate-900 mt-1">{cycles.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Draft</p><p className="text-2xl font-bold text-slate-900 mt-1">{cycles.filter(c => c.status === 'DRAFT').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Published</p><p className="text-2xl font-bold text-slate-900 mt-1">{cycles.filter(c => c.status === 'PUBLISHED').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Completed</p><p className="text-2xl font-bold text-slate-900 mt-1">{cycles.filter(c => c.status === 'COMPLETED').length}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search cycles..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-44">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3">Loading exam cycles...</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No exam cycles found. Create your first cycle to get started.</p>
          </Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 leading-tight">{c.name}</h3>
                    <Badge className={`mt-1 ${CYCLE_TYPE_COLORS[c.cycle_type]}`}>{CYCLE_TYPE_LABELS[c.cycle_type]}</Badge>
                  </div>
                </div>
                <Badge className={CYCLE_STATUS_COLORS[c.status]}>{CYCLE_STATUS_LABELS[c.status]}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {dateRange(c)}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {daysBetween(c)} days · {slotCounts[c.id] || 0} time slots
                </div>
              </div>

              {/* Status workflow */}
              <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                {c.status === 'DRAFT' && (
                  <button onClick={() => handleStatusChange(c, 'PUBLISHED')} className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">Publish</button>
                )}
                {c.status === 'PUBLISHED' && (
                  <button onClick={() => handleStatusChange(c, 'COMPLETED')} className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">Mark Completed</button>
                )}
                {c.status === 'COMPLETED' && (
                  <button onClick={() => handleStatusChange(c, 'ARCHIVED')} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Archive</button>
                )}
                <button onClick={() => navigate(`/dashboard/cycles/${c.id}/slots`)} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-medium flex items-center gap-1">
                  Time Slots <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Exam Cycle' : 'Add Exam Cycle'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Cycle'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Cycle Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Fall 2025 Midterm" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Cycle Type" value={formData.cycle_type} onChange={(e) => setFormData({ ...formData, cycle_type: e.target.value as CycleType })}>
              <option value="MIDTERM">Midterm</option>
              <option value="FINAL">Final</option>
              <option value="SUPPLEMENTARY">Supplementary</option>
              <option value="MAKEUP">Makeup</option>
            </Select>
            <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CycleStatus })}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
