import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import type { Datesheet, DatesheetItem, Room, ExamCycle, Course, TimeSlot } from '@/types/database';
import { DATESHEET_STATUS_LABELS, DATESHEET_STATUS_COLORS, ROOM_TYPE_LABELS, ROOM_TYPE_COLORS } from '@/types/database';
import {
  ClipboardList, AlertCircle, MapPin, CheckCircle2, Layers, Zap, ArrowRight,
  Calendar, Clock, Users, Building, ChevronDown, ChevronRight, X
} from 'lucide-react';

interface ItemWithRelations extends DatesheetItem {
  course: Course | null;
  time_slot: TimeSlot | null;
  room: Room | null;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictWith?: string;
}

export default function RoomAllocationPage() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [cycle, setCycle] = useState<ExamCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const tenantId = user?.profile?.tenant_id;

  const loadDatesheets = useCallback(async () => {
    const { data } = await supabase.from('datesheets').select('*').order('created_at', { ascending: false });
    setDatesheets((data as Datesheet[]) || []);
  }, []);

  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').eq('is_active', true).order('capacity', { ascending: false });
    setRooms((data as Room[]) || []);
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadDatesheets(), loadRooms()]);
      setLoading(false);
    })();
  }, [loadDatesheets, loadRooms]);

  const loadItems = useCallback(async () => {
    if (!selectedDsId) { setItems([]); return; }
    setLoading(true);

    const { data: ds } = await supabase.from('datesheets').select('*, cycle:exam_cycles(*)').eq('id', selectedDsId).maybeSingle();
    const dsData = ds as Datesheet | null;
    setCycle(dsData?.cycle || null);

    const { data, error: err } = await supabase
      .from('datesheet_items')
      .select('*, course:courses(*), time_slot:time_slots(*), room:rooms(*)')
      .eq('datesheet_id', selectedDsId)
      .order('exam_date', { ascending: true });

    if (err) setError(err.message);
    else setItems((data as ItemWithRelations[]) || []);
    setLoading(false);
  }, [selectedDsId]);

  useEffect(() => {
    if (selectedDsId) loadItems();
    else { setItems([]); setCycle(null); }
  }, [selectedDsId, loadItems]);

  // Detect conflicts: same room, same date, same time slot
  const getConflicts = (): Record<string, ConflictInfo> => {
    const conflicts: Record<string, ConflictInfo> = {};
    const seen: Record<string, string> = {};

    for (const item of items) {
      if (!item.room_id) continue;
      const key = `${item.room_id}-${item.exam_date}-${item.time_slot_id || 'none'}`;
      if (seen[key]) {
        const other = items.find(i => i.id === seen[key]);
        conflicts[item.id] = {
          hasConflict: true,
          conflictWith: other?.course?.code || 'another exam',
        };
        conflicts[seen[key]] = {
          hasConflict: true,
          conflictWith: item.course?.code || 'another exam',
        };
      } else {
        seen[key] = item.id;
      }
    }
    return conflicts;
  };

  const conflicts = getConflicts();
  const assignedCount = items.filter(i => i.room_id).length;
  const unassignedItems = items.filter(i => !i.room_id);
  const conflictCount = Object.keys(conflicts).length;

  // Check if a room is available for a given date + time slot
  const isRoomAvailable = (roomId: string, examDate: string, timeSlotId: string | null, excludeItemId?: string): boolean => {
    return !items.some(i =>
      i.id !== excludeItemId &&
      i.room_id === roomId &&
      i.exam_date === examDate &&
      (i.time_slot_id || null) === (timeSlotId || null)
    );
  };

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

  const handleAssignRoom = async (itemId: string, roomId: string) => {
    setAssigning(true);
    setError(null);
    const { error: err } = await supabase.from('datesheet_items').update({ room_id: roomId || null }).eq('id', itemId);
    if (err) setError(err.message);
    loadItems();
    setAssigning(false);
  };

  const handleClearRoom = async (itemId: string) => {
    setAssigning(true);
    setError(null);
    const { error: err } = await supabase.from('datesheet_items').update({ room_id: null }).eq('id', itemId);
    if (err) setError(err.message);
    loadItems();
    setAssigning(false);
  };

  // Auto-assign: for each unassigned item, find the largest available room
  const handleAutoAssign = async () => {
    if (unassignedItems.length === 0) return;
    setAssigning(true);
    setError(null);

    const updates: { id: string; room_id: string }[] = [];
    const usedRooms = new Set<string>();
    // Track already-assigned room+date+slot combos
    const usedKeys = new Set<string>();
    items.forEach(i => {
      if (i.room_id) usedKeys.add(`${i.room_id}-${i.exam_date}-${i.time_slot_id || 'none'}`);
    });

    for (const item of unassignedItems) {
      const availableRoom = rooms.find(r => {
        const key = `${r.id}-${item.exam_date}-${item.time_slot_id || 'none'}`;
        return !usedKeys.has(key);
      });
      if (availableRoom) {
        updates.push({ id: item.id, room_id: availableRoom.id });
        usedKeys.add(`${availableRoom.id}-${item.exam_date}-${item.time_slot_id || 'none'}`);
      }
    }

    if (updates.length === 0) {
      setError('No available rooms for the remaining exams. Consider adding more rooms or adjusting the schedule.');
      setAssigning(false);
      return;
    }

    for (const u of updates) {
      await supabase.from('datesheet_items').update({ room_id: u.room_id }).eq('id', u.id);
    }

    const skipped = unassignedItems.length - updates.length;
    if (skipped > 0) {
      setError(`Assigned ${updates.length} rooms. ${skipped} exams could not be assigned — not enough available rooms for those date/time combinations.`);
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
          <h1 className="text-2xl font-bold text-slate-900">Room Allocation</h1>
          <p className="text-sm text-slate-500 mt-1">Assign exam halls to exams with conflict detection</p>
        </div>
        {selectedDsId && unassignedItems.length > 0 && (
          <Button onClick={handleAutoAssign} loading={assigning}>
            <Zap className="h-4 w-4" />
            Auto-Assign ({unassignedItems.length})
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {conflictCount > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {conflictCount / 2} room conflict(s) detected — two exams are assigned to the same room on the same date and time slot.
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
          {selectedDs && (
            <Badge className={DATESHEET_STATUS_COLORS[selectedDs.status]}>{DATESHEET_STATUS_LABELS[selectedDs.status]}</Badge>
          )}
        </div>
      </Card>

      {!selectedDsId && !loading && (
        <Card className="p-8 text-center text-slate-500">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>Select a datesheet above to start assigning rooms.</p>
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
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><p className="text-xs text-slate-500 uppercase tracking-wider">Assigned</p></div>
              <p className="text-2xl font-bold text-emerald-600">{assignedCount}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500 uppercase tracking-wider">Unassigned</p></div>
              <p className="text-2xl font-bold text-amber-600">{unassignedItems.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Building className="h-4 w-4 text-slate-400" /><p className="text-xs text-slate-500 uppercase tracking-wider">Available Rooms</p></div>
              <p className="text-2xl font-bold text-slate-900">{rooms.length}</p>
            </Card>
          </div>

          {/* Progress bar */}
          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Allocation Progress</span>
                <span className="text-sm text-slate-500">{Math.round((assignedCount / items.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(assignedCount / items.length) * 100}%` }} />
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
              {/* Expand/collapse all */}
              <div className="flex items-center gap-3">
                <button onClick={() => setExpandedDates(new Set(sortedDates))} className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Expand All</button>
                <button onClick={() => setExpandedDates(new Set())} className="text-xs px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">Collapse All</button>
              </div>

              {sortedDates.map((date) => {
                const dateItems = groupedByDate[date];
                const dateAssigned = dateItems.filter(i => i.room_id).length;
                const isExpanded = expandedDates.has(date) || expandedDates.size === 0;

                return (
                  <Card key={date} className="overflow-hidden">
                    {/* Date header */}
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-slate-900">{formatDate(date)}</h3>
                          <p className="text-xs text-slate-500">{dateItems.length} exams · {dateAssigned} assigned</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dateAssigned === dateItems.length && dateItems.length > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Complete</Badge>
                        )}
                        {dateAssigned < dateItems.length && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">{dateItems.length - dateAssigned} pending</Badge>
                        )}
                      </div>
                    </button>

                    {/* Items for this date */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {dateItems.map((item) => {
                          const conflict = conflicts[item.id];
                          const availableRooms = rooms.filter(r => isRoomAvailable(r.id, item.exam_date, item.time_slot_id, item.id));

                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                {/* Exam info */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                    <Layers className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{item.course?.code}</code>
                                      <span className="font-medium text-slate-900 truncate">{item.course?.title}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-600 flex-wrap">
                                      {item.time_slot && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                                          {item.time_slot.name} ({formatTime(item.time_slot.start_time)} – {formatTime(item.time_slot.end_time)})
                                        </span>
                                      )}
                                      {!item.time_slot && (
                                        <span className="flex items-center gap-1 text-slate-400">
                                          <Clock className="h-3.5 w-3.5" /> No time slot
                                        </span>
                                      )}
                                    </div>
                                    {conflict?.hasConflict && (
                                      <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Room conflict with {conflict.conflictWith}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Room assignment */}
                                <div className="flex items-center gap-3 lg:w-80 shrink-0">
                                  {item.room ? (
                                    <div className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 ${conflict?.hasConflict ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                                      <MapPin className={`h-4 w-4 ${conflict?.hasConflict ? 'text-red-500' : 'text-emerald-600'}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${conflict?.hasConflict ? 'text-red-900' : 'text-emerald-900'}`}>{item.room.code} — {item.room.name}</p>
                                        <p className="text-xs text-slate-500">{item.room.capacity} seats · {ROOM_TYPE_LABELS[item.room.room_type]}</p>
                                      </div>
                                      <button onClick={() => handleClearRoom(item.id)} disabled={assigning} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white transition-colors">
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex-1 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                      <MapPin className="h-4 w-4 text-amber-500" />
                                      <span className="text-sm text-amber-700 font-medium">No room assigned</span>
                                    </div>
                                  )}

                                  {/* Room selector dropdown */}
                                  <div className="relative">
                                    <select
                                      value={item.room_id || ''}
                                      onChange={(e) => handleAssignRoom(item.id, e.target.value)}
                                      disabled={assigning}
                                      className="appearance-none h-10 rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                                    >
                                      <option value="">—</option>
                                      {rooms.map(r => {
                                        const avail = isRoomAvailable(r.id, item.exam_date, item.time_slot_id, item.id);
                                        return (
                                          <option key={r.id} value={r.id} disabled={!avail}>
                                            {r.code} — {r.name} ({r.capacity}){!avail ? ' [busy]' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                  </div>
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

          {/* Room utilization summary */}
          {items.length > 0 && rooms.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Building className="h-5 w-5 text-slate-400" />
                Room Utilization Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rooms.map(room => {
                  const usedCount = items.filter(i => i.room_id === room.id).length;
                  const utilization = items.length > 0 ? Math.round((usedCount / items.length) * 100) : 0;
                  return (
                    <div key={room.id} className={`rounded-lg border p-3 ${usedCount > 0 ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-xs bg-white text-slate-700 px-1.5 py-0.5 rounded font-medium border border-slate-200">{room.code}</code>
                        <Badge className={ROOM_TYPE_COLORS[room.room_type]}>{ROOM_TYPE_LABELS[room.room_type]}</Badge>
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate">{room.name}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.capacity} seats</span>
                        <span className="font-medium text-slate-700">{usedCount} exam{usedCount !== 1 ? 's' : ''}</span>
                      </div>
                      {usedCount > 0 && (
                        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(utilization * 3, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
