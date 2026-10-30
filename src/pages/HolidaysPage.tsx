import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Holiday } from '@/types/database';
import { Plus, Search, Calendar, Edit2, Trash2, CalendarOff } from 'lucide-react';

export default function HolidaysPage() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({ name: '', holiday_date: '', is_active: true });

  const tenantId = user?.profile?.tenant_id;

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('holidays').select('*').order('holiday_date', { ascending: true });
    if (error) setError(error.message);
    else setHolidays((data as Holiday[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const filtered = holidays.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', holiday_date: new Date().toISOString().split('T')[0], is_active: true });
    setModalOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setFormData({ name: h.name, holiday_date: h.holiday_date, is_active: h.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.holiday_date || !tenantId) {
      setError('Name and date are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      name: formData.name,
      holiday_date: formData.holiday_date,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('holidays').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('holidays').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadHolidays();
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Delete holiday "${h.name}"?`)) return;
    const { error } = await supabase.from('holidays').delete().eq('id', h.id);
    if (error) setError(error.message);
    loadHolidays();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holidays</h1>
          <p className="text-sm text-slate-500 mt-1">Dates the scheduler will skip when generating datesheets</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Holiday
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Holidays</p><p className="text-2xl font-bold text-slate-900 mt-1">{holidays.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Active</p><p className="text-2xl font-bold text-slate-900 mt-1">{holidays.filter((h) => h.is_active).length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Upcoming</p><p className="text-2xl font-bold text-slate-900 mt-1">{holidays.filter((h) => new Date(h.holiday_date) >= new Date()).length}</p></Card>
      </div>

      <div className="flex-1">
        <Input placeholder="Search holidays..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading holidays...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CalendarOff className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No holidays found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Holiday Name</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Date</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><CalendarOff className="h-4 w-4 text-rose-600" /></div>
                        <span className="font-medium text-slate-900">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(h.holiday_date)}</td>
                    <td className="px-4 py-3">{h.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(h)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(h)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'Edit Holiday' : 'Add Holiday'}
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Holiday'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Holiday Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Independence Day" />
          <Input label="Date" type="date" value={formData.holiday_date} onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })} />
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
