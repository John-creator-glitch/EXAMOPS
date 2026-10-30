import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import type { Datesheet, DatesheetItem, Course, TimeSlot, Room, ExamCycle, Faculty, InvigilationDuty } from '@/types/database';
import { DATESHEET_STATUS_LABELS, INVIGILATION_ROLE_LABELS, ROOM_TYPE_LABELS } from '@/types/database';
import { FileText, Printer, Calendar, Clock, MapPin, Users, ClipboardList, AlertCircle, FileBarChart, Building } from 'lucide-react';

type ReportType = 'datesheet' | 'seating' | 'duty';

interface ItemWithRelations extends DatesheetItem {
  course: Course & { program?: { code: string } | null };
  time_slot: TimeSlot | null;
  room: Room | null;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [reportType, setReportType] = useState<ReportType>('datesheet');
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [duties, setDuties] = useState<Record<string, (InvigilationDuty & { faculty: Faculty | null })[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantName = user?.tenant?.name || 'University';

  const loadDatesheets = useCallback(async () => {
    const { data } = await supabase.from('datesheets').select('*').order('created_at', { ascending: false });
    setDatesheets((data as Datesheet[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDatesheets(); }, [loadDatesheets]);

  const loadReportData = useCallback(async () => {
    if (!selectedDsId) { setItems([]); setDuties({}); return; }
    setLoading(true);

    const { data: itemsData, error: err } = await supabase
      .from('datesheet_items')
      .select('*, course:courses(*, program:programs(*)), time_slot:time_slots(*), room:rooms(*)')
      .eq('datesheet_id', selectedDsId)
      .order('exam_date', { ascending: true });

    if (err) { setError(err.message); setLoading(false); return; }
    const enrichedItems = (itemsData as ItemWithRelations[]) || [];
    setItems(enrichedItems);

    // Load duties if duty roster or seating report
    if (enrichedItems.length > 0) {
      const itemIds = enrichedItems.map(i => i.id);
      const { data: dutiesData } = await supabase
        .from('invigilation_duties')
        .select('*, faculty:faculty(*)')
        .in('datesheet_item_id', itemIds);

      const dutiesMap: Record<string, (InvigilationDuty & { faculty: Faculty | null })[]> = {};
      (dutiesData || []).forEach((d: InvigilationDuty & { faculty: Faculty | null }) => {
        if (!dutiesMap[d.datesheet_item_id]) dutiesMap[d.datesheet_item_id] = [];
        dutiesMap[d.datesheet_item_id].push(d);
      });
      setDuties(dutiesMap);
    }

    setLoading(false);
  }, [selectedDsId]);

  useEffect(() => { loadReportData(); }, [loadReportData]);

  const selectedDs = datesheets.find(d => d.id === selectedDsId);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateShort = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
  }, {} as Record<string, ItemWithRelations[]>);
  const sortedDates = Object.keys(groupedByDate).sort();

  const handlePrint = () => window.print();

  const reportTypes: { value: ReportType; label: string; icon: typeof FileText; desc: string }[] = [
    { value: 'datesheet', label: 'Datesheet', icon: FileText, desc: 'Complete exam schedule' },
    { value: 'seating', label: 'Seating Plan', icon: MapPin, desc: 'Room-wise seating arrangement' },
    { value: 'duty', label: 'Duty Roster', icon: ClipboardList, desc: 'Invigilator assignments' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Generate printable exam reports</p>
        </div>
        {selectedDsId && items.length > 0 && (
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2 print:hidden"><AlertCircle className="h-4 w-4" />{error}</div>}

      {/* Controls */}
      <Card className="p-5 print:hidden">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Datesheet" value={selectedDsId} onChange={(e) => setSelectedDsId(e.target.value)}>
              <option value="">Choose a datesheet...</option>
              {datesheets.map((d) => <option key={d.id} value={d.id}>{d.name} ({DATESHEET_STATUS_LABELS[d.status]})</option>)}
            </Select>
            <Select label="Report Type" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              {reportTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
            </Select>
          </div>

          {/* Report type cards */}
          <div className="grid grid-cols-3 gap-3">
            {reportTypes.map(rt => {
              const Icon = rt.icon;
              const active = reportType === rt.value;
              return (
                <button key={rt.value} onClick={() => setReportType(rt.value)} className={`flex flex-col items-center text-center p-3 rounded-lg border transition-colors ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <Icon className={`h-5 w-5 mb-1.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${active ? 'text-blue-900' : 'text-slate-700'}`}>{rt.label}</span>
                  <span className="text-xs text-slate-400 mt-0.5">{rt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!selectedDsId && !loading && (
        <Card className="p-8 text-center text-slate-500 print:hidden">
          <FileBarChart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>Select a datesheet and report type to generate a printable report.</p>
        </Card>
      )}

      {selectedDsId && !loading && items.length === 0 && (
        <Card className="p-8 text-center text-slate-500 print:hidden">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>This datesheet has no exam entries. Add exams first.</p>
        </Card>
      )}

      {/* Report output */}
      {selectedDsId && items.length > 0 && (
        <Card className="p-8 print:border-0 print:shadow-none">
          {/* Report header */}
          <div className="text-center border-b border-slate-200 pb-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center print:bg-blue-100">
                <Building className="h-6 w-6 text-blue-600 print:text-blue-700" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{tenantName}</h2>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {reportType === 'datesheet' && 'Examination Schedule'}
              {reportType === 'seating' && 'Seating Plan'}
              {reportType === 'duty' && 'Invigilation Duty Roster'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{selectedDs?.name}</p>
          </div>

          {/* Datesheet Report */}
          {reportType === 'datesheet' && (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900">{formatDate(date)}</h4>
                  </div>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Course Code</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Course Title</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Time</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedByDate[date].map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-blue-700">{item.course?.code}</td>
                          <td className="px-4 py-2.5 text-slate-900">{item.course?.title}</td>
                          <td className="px-4 py-2.5 text-slate-600">{item.time_slot ? `${item.time_slot.name} (${formatTime(item.time_slot.start_time)} – ${formatTime(item.time_slot.end_time)})` : '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{item.room ? `${item.room.code} — ${item.room.name}` : 'TBD'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Seating Plan Report */}
          {reportType === 'seating' && (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900">{formatDate(date)}</h4>
                  </div>
                  <div className="space-y-3">
                    {groupedByDate[date]
                      .filter(i => i.room)
                      .map(item => (
                        <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-emerald-600" />
                              <span className="font-semibold text-slate-900">{item.room?.code} — {item.room?.name}</span>
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{item.room?.capacity} seats</Badge>
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200">{ROOM_TYPE_LABELS[item.room!.room_type]}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 ml-6">
                            <span className="font-medium text-blue-700">{item.course?.code}</span>
                            <span>{item.course?.title}</span>
                            {item.time_slot && <span className="text-slate-400">·</span>}
                            {item.time_slot && <span>{formatTime(item.time_slot.start_time)} – {formatTime(item.time_slot.end_time)}</span>}
                          </div>
                        </div>
                      ))}
                    {groupedByDate[date].filter(i => !i.room).length > 0 && (
                      <div className="ml-6 text-sm text-amber-600">{groupedByDate[date].filter(i => !i.room).length} exam(s) without room assignment</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Duty Roster Report */}
          {reportType === 'duty' && (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900">{formatDate(date)}</h4>
                  </div>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Time</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Room</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Course</th>
                        <th className="text-left px-4 py-2 font-semibold text-slate-700 border-b border-slate-200">Invigilators</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedByDate[date].map(item => {
                        const itemDuties = duties[item.id] || [];
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-600">{item.time_slot ? `${formatTime(item.time_slot.start_time)} – ${formatTime(item.time_slot.end_time)}` : '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.room?.code || 'TBD'}</td>
                            <td className="px-4 py-2.5"><span className="font-medium text-blue-700">{item.course?.code}</span> <span className="text-slate-500">{item.course?.title}</span></td>
                            <td className="px-4 py-2.5">
                              {itemDuties.length === 0 ? (
                                <span className="text-amber-600 text-xs">No invigilators</span>
                              ) : (
                                <div className="space-y-0.5">
                                  {itemDuties.sort((a, b) => a.role.localeCompare(b.role)).map(d => (
                                    <div key={d.id} className="text-xs">
                                      <span className={`font-medium ${d.role === 'CHIEF_INVIGILATOR' ? 'text-blue-700' : 'text-slate-700'}`}>{d.faculty?.full_name}</span>
                                      <span className="text-slate-400 ml-1">({INVIGILATION_ROLE_LABELS[d.role]})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 mt-8 pt-4 text-center text-xs text-slate-400">
            Generated on {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} · ExamOps Examination Management System
          </div>
        </Card>
      )}
    </div>
  );
}
