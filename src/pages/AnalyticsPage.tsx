import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import {
  GraduationCap, Users, Calendar, BookOpen, DoorOpen, FileText, UserRound,
  Layers, Package, ShieldCheck, TrendingUp, AlertCircle, BarChart3, Building, ClipboardList
} from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.role === 'SUPER_ADMIN';

  const [counts, setCounts] = useState({
    tenants: 0,
    users: 0,
    programs: 0,
    courses: 0,
    rooms: 0,
    faculty: 0,
    cycles: 0,
    datesheets: 0,
    datesheetItems: 0,
    duties: 0,
    envelopes: 0,
    publishedDatesheets: 0,
  });
  const [envelopeStats, setEnvelopeStats] = useState({ PREPARED: 0, DISTRIBUTED: 0, COLLECTED: 0, ARCHIVED: 0 });
  const [cycleStats, setCycleStats] = useState({ DRAFT: 0, PUBLISHED: 0, COMPLETED: 0, ARCHIVED: 0 });
  const [roomUtilization, setRoomUtilization] = useState<{ code: string; name: string; count: number }[]>([]);
  const [facultyDuties, setFacultyDuties] = useState<{ full_name: string; department: string | null; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    const tables = ['tenants', 'profiles', 'programs', 'courses', 'rooms', 'faculty', 'exam_cycles', 'datesheets', 'datesheet_items', 'invigilation_duties', 'envelopes'];
    const results = await Promise.all(tables.map(t => supabase.from(t).select('*', { count: 'exact', head: true })));
    const c = {
      tenants: results[0].count || 0,
      users: results[1].count || 0,
      programs: results[2].count || 0,
      courses: results[3].count || 0,
      rooms: results[4].count || 0,
      faculty: results[5].count || 0,
      cycles: results[6].count || 0,
      datesheets: results[7].count || 0,
      datesheetItems: results[8].count || 0,
      duties: results[9].count || 0,
      envelopes: results[10].count || 0,
      publishedDatesheets: 0,
    };

    // Published datesheets
    const { count: pubCount } = await supabase.from('datesheets').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED');
    c.publishedDatesheets = pubCount || 0;

    // Envelope status breakdown
    const { data: envData } = await supabase.from('envelopes').select('status');
    const envStats = { PREPARED: 0, DISTRIBUTED: 0, COLLECTED: 0, ARCHIVED: 0 };
    (envData || []).forEach((e: { status: keyof typeof envStats }) => { envStats[e.status]++; });
    setEnvelopeStats(envStats);

    // Cycle status breakdown
    const { data: cycleData } = await supabase.from('exam_cycles').select('status');
    const cStats = { DRAFT: 0, PUBLISHED: 0, COMPLETED: 0, ARCHIVED: 0 };
    (cycleData || []).forEach((c: { status: keyof typeof cStats }) => { cStats[c.status]++; });
    setCycleStats(cStats);

    // Room utilization — count datesheet_items per room
    const { data: roomData } = await supabase.from('datesheet_items').select('room:rooms(code, name)').not('room_id', 'is', null);
    const roomMap: Record<string, { code: string; name: string; count: number }> = {};
    (roomData || []).forEach((r: any) => {
      if (r.room) {
        const room = Array.isArray(r.room) ? r.room[0] : r.room;
        if (room) {
          const key = room.code;
          if (!roomMap[key]) roomMap[key] = { code: room.code, name: room.name, count: 0 };
          roomMap[key].count++;
        }
      }
    });
    setRoomUtilization(Object.values(roomMap).sort((a, b) => b.count - a.count).slice(0, 8));

    // Faculty duty counts
    const { data: dutyData } = await supabase.from('invigilation_duties').select('faculty:faculty(full_name, department)');
    const facMap: Record<string, { full_name: string; department: string | null; count: number }> = {};
    (dutyData || []).forEach((d: any) => {
      if (d.faculty) {
        const fac = Array.isArray(d.faculty) ? d.faculty[0] : d.faculty;
        if (fac) {
          const key = fac.full_name;
          if (!facMap[key]) facMap[key] = { full_name: fac.full_name, department: fac.department, count: 0 };
          facMap[key].count++;
        }
      }
    });
    setFacultyDuties(Object.values(facMap).sort((a, b) => b.count - a.count).slice(0, 8));

    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const maxRoomCount = Math.max(...roomUtilization.map(r => r.count), 1);
  const maxFacultyCount = Math.max(...facultyDuties.map(f => f.count), 1);
  const maxEnvCount = Math.max(...Object.values(envelopeStats), 1);
  const maxCycleCount = Math.max(...Object.values(cycleStats), 1);

  const entityStats = isSuperAdmin
    ? [
        { label: 'Tenants', value: counts.tenants, icon: Building, color: 'text-blue-600 bg-blue-50' },
        { label: 'Users', value: counts.users, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Exam Cycles', value: counts.cycles, icon: Calendar, color: 'text-amber-600 bg-amber-50' },
        { label: 'Datesheets', value: counts.datesheets, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
        { label: 'Exam Entries', value: counts.datesheetItems, icon: Layers, color: 'text-cyan-600 bg-cyan-50' },
        { label: 'Duties', value: counts.duties, icon: ShieldCheck, color: 'text-rose-600 bg-rose-50' },
        { label: 'Envelopes', value: counts.envelopes, icon: Package, color: 'text-slate-600 bg-slate-100' },
        { label: 'Rooms', value: counts.rooms, icon: DoorOpen, color: 'text-emerald-600 bg-emerald-50' },
      ]
    : [
        { label: 'Programs', value: counts.programs, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
        { label: 'Courses', value: counts.courses, icon: Layers, color: 'text-cyan-600 bg-cyan-50' },
        { label: 'Rooms', value: counts.rooms, icon: DoorOpen, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Faculty', value: counts.faculty, icon: UserRound, color: 'text-amber-600 bg-amber-50' },
        { label: 'Exam Cycles', value: counts.cycles, icon: Calendar, color: 'text-rose-600 bg-rose-50' },
        { label: 'Datesheets', value: counts.datesheets, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
        { label: 'Exam Entries', value: counts.datesheetItems, icon: Layers, color: 'text-blue-600 bg-blue-50' },
        { label: 'Duties', value: counts.duties, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Envelopes', value: counts.envelopes, icon: Package, color: 'text-slate-600 bg-slate-100' },
      ];

  const envStatusColors: Record<string, string> = {
    PREPARED: 'bg-slate-400', DISTRIBUTED: 'bg-blue-500', COLLECTED: 'bg-emerald-500', ARCHIVED: 'bg-gray-300',
  };

  const cycleStatusColors: Record<string, string> = {
    DRAFT: 'bg-slate-400', PUBLISHED: 'bg-blue-500', COMPLETED: 'bg-emerald-500', ARCHIVED: 'bg-gray-300',
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide insights and statistics</p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500">Loading analytics...</Card>
      ) : (
        <>
          {/* Entity stats grid */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-slate-400" />Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {entityStats.map(stat => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="p-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exam Cycle Status */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-slate-400" />Exam Cycle Status</h3>
              <div className="space-y-3">
                {Object.entries(cycleStats).map(([status, count]) => (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 capitalize">{status.toLowerCase()}</span>
                      <span className="text-sm font-medium text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${cycleStatusColors[status]}`} style={{ width: `${(count / maxCycleCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Envelope Status */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-slate-400" />Envelope Tracking</h3>
              <div className="space-y-3">
                {Object.entries(envelopeStats).map(([status, count]) => (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 capitalize">{status.toLowerCase()}</span>
                      <span className="text-sm font-medium text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${envStatusColors[status]}`} style={{ width: `${(count / maxEnvCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Room utilization + Faculty duties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Room Utilization */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><DoorOpen className="h-5 w-5 text-slate-400" />Top Rooms by Usage</h3>
              {roomUtilization.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No room assignments yet.</p>
              ) : (
                <div className="space-y-3">
                  {roomUtilization.map(r => (
                    <div key={r.code}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{r.code} — {r.name}</span>
                        <span className="text-sm text-slate-500">{r.count} exam{r.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${(r.count / maxRoomCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Faculty Duty Load */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-400" />Top Faculty by Duties</h3>
              {facultyDuties.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No invigilation duties assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {facultyDuties.map(f => (
                    <div key={f.full_name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">{f.full_name.charAt(0)}</div>
                          <span className="text-sm font-medium text-slate-700">{f.full_name}</span>
                        </div>
                        <span className="text-sm text-slate-500">{f.count} dut{f.count === 1 ? 'y' : 'ies'}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(f.count / maxFacultyCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Key insights */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-slate-400" />Key Insights</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-indigo-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Published Datesheets</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.publishedDatesheets} <span className="text-sm font-normal text-slate-400">/ {counts.datesheets}</span></p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><Layers className="h-4 w-4 text-blue-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Exams per Datesheet</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.datesheets > 0 ? (counts.datesheetItems / counts.datesheets).toFixed(1) : '0'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><ShieldCheck className="h-4 w-4 text-emerald-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Duties per Exam</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.datesheetItems > 0 ? (counts.duties / counts.datesheetItems).toFixed(1) : '0'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-slate-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Envelope Completion</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.envelopes > 0 ? Math.round(((envelopeStats.COLLECTED + envelopeStats.ARCHIVED) / counts.envelopes) * 100) : 0}%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><DoorOpen className="h-4 w-4 text-emerald-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Room Utilization</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.rooms > 0 ? Math.round((roomUtilization.length / counts.rooms) * 100) : 0}%</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-1"><UserRound className="h-4 w-4 text-amber-500" /><span className="text-xs text-slate-500 uppercase tracking-wider">Faculty Participation</span></div>
                <p className="text-xl font-bold text-slate-900">{counts.faculty > 0 ? Math.round((facultyDuties.length / counts.faculty) * 100) : 0}%</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
