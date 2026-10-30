import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Envelope, EnvelopeStatus, Datesheet, DatesheetItem, Course, TimeSlot, Room } from '@/types/database';
import { DATESHEET_STATUS_LABELS, ENVELOPE_STATUS_LABELS, ENVELOPE_STATUS_COLORS } from '@/types/database';
import {
  Package, AlertCircle, Plus, Search, ArrowRight, ArrowLeft, X, Calendar,
  Clock, MapPin, Layers, CheckCircle2, Archive, Send, FileCheck
} from 'lucide-react';

interface ItemWithRelations extends DatesheetItem {
  course: Course | null;
  time_slot: TimeSlot | null;
  room: Room | null;
  envelopes: Envelope[];
}

export default function EnvelopesPage() {
  const { user } = useAuth();
  const [datesheets, setDatesheets] = useState<Datesheet[]>([]);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal for creating envelope
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<ItemWithRelations | null>(null);
  const [envelopeNumber, setEnvelopeNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const tenantId = user?.profile?.tenant_id;

  const loadDatesheets = useCallback(async () => {
    const { data } = await supabase.from('datesheets').select('*').order('created_at', { ascending: false });
    setDatesheets((data as Datesheet[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDatesheets(); }, [loadDatesheets]);

  const loadItems = useCallback(async () => {
    if (!selectedDsId) { setItems([]); return; }
    setLoading(true);

    const { data: itemsData } = await supabase
      .from('datesheet_items')
      .select('*, course:courses(*), time_slot:time_slots(*), room:rooms(*)')
      .eq('datesheet_id', selectedDsId)
      .order('exam_date', { ascending: true });

    const enrichedItems = (itemsData as ItemWithRelations[]) || [];
    if (enrichedItems.length > 0) {
      const itemIds = enrichedItems.map(i => i.id);
      const { data: envelopes } = await supabase.from('envelopes').select('*').in('datesheet_item_id', itemIds);
      const envMap: Record<string, Envelope[]> = {};
      (envelopes || []).forEach((e: Envelope) => {
        if (!envMap[e.datesheet_item_id]) envMap[e.datesheet_item_id] = [];
        envMap[e.datesheet_item_id].push(e);
      });
      enrichedItems.forEach(i => { i.envelopes = envMap[i.id] || []; });
    }
    setItems(enrichedItems);
    setLoading(false);
  }, [selectedDsId]);

  useEffect(() => { if (selectedDsId) loadItems(); else setItems([]); }, [selectedDsId, loadItems]);

  // Flatten all envelopes with their parent item
  const allEnvelopes = items.flatMap(i => (i.envelopes || []).map(e => ({ ...e, item: i })));
  const filteredEnvelopes = allEnvelopes.filter(e => {
    const matchesSearch = e.envelope_number.toLowerCase().includes(search.toLowerCase()) || (e.item?.course?.code || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    PREPARED: allEnvelopes.filter(e => e.status === 'PREPARED').length,
    DISTRIBUTED: allEnvelopes.filter(e => e.status === 'DISTRIBUTED').length,
    COLLECTED: allEnvelopes.filter(e => e.status === 'COLLECTED').length,
    ARCHIVED: allEnvelopes.filter(e => e.status === 'ARCHIVED').length,
  };

  const openCreateModal = (item: ItemWithRelations) => {
    setModalItem(item);
    const prefix = `ENV-${item.course?.code || 'XX'}-`;
    const existing = (item.envelopes || []).length;
    setEnvelopeNumber(`${prefix}${String(existing + 1).padStart(3, '0')}`);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!modalItem || !envelopeNumber || !tenantId) return;
    setSaving(true);
    const { error: err } = await supabase.from('envelopes').insert({
      tenant_id: tenantId,
      datesheet_item_id: modalItem.id,
      envelope_number: envelopeNumber,
      status: 'PREPARED',
    });
    if (err) setError(err.message);
    else setModalOpen(false);
    setSaving(false);
    loadItems();
  };

  const handleStatusChange = async (envId: string, newStatus: EnvelopeStatus) => {
    const updates: Partial<Envelope> = { status: newStatus };
    if (newStatus === 'DISTRIBUTED') updates.sealed_at = new Date().toISOString();
    if (newStatus === 'COLLECTED') updates.returned_at = new Date().toISOString();

    const { error: err } = await supabase.from('envelopes').update(updates).eq('id', envId);
    if (err) setError(err.message);
    loadItems();
  };

  const handleDelete = async (envId: string) => {
    if (!confirm('Delete this envelope?')) return;
    const { error: err } = await supabase.from('envelopes').delete().eq('id', envId);
    if (err) setError(err.message);
    loadItems();
  };

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const statusFlow: EnvelopeStatus[] = ['PREPARED', 'DISTRIBUTED', 'COLLECTED', 'ARCHIVED'];
  const getNextStatus = (current: EnvelopeStatus): EnvelopeStatus | null => {
    const idx = statusFlow.indexOf(current);
    return idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const statusIcons: Record<EnvelopeStatus, typeof Package> = {
    PREPARED: Package,
    DISTRIBUTED: Send,
    COLLECTED: FileCheck,
    ARCHIVED: Archive,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Envelope Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Track exam paper envelopes through their lifecycle</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Datesheet selector */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <select value={selectedDsId} onChange={(e) => { setSelectedDsId(e.target.value); setError(null); }}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">Choose a datesheet...</option>
              {datesheets.map((d) => <option key={d.id} value={d.id}>{d.name} ({DATESHEET_STATUS_LABELS[d.status]})</option>)}
            </select>
          </div>
        </div>
      </Card>

      {!selectedDsId && !loading && (
        <Card className="p-8 text-center text-slate-500">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p>Select a datesheet above to start tracking envelopes.</p>
        </Card>
      )}

      {selectedDsId && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(Object.keys(statusCounts) as EnvelopeStatus[]).map(status => {
              const Icon = statusIcons[status];
              return (
                <Card key={status} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{ENVELOPE_STATUS_LABELS[status]}</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{statusCounts[status]}</p>
                </Card>
              );
            })}
          </div>

          {/* Search + filter */}
          {allEnvelopes.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input placeholder="Search by envelope number or course code..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
              </div>
              <div className="w-full sm:w-40">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                  <option value="all">All Status</option>
                  <option value="PREPARED">Prepared</option>
                  <option value="DISTRIBUTED">Distributed</option>
                  <option value="COLLECTED">Collected</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
          )}

          {/* Exam list with envelopes */}
          {items.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p>This datesheet has no exam entries. Add exams first.</p>
            </Card>
          ) : allEnvelopes.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p>No envelopes created yet. Use the "Add Envelope" button on each exam to start tracking.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Envelope cards */}
              {filteredEnvelopes.length === 0 ? (
                <Card className="p-6 text-center text-slate-500 text-sm">No envelopes match your search.</Card>
              ) : (
                filteredEnvelopes.map(env => {
                  const item = env.item;
                  const nextStatus = getNextStatus(env.status);
                  const StatusIcon = statusIcons[env.status];

                  return (
                    <Card key={env.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Envelope info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-sm bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold">{env.envelope_number}</code>
                              <Badge className={ENVELOPE_STATUS_COLORS[env.status]}><StatusIcon className="h-3 w-3 mr-1" />{ENVELOPE_STATUS_LABELS[env.status]}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-600 flex-wrap">
                              <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-slate-400" />{item.course?.code} — {item.course?.title}</span>
                              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" />{formatDate(item.exam_date)}</span>
                              {item.time_slot && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />{formatTime(item.time_slot.start_time)}</span>}
                              {item.room && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{item.room.code}</span>}
                            </div>
                            {env.sealed_at && <p className="text-xs text-slate-400 mt-1">Sealed: {new Date(env.sealed_at).toLocaleString()}</p>}
                            {env.returned_at && <p className="text-xs text-slate-400">Returned: {new Date(env.returned_at).toLocaleString()}</p>}
                            {env.notes && <p className="text-xs text-slate-500 italic mt-1">{env.notes}</p>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {nextStatus && (
                            <button
                              onClick={() => handleStatusChange(env.id, nextStatus)}
                              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Mark as {ENVELOPE_STATUS_LABELS[nextStatus]}
                            </button>
                          )}
                          <button onClick={() => handleDelete(env.id)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}

              {/* Per-exam envelope creation */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Create Envelopes per Exam</h3>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2 text-sm">
                        <code className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{item.course?.code}</code>
                        <span className="text-slate-700 truncate">{item.course?.title}</span>
                        <span className="text-xs text-slate-400">{formatDate(item.exam_date)}</span>
                        {(item.envelopes || []).length > 0 && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{(item.envelopes || []).length} envelope{(item.envelopes || []).length !== 1 ? 's' : ''}</Badge>}
                      </div>
                      <button onClick={() => openCreateModal(item)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">
                        <Plus className="h-3.5 w-3.5" /> Add Envelope
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Envelope"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleCreate} loading={saving}>Create</Button></>}
      >
        {modalItem && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{modalItem.course?.code}</code>
                <span className="text-sm font-medium text-slate-900">{modalItem.course?.title}</span>
              </div>
              <p className="text-xs text-slate-500">{formatDate(modalItem.exam_date)}{modalItem.time_slot ? ` · ${modalItem.time_slot.name}` : ''}</p>
            </div>
            <Input label="Envelope Number" value={envelopeNumber} onChange={(e) => setEnvelopeNumber(e.target.value)} placeholder="ENV-CS101-001" />
          </div>
        )}
      </Modal>
    </div>
  );
}
