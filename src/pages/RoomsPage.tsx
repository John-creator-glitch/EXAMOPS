import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Room, RoomType, ChairType, RoomStatus } from '@/types/database';
import { ROOM_TYPE_LABELS, ROOM_TYPE_COLORS, CHAIR_TYPE_LABELS, ROOM_STATUS_LABELS, ROOM_STATUS_COLORS } from '@/types/database';
import { Plus, Search, DoorOpen, Edit2, Trash2, Building, Armchair } from 'lucide-react';

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    building: '',
    floor: '',
    capacity: 50,
    room_type: 'CLASSROOM' as RoomType,
    chair_type: 'FIXED' as ChairType,
    exam_capacity: '' as string | number,
    status: 'ACTIVE' as RoomStatus,
    is_active: true,
  });

  const tenantId = user?.profile?.tenant_id;

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRooms((data as Room[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const filtered = rooms.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()) || (r.building || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.room_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalCapacity = filtered.reduce((sum, r) => sum + r.capacity, 0);

  const openCreate = () => {
    setEditing(null);
    setFormData({ code: '', name: '', building: '', floor: '', capacity: 50, room_type: 'CLASSROOM', chair_type: 'FIXED', exam_capacity: '', status: 'ACTIVE', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setFormData({ code: r.code, name: r.name, building: r.building || '', floor: r.floor || '', capacity: r.capacity, room_type: r.room_type, chair_type: r.chair_type || 'FIXED', exam_capacity: r.exam_capacity || '', status: r.status || 'ACTIVE', is_active: r.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !tenantId) {
      setError('Code and name are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      code: formData.code.toUpperCase(),
      name: formData.name,
      building: formData.building || null,
      floor: formData.floor || null,
      capacity: formData.capacity,
      room_type: formData.room_type,
      chair_type: formData.chair_type,
      exam_capacity: formData.exam_capacity === '' ? null : Number(formData.exam_capacity),
      status: formData.status,
      is_active: formData.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('rooms').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadRooms();
  };

  const handleDelete = async (r: Room) => {
    if (!confirm(`Delete room "${r.name}"?`)) return;
    const { error } = await supabase.from('rooms').delete().eq('id', r.id);
    if (error) setError(error.message);
    loadRooms();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <p className="text-sm text-slate-500 mt-1">Manage examination halls and classrooms</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Room
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Rooms</p><p className="text-2xl font-bold text-slate-900 mt-1">{filtered.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Capacity</p><p className="text-2xl font-bold text-slate-900 mt-1">{totalCapacity}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Halls</p><p className="text-2xl font-bold text-slate-900 mt-1">{filtered.filter(r => r.room_type === 'HALL').length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Classrooms</p><p className="text-2xl font-bold text-slate-900 mt-1">{filtered.filter(r => r.room_type === 'CLASSROOM').length}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search by name, code, or building..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-48">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="CLASSROOM">Classroom</option>
            <option value="HALL">Hall</option>
            <option value="LAB">Lab</option>
            <option value="OPEN_SPACE">Open Space</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading rooms...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <DoorOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p>No rooms found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Code</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Room Name</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Location</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Type</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Chair Type</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Capacity</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Exam Cap.</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Room Status</th>
                  <th className="text-left font-semibold text-slate-700 px-4 py-3">Active</th>
                  <th className="text-right font-semibold text-slate-700 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><code className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">{r.code}</code></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Building className="h-4 w-4 text-emerald-600" /></div>
                        <span className="font-medium text-slate-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{[r.building, r.floor ? `Floor ${r.floor}` : null].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3"><Badge className={ROOM_TYPE_COLORS[r.room_type]}>{ROOM_TYPE_LABELS[r.room_type]}</Badge></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-slate-600 text-xs"><Armchair className="h-3 w-3 text-slate-400" />{CHAIR_TYPE_LABELS[r.chair_type]}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold text-slate-900">{r.capacity}</span> <span className="text-slate-400 text-xs">seats</span></td>
                    <td className="px-4 py-3"><span className="font-semibold text-slate-900">{r.exam_capacity ?? '—'}</span></td>
                    <td className="px-4 py-3"><Badge className={ROOM_STATUS_COLORS[r.status]}>{ROOM_STATUS_LABELS[r.status]}</Badge></td>
                    <td className="px-4 py-3">{r.is_active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
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
        title={editing ? 'Edit Room' : 'Add Room'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Room'}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Room Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="R-101" />
            <Select label="Room Type" value={formData.room_type} onChange={(e) => setFormData({ ...formData, room_type: e.target.value as RoomType })}>
              <option value="CLASSROOM">Classroom</option>
              <option value="HALL">Hall</option>
              <option value="LAB">Lab</option>
              <option value="OPEN_SPACE">Open Space</option>
            </Select>
          </div>
          <Input label="Room Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Examination Hall A" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Building" value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} placeholder="Main Block" />
            <Input label="Floor" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} placeholder="1st" />
            <Input label="Physical Capacity" type="number" min={1} value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Chair Type" value={formData.chair_type} onChange={(e) => setFormData({ ...formData, chair_type: e.target.value as ChairType })}>
              <option value="FIXED">Fixed Chairs (50% usable)</option>
              <option value="MOVABLE">Movable Chairs (100% usable)</option>
            </Select>
            <Input label="Exam Capacity (optional)" type="number" min={0} value={formData.exam_capacity} onChange={(e) => setFormData({ ...formData, exam_capacity: e.target.value })} placeholder="Auto-calculate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Room Status</label>
            <div className="flex gap-3">
              <button onClick={() => setFormData({ ...formData, status: 'ACTIVE' })} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formData.status === 'ACTIVE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Active</button>
              <button onClick={() => setFormData({ ...formData, status: 'MAINTENANCE' })} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formData.status === 'MAINTENANCE' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Maintenance</button>
              <button onClick={() => setFormData({ ...formData, status: 'OFFLINE' })} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${formData.status === 'OFFLINE' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Offline</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Active in System</label>
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
