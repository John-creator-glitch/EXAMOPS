import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Datesheet, ExamCycle } from '@/types/database';
import { CYCLE_TYPE_LABELS, CYCLE_TYPE_COLORS, DATESHEET_STATUS_LABELS, DATESHEET_STATUS_COLORS } from '@/types/database';
import { Plus, Search, FileText, Edit2, Trash2, ChevronRight, AlertCircle, Calendar, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DatesheetsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [cycles, setCycles] = useState<ExamCycle[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Datesheet | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cycle_id: '',
  });

  const tenantId = user?.profile?.tenant_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dsRes, cyclesRes] = await Promise.all([
      supabase.from('datesheets').select('*, cycle:exam_cycles(*)').order('created_at', { ascending: false }),
      supabase.from('exam_cycles').select('*').order('created_at', { ascending: false }),
    ]);
    if (dsRes.error) setError(dsRes.error.message);
    else {
      const dsData = (dsRes.data as Datesheet[]) || [];
      setDatesheets(dsData);
      if (dsData.length > 0) {
        const { data: items } = await supabase.from('datesheet_items').select('datesheet_id');
        const counts: Record<string, number> = {};
        (items || []).forEach((i: { datesheet_id: string }) => {
          counts[i.datesheet_id] = (counts[i.datesheet_id] || 0) + 1;
        });
        setItemCounts(counts);
      }
    }
    if (cyclesRes.error) setError(cyclesRes.error.message);
    else setCycles((cyclesRes.data as ExamCycle[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = datesheets.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', cycle_id: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Datesheet) => {
    setEditing(d);
    setFormData({ name: d.name, cycle_id: d.cycle_id });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cycle_id || !tenantId) {
      setError('Name and exam cycle are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      cycle_id: formData.cycle_id,
      name: formData.name,
    };

    if (editing) {
      const { error } = await supabase.from('datesheets').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('datesheets').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (d: Datesheet) => {
    if (!confirm(`Delete datesheet "${d.name}"? This will remove all exam entries in it.`)) return;
    const { error } = await supabase.from('datesheets').delete().eq('id', d.id);
    if (error) setError(error.message);
    loadData();
  };

  const handlePublish = async (d: Datesheet) => {
    if (!confirm(`Publish "${d.name}"? Once published, it will be visible to students and staff.`)) return;
    const { error } = await supabase.from('datesheets').update({ status: 'PUBLISHED', published_at: new Date().toISOString() }).eq('id', d.id);
    if (error) setError(error.message);
    loadData();
  };

  const handleUnpublish = async (d: Datesheet) => {
    const { error } = await supabase.from('datesheets').update({ status: 'DRAFT', published_at: null }).eq('id', d.id);
    if (error) setError(error.message);
    loadData();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Datesheets</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage exam schedules</p>
        </div>
        <Button onClick={openCreate} disabled={cycles.length === 0}>
          <Plus className="h-4 w-4" />
          Add Datesheet
        </Button>
      </div>

      {cycles.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create an exam cycle first before creating a datesheet.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Datesheets</p><p className="text-2xl font-bold text-slate-900 mt-1">{datesheets.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Published</p><p className="text-2xl font-bold text-slate-900 mt-1">{datesheets.filter(d => d.status === 'PUBLISHED').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Drafts</p><p className="text-2xl font-bold text-slate-900 mt-1">{datesheets.filter(d => d.status === 'DRAFT').length}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search datesheets..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-40">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3">Loading datesheets...</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No datesheets found. Create your first datesheet to get started.</p>
          </Card>
        ) : (
          filtered.map((d) => (
            <Card key={d.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 leading-tight">{d.name}</h3>
                    {d.cycle && <Badge className={`mt-1 ${CYCLE_TYPE_COLORS[d.cycle.cycle_type]}`}>{CYCLE_TYPE_LABELS[d.cycle.cycle_type]}</Badge>}
                  </div>
                </div>
                <Badge className={DATESHEET_STATUS_COLORS[d.status]}>{DATESHEET_STATUS_LABELS[d.status]}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {d.cycle?.name || 'No cycle'}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Layers className="h-4 w-4 text-slate-400" />
                  {itemCounts[d.id] || 0} exam entries
                </div>
                {d.published_at && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    Published {formatDate(d.published_at)}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                <button onClick={() => navigate(`/dashboard/datesheets/${d.id}`)} className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium flex items-center gap-1">
                  Manage Exams <ChevronRight className="h-3 w-3" />
                </button>
                {d.status === 'DRAFT' && (
                  <button onClick={() => handlePublish(d)} className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">Publish</button>
                )}
                {d.status === 'PUBLISHED' && (
                  <button onClick={() => handleUnpublish(d)} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Unpublish</button>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1">
                <button onClick={() => openEdit(d)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(d)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Datesheet' : 'Add Datesheet'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Datesheet'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Datesheet Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Fall 2025 Final Exam Schedule" />
          <Select label="Exam Cycle" value={formData.cycle_id} onChange={(e) => setFormData({ ...formData, cycle_id: e.target.value })}>
            <option value="">Select a cycle...</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({CYCLE_TYPE_LABELS[c.cycle_type]})</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
