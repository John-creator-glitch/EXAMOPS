import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Setting, SettingValueType } from '@/types/database';
import { SETTING_CATEGORIES } from '@/types/database';
import { Settings, Search, Edit2, Save, AlertCircle } from 'lucide-react';

const SETTING_KEYS: { key: string; label: string; valueType: SettingValueType; category: string; defaultValue: string; description: string }[] = [
  { key: 'MaxPapersPerRoom', label: 'Max Papers Per Room', valueType: 'NUMBER', category: 'ROOM', defaultValue: '1', description: 'Maximum papers allowed per room per slot' },
  { key: 'SpareSeatsPerRoom', label: 'Spare Seats Per Room', valueType: 'NUMBER', category: 'ROOM', defaultValue: '5', description: 'Spare seats kept empty per room for social distancing' },
  { key: 'FixedChairUsablePercent', label: 'Fixed Chair Usable %', valueType: 'NUMBER', category: 'ROOM', defaultValue: '50', description: 'Usable capacity percentage for fixed-chair rooms' },
  { key: 'MovableChairUsablePercent', label: 'Movable Chair Usable %', valueType: 'NUMBER', category: 'ROOM', defaultValue: '100', description: 'Usable capacity percentage for movable-chair rooms' },
  { key: 'ExtraChairsPerRoom', label: 'Extra Chairs Per Room', valueType: 'NUMBER', category: 'ROOM', defaultValue: '0', description: 'Extra chairs allowed per room beyond listed capacity' },
  { key: 'MinInvigilatorsPerRoom', label: 'Min Invigilators Per Room', valueType: 'NUMBER', category: 'INVIGILATION', defaultValue: '1', description: 'Minimum invigilators assigned per room' },
  { key: 'StudentsPerInvigilator', label: 'Students Per Invigilator', valueType: 'NUMBER', category: 'INVIGILATION', defaultValue: '30', description: 'Number of students managed per invigilator' },
  { key: 'ForceTwoInvigilatorsPerRoom', label: 'Force Two Invigilators', valueType: 'BOOLEAN', category: 'INVIGILATION', defaultValue: 'false', description: 'Always assign at least 2 invigilators per room' },
  { key: 'RelaxRulesIfRoomsShort', label: 'Relax Rules If Rooms Short', valueType: 'BOOLEAN', category: 'INVIGILATION', defaultValue: 'true', description: 'Relax invigilation rules when rooms are insufficient' },
  { key: 'ReserveInvigilatorsPerSlot', label: 'Reserve Invigilators Per Slot', valueType: 'NUMBER', category: 'INVIGILATION', defaultValue: '0', description: 'Reserve invigilators kept on standby per slot' },
  { key: 'StrengthSource', label: 'Strength Source', valueType: 'STRING', category: 'SCHEDULING', defaultValue: 'COURSE_STRENGTH', description: 'Source of student strength (COURSE_STRENGTH or MANUAL)' },
  { key: 'FridayPartialHoliday', label: 'Friday Partial Holiday', valueType: 'BOOLEAN', category: 'SCHEDULING', defaultValue: 'false', description: 'Treat Friday as partial holiday (drop break-window slots)' },
  { key: 'EnforceSemesterSlots', label: 'Enforce Semester Slots', valueType: 'BOOLEAN', category: 'SCHEDULING', defaultValue: 'false', description: 'Enforce semester-based slot assignments' },
  { key: 'SemesterSlotStrict', label: 'Semester Slot Strict', valueType: 'BOOLEAN', category: 'SCHEDULING', defaultValue: 'false', description: 'Strictly enforce semester slot assignments (no overrides)' },
  { key: 'AllowRegularSameDay', label: 'Allow Regular Same Day', valueType: 'BOOLEAN', category: 'SCHEDULING', defaultValue: 'true', description: 'Allow regular papers on the same day for different semesters' },
  { key: 'MSAllowedSlots', label: 'MS Allowed Slots', valueType: 'NUMBER', category: 'SCHEDULING', defaultValue: '2', description: 'Allowed slots per day for MS/PhD track' },
  { key: 'MSMaxPapersPerDay', label: 'MS Max Papers Per Day', valueType: 'NUMBER', category: 'SCHEDULING', defaultValue: '1', description: 'Max papers per day for MS/PhD track' },
  { key: 'InstituteName', label: 'Institute Name', valueType: 'STRING', category: 'INSTITUTE', defaultValue: '', description: 'Institution name for print headers' },
  { key: 'CreatorName', label: 'Creator Name', valueType: 'STRING', category: 'INSTITUTE', defaultValue: '', description: 'Examination officer name for print signatures' },
  { key: 'PrintSignatures', label: 'Print Signatures', valueType: 'BOOLEAN', category: 'INSTITUTE', defaultValue: 'false', description: 'Include signature lines on printed datesheets' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const tenantId = user?.profile?.tenant_id;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('settings').select('*').order('category').order('key');
    if (error) setError(error.message);
    else setSettings((data as Setting[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const settingsMap = new Map(settings.map((s) => [s.key, s]));

  const allSettings = SETTING_KEYS.map((sk) => {
    const existing = settingsMap.get(sk.key);
    return {
      ...sk,
      id: existing?.id,
      value: existing?.value ?? sk.defaultValue,
      exists: !!existing,
    };
  });

  const filtered = allSettings.filter((s) => {
    const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase()) || s.key.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const groupedByCategory = filtered.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof allSettings>);

  const openEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = async () => {
    if (!editingKey || !tenantId) return;
    setSaving(true);
    setError(null);

    const settingDef = SETTING_KEYS.find((s) => s.key === editingKey);
    if (!settingDef) return;

    const existing = settingsMap.get(editingKey);

    if (existing) {
      const { error } = await supabase.from('settings').update({ value: editValue }).eq('id', existing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('settings').insert({
        tenant_id: tenantId,
        key: editingKey,
        value: editValue,
        value_type: settingDef.valueType,
        category: settingDef.category,
        description: settingDef.description,
      });
      if (error) setError(error.message);
    }

    setSaving(false);
    setEditingKey(null);
    loadSettings();
  };

  const renderValueDisplay = (value: string, valueType: SettingValueType) => {
    if (valueType === 'BOOLEAN') {
      return value === 'true' ? 'Yes' : 'No';
    }
    return value || '—';
  };

  const categories = Object.keys(SETTING_CATEGORIES);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure examination scheduling rules and institution details</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Search settings..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="w-full sm:w-56">
          <select className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{SETTING_CATEGORIES[c]}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500">Loading settings...</Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCategory).map(([category, items]) => (
            <Card key={category} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-slate-500" />
                  {SETTING_CATEGORIES[category] || category}
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((s) => (
                  <div key={s.key} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{s.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <Badge className={
                        s.valueType === 'BOOLEAN'
                          ? s.value === 'true'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }>
                        {renderValueDisplay(s.value, s.valueType)}
                      </Badge>
                      {!s.exists && <Badge className="bg-amber-50 text-amber-700 border-amber-200">Default</Badge>}
                      <button onClick={() => openEdit(s.key, s.value)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editingKey}
        onClose={() => setEditingKey(null)}
        title={`Edit ${SETTING_KEYS.find((s) => s.key === editingKey)?.label || ''}`}
        footer={<><Button variant="outline" onClick={() => setEditingKey(null)}>Cancel</Button><Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" />Save</Button></>}
      >
        <div className="space-y-4">
          {(() => {
            const def = SETTING_KEYS.find((s) => s.key === editingKey);
            if (!def) return null;
            if (def.valueType === 'BOOLEAN') {
              return (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{def.description}</label>
                  <div className="flex gap-3">
                    <button onClick={() => setEditValue('true')} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${editValue === 'true' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Yes</button>
                    <button onClick={() => setEditValue('false')} className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${editValue === 'false' ? 'border-slate-500 bg-slate-50 text-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>No</button>
                  </div>
                </div>
              );
            }
            return (
              <Input
                label={def.description}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                type={def.valueType === 'NUMBER' ? 'number' : 'text'}
              />
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}
