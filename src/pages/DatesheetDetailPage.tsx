import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { DatesheetItem, Datesheet, Course, TimeSlot, Room, ExamCycle } from '@/types/database';
import { DATESHEET_STATUS_LABELS, DATESHEET_STATUS_COLORS, CYCLE_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/types/database';
import { Plus, ArrowLeft, Edit2, Trash2, AlertCircle, FileText, Calendar, Clock, DoorOpen, BookOpen, MapPin } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export default function DatesheetDetailPage() {
  const { user } = useAuth();
  const { datesheetId } = useParams<{ datesheetId: string }>();
  const navigate = useNavigate();

  const [datesheet, setDatesheet] = useState<Datesheet | null>(null);
  const [cycle, setCycle] = useState<ExamCycle | null>(null);
  const [items, setItems] = useState<DatesheetItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DatesheetItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    course_id: '',
    exam_date: '',
    time_slot_id: '',
    room_id: '',
    notes: '',
  });

  const tenantId = user?.profile?.tenant_id;
  const isPublished = datesheet?.status === 'PUBLISHED';

  const loadData = useCallback(async () => {
    if (!datesheetId) return;
    setLoading(true);

    const [dsRes, itemsRes, coursesRes, roomsRes] = await Promise.all([
      supabase.from('datesheets').select('*, cycle:exam_cycles(*)').eq('id', datesheetId).maybeSingle(),
      supabase.from('datesheet_items').select('*, course:courses(*), time_slot:time_slots(*), room:rooms(*)').eq('datesheet_id', datesheetId).order('exam_date', { ascending: true }),
      supabase.from('courses').select('*, program:programs(*)').eq('is_active', true).order('code'),
      supabase.from('rooms').select('*').eq('is_active', true).order('code'),
    ]);

    if (dsRes.error) setError(dsRes.error.message);
    else {
      const dsData = dsRes.data as Datesheet | null;
      setDatesheet(dsData);
      setCycle(dsData?.cycle || null);
      if (dsData?.cycle_id) {
        const { data: slots } = await supabase.from('time_slots').select('*').eq('cycle_id', dsData.cycle_id).eq('is_active', true).order('start_time');
        setTimeSlots((slots as TimeSlot[]) || []);
      }
    }

    if (itemsRes.error) setError(itemsRes.error.message);
    else setItems((itemsRes.data as DatesheetItem[]) || []);

    if (coursesRes.error) setError(coursesRes.error.message);
    else setCourses((coursesRes.data as Course[]) || []);

    if (roomsRes.error) setError(roomsRes.error.message);
    else setRooms((roomsRes.data as Room[]) || []);

    setLoading(false);
  }, [datesheetId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    const defaultDate = cycle?.start_date || new Date().toISOString().split('T')[0];
    setFormData({ course_id: '', exam_date: defaultDate, time_slot_id: '', room_id: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (item: DatesheetItem) => {
    setEditing(item);
    setFormData({
      course_id: item.course_id,
      exam_date: item.exam_date,
      time_slot_id: item.time_slot_id || '',
      room_id: item.room_id || '',
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.course_id || !formData.exam_date || !datesheetId || !tenantId) {
      setError('Course and exam date are required');
      setSaving(false);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      tenant_id: tenantId,
      datesheet_id: datesheetId,
      course_id: formData.course_id,
      exam_date: formData.exam_date,
      time_slot_id: formData.time_slot_id || null,
      room_id: formData.room_id || null,
      notes: formData.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from('datesheet_items').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
      else setModalOpen(false);
    } else {
      const { error } = await supabase.from('datesheet_items').insert(payload);
      if (error) setError(error.message);
      else setModalOpen(false);
    }
    setSaving(false);
    loadData();
  };

  const handleDelete = async (item: DatesheetItem) => {
    if (!confirm('Remove this exam from the datesheet?')) return;
    const { error } = await supabase.from('datesheet_items').delete().eq('id', item.id);
    if (error) setError(error.message);
    loadData();
  };

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  // Group items by date
  const groupedByDate = items.reduce((acc, item) => {
    if (!acc[item.exam_date]) acc[item.exam_date] = [];
    acc[item.exam_date].push(item);
    return acc;
  }, {} as Record<string, DatesheetItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort();
  const assignedCount = items.filter(i => i.room_id).length;
  const unassignedCount = items.length - assignedCount;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/dashboard/datesheet')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Datesheets
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{datesheet?.name || 'Datesheet'}</h1>
          {datesheet && (
            <div className="flex items-center gap-2 mt-2">
              <Badge className={DATESHEET_STATUS_COLORS[datesheet.status]}>{DATESHEET_STATUS_LABELS[datesheet.status]}</Badge>
              {cycle && <Badge className="bg-blue-50 text-blue-700 border-blue-200">{cycle.name} · {CYCLE_TYPE_LABELS[cycle.cycle_type]}</Badge>}
            </div>
          )}
        </div>
        {!isPublished && (
          <Button onClick={openCreate} disabled={courses.length === 0}>
            <Plus className="h-4 w-4" />
            Add Exam
          </Button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {isPublished && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This datesheet is published. Unpublish it to make changes.
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Total Exams</p><p className="text-2xl font-bold text-slate-900 mt-1">{items.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Exam Days</p><p className="text-2xl font-bold text-slate-900 mt-1">{sortedDates.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Rooms Assigned</p><p className="text-2xl font-bold text-emerald-600 mt-1">{assignedCount}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500 uppercase tracking-wider">Unassigned</p><p className="text-2xl font-bold text-amber-600 mt-1">{unassignedCount}</p></Card>
      </div>

      {courses.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          No courses found. Create courses first before adding exams to the datesheet.
        </div>
      )}

      {/* Exam schedule grouped by date */}
      {loading ? (
        <Card className="p-8 text-center text-slate-500">Loading datesheet...</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>No exams scheduled yet. Click "Add Exam" to start building your datesheet.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{formatDate(date)}</h2>
                <span className="text-sm text-slate-400">({groupedByDate[date].length} exams)</span>
              </div>

              <Card className="overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {groupedByDate[date].map((item) => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Course info */}
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{item.course?.code}</code>
                              <span className="font-medium text-slate-900 truncate">{item.course?.title}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                              {item.time_slot && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                                  {item.time_slot.name} ({formatTime(item.time_slot.start_time)} – {formatTime(item.time_slot.end_time)})
                                </span>
                              )}
                              {item.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                  {item.room.code} — {item.room.name} ({item.room.capacity} seats)
                                </span>
                              )}
                              {!item.room && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <DoorOpen className="h-3.5 w-3.5" />
                                  Room not assigned
                                </span>
                              )}
                              {item.course?.program && (
                                <span className="text-xs text-slate-400">{item.course.program.code}</span>
                              )}
                            </div>
                            {item.notes && <p className="text-xs text-slate-500 mt-1.5 italic">{item.notes}</p>}
                          </div>
                        </div>

                        {!isPublished && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(item)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Exam Entry' : 'Add Exam Entry'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Exam'}</Button></>}
      >
        <div className="space-y-4">
          <Select label="Course" value={formData.course_id} onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}>
            <option value="">Select a course...</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title} ({c.program?.code || 'No program'})</option>)}
          </Select>
          <Input label="Exam Date" type="date" value={formData.exam_date} onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Time Slot" value={formData.time_slot_id} onChange={(e) => setFormData({ ...formData, time_slot_id: e.target.value })}>
              <option value="">No time slot</option>
              {timeSlots.map((s) => <option key={s.id} value={s.id}>{s.name} ({formatTime(s.start_time)} – {formatTime(s.end_time)})</option>)}
            </Select>
            <Select label="Room" value={formData.room_id} onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}>
              <option value="">No room assigned</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name} ({r.capacity} seats, {ROOM_TYPE_LABELS[r.room_type]})</option>)}
            </Select>
          </div>
          <Input label="Notes (optional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. Open book, calculators allowed" />
          {timeSlots.length === 0 && (
            <p className="text-xs text-amber-600">No time slots defined for this cycle. You can add them from the Exam Cycles page.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
