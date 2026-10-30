import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Datesheet, DatesheetItem, Room, Course, TimeSlot, Faculty, InvigilationDuty, InvigilationRole } from '@/types/database';
import { DATESHEET_STATUS_LABELS, DATESHEET_STATUS_COLORS, INVIGILATION_ROLE_LABELS, INVIGILATION_ROLE_COLORS, ROOM_TYPE_LABELS } from '@/types/database';
import {
  Users, AlertCircle, UserPlus, UserMinus, Zap, Calendar, Clock, MapPin,
  ChevronDown, ChevronRight, X, ShieldCheck, UserRound, Layers, TrendingUp
} from 'lucide-react';

interface ItemWithRelations extends DatesheetItem {
  course: Course | null;
  time_slot: TimeSlot | null;
  room: Room | null;
  duties: (InvigilationDuty & { faculty: Faculty | null })[];
}

interface FacultyDutyCount {
  facultyId: string;
  count: number;
  dates: Set<string>;
}

export default function InvigilationPage() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Assign modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<ItemWithRelations | null>(null);
  const [modalFacultyId, setModalFacultyId] = useState('');
  const [modalRole, setModalRole] = useState<InvigilationRole>('INVIGILATOR');

  const tenantId = user?.profile?.tenant_id;

  const loadInitial = useCallback(async () => {
    const [dsRes, facRes] = await Promise.all([
      supabase.from('datesheets').select('*').order('created_at', { ascending: false }),
      supabase.from('faculty').select('*').eq('is_active', true).order('full_name'),
    ]);
    setDatesheets((dsRes.data as Datesheet[]) || []);
    setFaculty((facRes.data as Faculty[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadItems = useCallback(async () => {
    if (!selectedDsId) { setItems([]); return; }
    setLoading(true);

    const { data, error: err } = await supabase
      .from('datesheet_items')
      .select('*, course:courses(*), time_slot:time_slots(*), room:rooms(*)')
      .eq('datesheet_id', selectedDsId)
      .order('exam_date', { ascending: true });

    if (err) { setError(err.message); setLoading(false); return; }

    const itemIds = (data || []).map((i: { id: string }) => i.id);
    let dutiesMap: Record<string, (InvigilationDuty & { faculty: Faculty | null })[]> = {};

    if (itemIds.length > 0) {
      const { data: duties } = await supabase
        .from('invigilation_duties')
        .select('*, faculty:faculty(*)')
        .in('datesheet_item_id', itemIds);

      (duties || []).forEach((d: InvigilationDuty & { faculty: Faculty | null }) => {
        if (!dutiesMap[d.datesheet_item_id]) dutiesMap[d.datesheet_item_id] = [];
        dutiesMap[d.datesheet_item_id].push(d);
      });
    }

    const enriched = ((data as DatesheetItem[]) || []).map(item => ({
      ...item,
      duties: dutiesMap[item.id] || [],
    })) as ItemWithRelations[];

    setItems(enriched);
    setLoading(false);
  }, [selectedDsId]);

  useEffect(() => {
    if (selectedDsId) loadItems();
    else { setItems([]); }
  }, [selectedDsId, loadItems]);

  // Check if faculty is assigned to another exam on the same date + same time slot
  const isFacultyBusy = (facultyId: string, examDate: string, timeSlotId: string | null, excludeItemId?: string): boolean => {
    return items.some(i =>
      i.id !== excludeItemId &&
      i.exam_date === examDate &&
      (i.time_slot_id || null) === (timeSlotId || null) &&
      i.duties.some(d => d.faculty_id === facultyId)
    );
  };

  // Count duties per faculty per date
  const getDutiesPerDate = (facultyId: string, date: string, excludeItemId?: string): number => {
    return items.filter(i =>
      i.id !== excludeItemId &&
      i.exam_date === date &&
      i.duties.some(d => d.faculty_id === facultyId)
    ).length;
  };

  // Total duties per faculty across this datesheet
  const getFacultyDutySummary = (): Record<string, number> => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      i.duties.forEach(d => {
        counts[d.faculty_id] = (counts[d.faculty_id] || 0) + 1;
      });
    });
    return counts;
  };

  const dutySummary = getFacultyDutySummary();
  const totalDuties = Object.values(dutySummary).reduce((a, b) => a + b, 0);
  const itemsWithDuties = items.filter(i => i.duties.length > 0).length;
  const itemsWithoutDuties = items.length - itemsWithDuties;

  // Group items by date
  const groupedByDate = items.reduce((acc, item) => {
    if (!acc[item.exam_date]) acc[item.exam_date] = [];
    acc[item.exam_date].push(item);
    return acc;
  }, {} as Record<string, ItemWithRelations[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const openAssignModal = (item: ItemWithRelations) => {
    setModalItem(item);
    setModalFacultyId('');
    setModalRole('INVIGILATOR');
    setModalOpen(true);
  };

  const handleAssign = async () => {
    if (!modalItem || !modalFacultyId || !tenantId) return;
    setAssigning(true);
    setError(null);

    // Check max_duties_per_day
    const fac = faculty.find(f => f.id === modalFacultyId);
    if (fac) {
      const currentCount = getDutiesPerDate(modalFacultyId, modalItem.exam_date, modalItem.id);
      if (currentCount >= fac.max_duties_per_day) {
        setError(`${fac.full_name} already has ${currentCount} dut${currentCount === 1 ? 'y' : 'ies'} on this date (max: ${fac.max_duties_per_day}).`);
        setAssigning(false);
        return;
      }
    }

    const { error: err } = await supabase.from('invigilation_duties').insert({
      tenant_id: tenantId,
      datesheet_item_id: modalItem.id,
      faculty_id: modalFacultyId,
      role: modalRole,
    });

    if (err) setError(err.message);
    else setModalOpen(false);
    setAssigning(false);
    loadItems();
  };

  const handleRemoveDuty = async (dutyId: string) => {
    setAssigning(true);
    const { error: err } = await supabase.from('invigilation_duties').delete().eq('id', dutyId);
    if (err) setError(err.message);
    setAssigning(false);
    loadItems();
  };

  const handleChangeRole = async (dutyId: string, role: InvigilationRole) => {
    const { error: err } = await supabase.from('invigilation_duties').update({ role }).eq('id', dutyId);
    if (err) setError(err.message);
    loadItems();
  };

  // Auto-assign: distribute duties fairly — round-robin by fewest total duties
  const handleAutoAssign = async () => {
    if (itemsWithoutDuties === 0 || faculty.length === 0) return;
    setAssigning(true);
    setError(null);

    const dutyCounts: Record<string, number> = { ...dutySummary };
    let assigned = 0;
    let skipped = 0;

    for (const item of items.filter(i => i.duties.length === 0)) {
      // Find faculty with fewest duties who is not busy and under their daily limit
      const candidates = faculty
        .filter(f => !isFacultyBusy(f.id, item.exam_date, item.time_slot_id, item.id))
        .filter(f => getDutiesPerDate(f.id, item.exam_date, item.id) < f.max_duties_per_day)
        .sort((a, b) => (dutyCounts[a.id] || 0) - (dutyCounts[b.id] || 0));

      if (candidates.length === 0) {
        skipped++;
        continue;
      }

      const chosen = candidates[0];
      await supabase.from('invigilation_duties').insert({
        tenant_id: tenantId,
        datesheet_item_id: item.id,
        faculty_id: chosen.id,
        role: 'INVIGILATOR',
      });
      dutyCounts[chosen.id] = (dutyCounts[chosen.id] || 0) + 1;
      assigned++;
    }

    if (skipped > 0) {
      setError(`Auto-assigned ${assigned} invigilators. ${skipped} exams could not be assigned — all faculty are busy or at their daily limit for those slots.`);
    }
    loadItems();
    setAssigning(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const selectedDs = datesheets.find(d => d.id === selectedDsId);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invigilation Duties</h1>
          <p className="text-sm text-slate-500 mt-1">Assign faculty to invigilate exams with conflict detection</p>
        </div>
        {selectedDsId && itemsWithoutDuties > 0 && faculty.length > 0 && (
          <Button onClick={handleAutoAssign} loading={assigning}>
            <Zap className="h-4 w-4" />
            Auto-Assign ({itemsWithoutDuties})
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {faculty.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          No faculty members found. Add faculty first before assigning invigilation duties.
        </div>
      )}

      {/* Datesheet selector */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <Select label="Select Datesheet" value={selectedDsId} onChange={(e) => { setSelectedDsId(e.target.value); setError(null); }}>
              <option value="">Choose a datesheet...</option>
              {datesheets.map((d) => <option key={d.id} value={d.id}>{d.name} ({DATESHEET_STATUS_LABELS[d.status]})</option>)}
            </Select>
          </div>
          {selectedDs && <Badge className={DATESHEET_STATUS_COLORS[selectedDs.status]}>{DATESHEET_STATUS_LABELS[selectedDs.status]}</Badge>}
        </div>
      </Card>

      {!selectedDsId && !loading && (
        <Card className="p-8 text-center text-slate-500">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>Select a datesheet above to start assigning invigilation duties.</p>
        </Card>
      )}

      {selectedDsId && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Layers className="h-4 w-4 text-slate-400" /><p className="text-xs text-slate-500 uppercase tracking-wider">Total Exams</p></div>
              <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><ShieldCheck className="h-4 w-4 text-emerald-500" /><p className="text-xs text-slate-500 uppercase tracking-wider">Covered</p></div>
              <p className="text-2xl font-bold text-emerald-600">{itemsWithDuties}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500 uppercase tracking-wider">Uncovered</p></div>
              <p className="text-2xl font-bold text-amber-600">{itemsWithoutDuties}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><UserRound className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500 uppercase tracking-wider">Total Duties</p></div>
              <p className="text-2xl font-bold text-blue-600">{totalDuties}</p>
            </Card>
          </div>

          {/* Progress bar */}
          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Coverage Progress</span>
                <span className="text-sm text-slate-500">{Math.round((itemsWithDuties / items.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(itemsWithDuties / items.length) * 100}%` }} />
              </div>
            </Card>
          )}

          {/* Exam list grouped by date */}
          {items.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p>This datesheet has no exam entries yet. Add exams from the Datesheet detail page first.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setExpandedDates(new Set(sortedDates))} className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Expand All</button>
                <button onClick={() => setExpandedDates(new Set())} className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Collapse All</button>
              </div>

              {sortedDates.map((date) => {
                const dateItems = groupedByDate[date];
                const dateCovered = dateItems.filter(i => i.duties.length > 0).length;
                const isExpanded = expandedDates.has(date) || expandedDates.size === 0;

                return (
                  <Card key={date} className="overflow-hidden">
                    <button onClick={() => toggleDate(date)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Calendar className="h-4 w-4 text-blue-600" /></div>
                        <div className="text-left">
                          <h3 className="font-semibold text-slate-900">{formatDate(date)}</h3>
                          <p className="text-xs text-slate-500">{dateItems.length} exams · {dateCovered} covered</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dateCovered === dateItems.length && dateItems.length > 0 && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Complete</Badge>}
                        {dateCovered < dateItems.length && <Badge className="bg-amber-100 text-amber-800 border-amber-200">{dateItems.length - dateCovered} uncovered</Badge>}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {dateItems.map((item) => {
                          const hasChief = item.duties.some(d => d.role === 'CHIEF_INVIGILATOR');

                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                {/* Exam info */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Layers className="h-5 w-5 text-blue-600" /></div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{item.course?.code}</code>
                                      <span className="font-medium text-slate-900 truncate">{item.course?.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-600 flex-wrap">
                                      {item.time_slot && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />{item.time_slot.name} ({formatTime(item.time_slot.start_time)} – {formatTime(item.time_slot.end_time)})</span>}
                                      {item.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{item.room.code} — {item.room.name}</span>}
                                      {!item.room && <span className="flex items-center gap-1 text-amber-600"><MapPin className="h-3.5 w-3.5" />No room</span>}
                                    </div>
                                  </div>
                                </div>

                                {/* Assigned invigilators */}
                                <div className="lg:w-96 shrink-0 space-y-2">
                                  {item.duties.length === 0 ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                      <Users className="h-4 w-4 text-amber-500" />
                                      <span className="text-sm text-amber-700 font-medium">No invigilators assigned</span>
                                    </div>
                                  ) : (
                                    item.duties.map((duty) => {
                                      const isBusy = isFacultyBusy(duty.faculty_id, item.exam_date, item.time_slot_id, item.id);
                                      return (
                                        <div key={duty.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isBusy ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
                                            {(duty.faculty?.full_name || '?').charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{duty.faculty?.full_name || 'Unknown'}</p>
                                            {duty.faculty?.department && <p className="text-xs text-slate-500 truncate">{duty.faculty.department}</p>}
                                          </div>
                                          <select
                                            value={duty.role}
                                            onChange={(e) => handleChangeRole(duty.id, e.target.value as InvigilationRole)}
                                            disabled={assigning}
                                            className="text-xs h-7 rounded border border-slate-300 bg-white px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          >
                                            {Object.entries(INVIGILATION_ROLE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                          </select>
                                          <button onClick={() => handleRemoveDuty(duty.id)} disabled={assigning} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white transition-colors"><UserMinus className="h-4 w-4" /></button>
                                        </div>
                                      );
                                    })
                                  )}

                                  <button
                                    onClick={() => openAssignModal(item)}
                                    disabled={assigning || faculty.length === 0}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors py-2 text-sm font-medium"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                    Add Invigilator
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Faculty duty summary */}
          {items.length > 0 && faculty.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-slate-400" />
                Faculty Duty Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {faculty
                  .filter(f => dutySummary[f.id] > 0)
                  .sort((a, b) => (dutySummary[b.id] || 0) - (dutySummary[a.id] || 0))
                  .map(f => {
                    const count = dutySummary[f.id] || 0;
                    return (
                      <div key={f.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">{f.full_name.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{f.full_name}</p>
                            {f.department && <p className="text-xs text-slate-500 truncate">{f.department}</p>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Max/day: {f.max_duties_per_day}</span>
                          <Badge className={count > 0 ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>{count} total dut{count === 1 ? 'y' : 'ies'}</Badge>
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(dutySummary).length === 0 && (
                  <p className="text-sm text-slate-400 col-span-full text-center py-4">No duties assigned yet.</p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Assign Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Invigilator"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleAssign} loading={assigning} disabled={!modalFacultyId}>Assign</Button></>}
      >
        {modalItem && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{modalItem.course?.code}</code>
                <span className="text-sm font-medium text-slate-900">{modalItem.course?.title}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(modalItem.exam_date)}</span>
                {modalItem.time_slot && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{modalItem.time_slot.name}</span>}
              </div>
            </div>

            <Select label="Faculty Member" value={modalFacultyId} onChange={(e) => setModalFacultyId(e.target.value)}>
              <option value="">Select faculty...</option>
              {faculty.map(f => {
                const busy = isFacultyBusy(f.id, modalItem.exam_date, modalItem.time_slot_id, modalItem.id);
                const dayCount = getDutiesPerDate(f.id, modalItem.exam_date, modalItem.id);
                const atLimit = dayCount >= f.max_duties_per_day;
                const disabled = busy || atLimit;
                return (
                  <option key={f.id} value={f.id} disabled={disabled}>
                    {f.full_name}{busy ? ' [busy — same slot]' : atLimit ? ` [at daily limit (${f.max_duties_per_day})]` : ` (${dayCount}/${f.max_duties_per_day} today)`}
                  </option>
                );
              })}
            </Select>

            <Select label="Role" value={modalRole} onChange={(e) => setModalRole(e.target.value as InvigilationRole)}>
              {Object.entries(INVIGILATION_ROLE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </Select>

            {modalFacultyId && (() => {
              const f = faculty.find(fac => fac.id === modalFacultyId);
              if (!f) return null;
              const dayCount = getDutiesPerDate(f.id, modalItem.exam_date, modalItem.id);
              const busy = isFacultyBusy(f.id, modalItem.exam_date, modalItem.time_slot_id, modalItem.id);
              if (busy) return <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{f.full_name} is already assigned to another exam in this time slot.</div>;
              if (dayCount >= f.max_duties_per_day) return <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{f.full_name} has reached their daily limit of {f.max_duties_per_day} dut{f.max_duties_per_day === 1 ? 'y' : 'ies'}.</div>;
              return <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">{f.full_name} is available. This will be duty {dayCount + 1} of {f.max_duties_per_day} for this date.</div>;
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
