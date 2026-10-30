import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { TimeSlot, ExamCycle } from '@/types/database';
import { CYCLE_TYPE_LABELS, CYCLE_TYPE_COLORS, CYCLE_STATUS_COLORS, CYCLE_STATUS_LABELS } from '@/types/database';
import { Plus, Clock, Edit2, Trash2, ArrowLeft, Sun, Moon, Coffee, AlertCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export default function TimeSlotsPage() {
  const { user } = useAuth();
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<ExamCycle | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '11:00',
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadData = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    const [cycleRes, slotsRes] = await Promise.all([
      supabase.from('exam_cycles').select('*').eq('id', cycleId).maybeSingle(),
      supabase.from('time_slots').select('*').eq('cycle_id', cycleId).order('start_time', { ascending: true }),
    ]);
    if (cycleRes.error) setError(cycleRes.error.message);
    else setCycle(cycleRes.data as ExamCycle | null);
    if (slotsRes.error) setError(slotsRes.error.message);
    else setSlots((slotsRes.data as TimeSlot[]) || []);
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', start_time: '09:00', end_time: '11:00', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (s: TimeSlot) => {
    setEditing(s);
    setFormData({ name: s.name, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), is_active: s.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.start_time || !formData.end_time || !cycleId || !tenantId) {
      setError('All fields are required');
      setSaving(false);
      return;
    }
    if (formData.end_time <= formData.start_time) {
      setError('End time must be after start time');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      cycle_id: cycleId,
      name: formData.name,
      start_time: formData.start_time,
      end_time: formData.end_time,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('time_slots').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('time_slots').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (s: TimeSlot) => {
    if (!confirm(`Delete time slot "${s.name}"?`)) return;
    const { error } = await supabase.from('time_slots').delete().eq('id', s.id);
    if (error) setError(error.message);
    loadData();
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const getSlotIcon = (s: TimeSlot) => {
    const hour = parseInt(s.start_time.split(':')[0]);
    if (hour < 12) return <Sun className="h-5 w-5 text-amber-500" />;
    if (hour < 15) return <Coffee className="h-5 w-5 text-orange-500" />;
    return <Moon className="h-5 w-5 text-indigo-500" />;
  };

  const duration = (s: TimeSlot) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with back link */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/dashboard/cycles')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Exam Cycles
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{cycle?.name || 'Time Slots'}</h1>
          {cycle && (
            <div className="flex items-center gap-2 mt-2">
              <Badge className={CYCLE_TYPE_COLORS[cycle.cycle_type]}>{CYCLE_TYPE_LABELS[cycle.cycle_type]}</Badge>
              <Badge className={CYCLE_STATUS_COLORS[cycle.status]}>{CYCLE_STATUS_LABELS[cycle.status]}</Badge>
            </div>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Time Slot
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {loading ? (
        <Card className="p-8 text-center text-slate-500">Loading time slots...</Card>
      ) : slots.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>No time slots defined yet. Add slots like "Morning (9:00 - 11:00)" or "Afternoon (1:00 - 3:00)".</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {slots.map((s, idx) => (
            <Card key={s.id} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {getSlotIcon(s)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{s.name}</h3>
                      <span className="text-xs text-slate-400">#{idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 mt-0.5">
                      <span className="font-medium">{formatTime(s.start_time)} — {formatTime(s.end_time)}</span>
                      <span className="text-slate-400">·</span>
                      <span>{duration(s)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>
                  )}
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(s)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Time Slot' : 'Add Time Slot'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Time Slot'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Slot Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Morning" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
            <Input label="End Time" type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
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
