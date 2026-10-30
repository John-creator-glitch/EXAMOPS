import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import type { Datesheet, DatesheetItem, Course, TimeSlot, Room } from '@/types/database';
import { DATESHEET_STATUS_LABELS } from '@/types/database';
import { QrCode, AlertCircle, Calendar, Clock, MapPin, Layers, Download, Building } from 'lucide-react';

interface ItemWithRelations extends DatesheetItem {
  course: Course | null;
  time_slot: TimeSlot | null;
  room: Room | null;
}

export default function QRPublisherPage() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const tenantName = user?.tenant?.name || 'University';

  const loadDatesheets = useCallback(async () => {
    const { data } = await supabase.from('datesheets').select('*').order('created_at', { ascending: false });
    setDatesheets((data as Datesheet[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDatesheets(); }, [loadDatesheets]);

  const loadItems = useCallback(async () => {
    if (!selectedDsId) { setItems([]); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('datesheet_items')
      .select('*, course:courses(*), time_slot:time_slots(*), room:rooms(*)')
      .eq('datesheet_id', selectedDsId)
      .order('exam_date', { ascending: true });
    if (err) setError(err.message);
    else {
      const enriched = (data as ItemWithRelations[]) || [];
      setItems(enriched);
      if (enriched.length > 0 && !selectedItemId) setSelectedItemId(enriched[0].id);
      else if (enriched.length === 0) setSelectedItemId('');
    }
    setLoading(false);
  }, [selectedDsId]);

  useEffect(() => { loadItems(); }, [loadItems]);

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

  const selectedItem = items.find(i => i.id === selectedItemId);
  const selectedDs = datesheets.find(d => d.id === selectedDsId);

  // Generate QR code using a public API — encodes exam info as text
  const qrContent = selectedItem
    ? JSON.stringify({
        university: tenantName,
        course: selectedItem.course?.code,
        title: selectedItem.course?.title,
        date: selectedItem.exam_date,
        time: selectedItem.time_slot ? `${selectedItem.time_slot.start_time}-${selectedItem.time_slot.end_time}` : '',
        room: selectedItem.room?.code || '',
        datesheet: selectedDs?.name || '',
      })
    : '';

  const qrUrl = qrContent
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrContent)}`
    : '';

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `QR-${selectedItem?.course?.code || 'exam'}.png`;
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">QR Publisher</h1>
        <p className="text-sm text-slate-500 mt-1">Generate QR codes for exam identification</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div>}

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Datesheet" value={selectedDsId} onChange={(e) => { setSelectedDsId(e.target.value); setSelectedItemId(''); }}>
            <option value="">Choose a datesheet...</option>
            {datesheets.map((d) => <option key={d.id} value={d.id}>{d.name} ({DATESHEET_STATUS_LABELS[d.status]})</option>)}
          </Select>
          <Select label="Exam" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} disabled={!selectedDsId}>
            <option value="">Choose an exam...</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>
                {i.course?.code} — {i.course?.title} ({new Date(i.exam_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {!selectedDsId && !loading && (
        <Card className="p-8 text-center text-slate-500">
          <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>Select a datesheet and exam to generate a QR code.</p>
        </Card>
      )}

      {selectedDsId && items.length === 0 && !loading && (
        <Card className="p-8 text-center text-slate-500">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>This datesheet has no exam entries.</p>
        </Card>
      )}

      {selectedItem && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Code */}
          <Card className="p-6 flex flex-col items-center justify-center">
            <div className="w-64 h-64 rounded-xl border-2 border-slate-200 flex items-center justify-center bg-white">
              {qrUrl && <img src={qrUrl} alt="QR Code" className="w-full h-full p-2" />}
            </div>
            <button onClick={handleDownload} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              <Download className="h-4 w-4" />
              Download QR
            </button>
            <p className="text-xs text-slate-400 mt-2">Scanning this code shows exam details</p>
          </Card>

          {/* Exam details */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{tenantName}</h3>
                <p className="text-xs text-slate-500">{selectedDs?.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Layers className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-slate-500">Course</p>
                  <p className="text-sm font-medium text-slate-900"><span className="text-blue-700">{selectedItem.course?.code}</span> — {selectedItem.course?.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><Calendar className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(selectedItem.exam_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-amber-600" /></div>
                <div>
                  <p className="text-xs text-slate-500">Time Slot</p>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedItem.time_slot ? `${selectedItem.time_slot.name} (${formatTime(selectedItem.time_slot.start_time)} – ${formatTime(selectedItem.time_slot.end_time)})` : 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-rose-600" /></div>
                <div>
                  <p className="text-xs text-slate-500">Room</p>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedItem.room ? `${selectedItem.room.code} — ${selectedItem.room.name} (${selectedItem.room.capacity} seats)` : 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
