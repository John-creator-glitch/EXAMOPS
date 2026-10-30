import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import type { Program, Course, Room, Faculty, ExamCycle } from '@/types/database';
import { PROGRAM_LEVEL_TRACK, PROGRAM_LEVEL_LABELS } from '@/types/database';
import { HeartPulse, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface HealthCheckResult {
  category: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  message: string;
  count?: number;
}

export default function DataHealthCheckPage() {
  const { user } = useAuth();
  const [cycleId, setCycleId] = useState('');
  const [cycles, setCycles] = useState<ExamCycle[]>([]);
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const tenantId = user?.profile?.tenant_id;

  const loadCycles = async () => {
    const { data } = await supabase.from('exam_cycles').select('*').order('created_at', { ascending: false });
    if (data) setCycles(data as ExamCycle[]);
  };

  useState(() => {
    loadCycles();
  });

  const runHealthCheck = async () => {
    if (!tenantId) return;
    setLoading(true);
    setResults([]);
    setHasRun(true);

    const [programsRes, coursesRes, roomsRes, facultyRes, holidaysRes, settingsRes, leaveRes, bridgingRes] = await Promise.all([
      supabase.from('programs').select('*').eq('is_active', true),
      supabase.from('courses').select('*, program:programs(*)').eq('is_active', true),
      supabase.from('rooms').select('*').eq('is_active', true),
      supabase.from('faculty').select('*').eq('is_active', true),
      supabase.from('holidays').select('*').eq('is_active', true),
      supabase.from('settings').select('*'),
      supabase.from('faculty_leave').select('*, faculty:faculty(*)').eq('is_active', true),
      supabase.from('bridging_students').select('*, primary_program:programs!primary_program_id(*), bridging_program:programs!bridging_program_id(*)').eq('is_active', true),
    ]);

    const programs = (programsRes.data as Program[]) || [];
    const courses = (coursesRes.data as Course[]) || [];
    const rooms = (roomsRes.data as Room[]) || [];
    const faculty = (facultyRes.data as Faculty[]) || [];
    const holidays = (holidaysRes.data as any[]) || [];
    const settings = (settingsRes.data as any[]) || [];
    const leaves = (leaveRes.data as any[]) || [];
    const bridging = (bridgingRes.data as any[]) || [];

    const found: HealthCheckResult[] = [];

    // 1. Empty data checks
    if (programs.length === 0) found.push({ category: 'Programs', severity: 'error', message: 'No active programs found. Create programs before scheduling.' });
    if (courses.length === 0) found.push({ category: 'Courses', severity: 'error', message: 'No active courses found. Create courses before scheduling.' });
    if (rooms.length === 0) found.push({ category: 'Rooms', severity: 'error', message: 'No active rooms found. Add rooms before scheduling.' });
    if (faculty.length === 0) found.push({ category: 'Faculty', severity: 'error', message: 'No active faculty members found. Add faculty before invigilation assignment.' });

    // 2. Course strength checks
    const zeroStrength = courses.filter((c) => c.strength === 0);
    if (zeroStrength.length > 0) found.push({ category: 'Course Strength', severity: 'warning', message: `${zeroStrength.length} course(s) have zero student strength. Scheduler may skip them.`, count: zeroStrength.length });

    const backlogCourses = courses.filter((c) => c.paper_type === 'BACKLOG');
    const backlogLowStrength = backlogCourses.filter((c) => c.strength > 0 && c.strength < 5);
    if (backlogLowStrength.length > 0) found.push({ category: 'Backlog Courses', severity: 'info', message: `${backlogLowStrength.length} backlog course(s) have very low strength (< 5). These can share rooms.`, count: backlogLowStrength.length });

    // 3. Program level checks
    const noLevel = programs.filter((p) => !p.program_level);
    if (noLevel.length > 0) found.push({ category: 'Program Level', severity: 'warning', message: `${noLevel.length} program(s) missing program level. Track assignment (UG/GR) will default to UG.`, count: noLevel.length });

    const grPrograms = programs.filter((p) => PROGRAM_LEVEL_TRACK[p.program_level] === 'GR');
    const ugPrograms = programs.filter((p) => PROGRAM_LEVEL_TRACK[p.program_level] === 'UG');
    if (grPrograms.length > 0) found.push({ category: 'Track Distribution', severity: 'info', message: `${ugPrograms.length} UG program(s) (Mon–Fri) and ${grPrograms.length} GR program(s) (Sat–Sun) detected.` });

    // 4. Room capacity checks
    const noExamCapacity = rooms.filter((r) => !r.exam_capacity && r.capacity > 0);
    if (noExamCapacity.length > 0) found.push({ category: 'Room Capacity', severity: 'info', message: `${noExamCapacity.length} room(s) without explicit exam capacity. Scheduler will calculate from chair type settings.`, count: noExamCapacity.length });

    const offlineRooms = rooms.filter((r) => r.status !== 'ACTIVE');
    if (offlineRooms.length > 0) found.push({ category: 'Room Status', severity: 'warning', message: `${offlineRooms.length} room(s) are in maintenance or offline status and won't be used.`, count: offlineRooms.length });

    const totalExamCapacity = rooms.filter((r) => r.status === 'ACTIVE').reduce((sum, r) => sum + (r.exam_capacity || r.capacity), 0);
    const totalStudents = courses.reduce((sum, c) => sum + c.strength, 0);
    if (totalStudents > 0 && totalExamCapacity > 0) {
      const maxPerSlot = totalExamCapacity;
      if (totalStudents > maxPerSlot) {
        found.push({ category: 'Capacity vs Strength', severity: 'error', message: `Total student strength (${totalStudents}) exceeds single-slot room capacity (${maxPerSlot}). Papers will need multiple slots.`, count: Math.ceil(totalStudents / maxPerSlot) });
      } else {
        found.push({ category: 'Capacity vs Strength', severity: 'success', message: `Total student strength (${totalStudents}) fits within single-slot room capacity (${maxPerSlot}).` });
      }
    }

    // 5. Faculty availability checks
    const unavailable = faculty.filter((f) => !f.available);
    if (unavailable.length > 0) found.push({ category: 'Faculty Availability', severity: 'warning', message: `${unavailable.length} faculty member(s) marked as unavailable. They won't be assigned invigilation duties.`, count: unavailable.length });

    const todayStr = new Date().toISOString().split('T')[0];
    const onLeaveNow = leaves.filter((l) => l.start_date <= todayStr && l.end_date >= todayStr);
    if (onLeaveNow.length > 0) found.push({ category: 'Faculty Leave', severity: 'warning', message: `${onLeaveNow.length} faculty member(s) currently on leave. Scheduler will exclude them.`, count: onLeaveNow.length });

    const availableFaculty = faculty.filter((f) => f.available && !onLeaveNow.some((l) => l.faculty_id === f.id));
    if (availableFaculty.length === 0 && faculty.length > 0) {
      found.push({ category: 'Faculty Shortage', severity: 'error', message: 'No faculty available for invigilation. All are either unavailable or on leave.' });
    } else if (availableFaculty.length > 0 && rooms.length > 0) {
      const minInvigSetting = settings.find((s) => s.key === 'MinInvigilatorsPerRoom');
      const minInvig = minInvigSetting ? parseInt(minInvigSetting.value) : 1;
      const required = rooms.filter((r) => r.status === 'ACTIVE').length * minInvig;
      if (availableFaculty.length < required) {
        found.push({ category: 'Faculty Shortage', severity: 'warning', message: `${availableFaculty.length} available faculty for ${required} required invigilator slots (${minInvig}/room × ${rooms.filter((r) => r.status === 'ACTIVE').length} rooms).`, count: required - availableFaculty.length });
      }
    }

    // 6. Duplicate course check
    const courseKeys = courses.map((c) => `${c.code}-${c.semester}`);
    const duplicates = courseKeys.filter((k, i) => courseKeys.indexOf(k) !== i);
    if (duplicates.length > 0) found.push({ category: 'Duplicate Courses', severity: 'error', message: `${duplicates.length} duplicate course code+semester combination(s) detected.`, count: duplicates.length });

    // 7. Bridging student clashes
    if (bridging.length > 0) {
      found.push({ category: 'Bridging Students', severity: 'info', message: `${bridging.length} bridging student(s) registered. Scheduler will check for cross-cohort exam clashes.`, count: bridging.length });
    }

    // 8. Holiday overlap
    if (holidays.length > 0 && cycleId) {
      const cycle = cycles.find((c) => c.id === cycleId);
      if (cycle) {
        const cycleHolidays = holidays.filter((h) => h.holiday_date >= cycle.start_date && h.holiday_date <= cycle.end_date);
        if (cycleHolidays.length > 0) found.push({ category: 'Holidays in Cycle', severity: 'info', message: `${cycleHolidays.length} holiday(s) fall within the selected exam cycle period.`, count: cycleHolidays.length });
      }
    }

    // 9. Settings check
    if (settings.length === 0) {
      found.push({ category: 'Settings', severity: 'warning', message: 'No settings configured. Scheduler will use default values.' });
    } else {
      found.push({ category: 'Settings', severity: 'success', message: `${settings.length} settings configured.` });
    }

    // 10. Overall summary
    const errors = found.filter((r) => r.severity === 'error');
    const warnings = found.filter((r) => r.severity === 'warning');
    if (errors.length === 0 && warnings.length === 0) {
      found.unshift({ category: 'Overall', severity: 'success', message: 'All checks passed. Data is ready for scheduling.' });
    } else {
      found.unshift({ category: 'Overall', severity: errors.length > 0 ? 'error' : 'warning', message: `${errors.length} error(s) and ${warnings.length} warning(s) found. Fix errors before scheduling.` });
    }

    setResults(found);
    setLoading(false);
  };

  const severityIcon = (severity: HealthCheckResult['severity']) => {
    switch (severity) {
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'info': return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
  };

  const severityBadge = (severity: HealthCheckResult['severity']) => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const severityLabel = (severity: HealthCheckResult['severity']) => {
    switch (severity) {
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      case 'info': return 'Info';
      case 'success': return 'OK';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Health Check</h1>
        <p className="text-sm text-slate-500 mt-1">Validate your data before scheduling. Checks programs, courses, rooms, faculty, and settings for issues.</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <Select label="Exam Cycle (optional)" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">All cycles (general check)</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Button onClick={runHealthCheck} loading={loading} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run Health Check
          </Button>
        </div>
      </Card>

      {hasRun && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={i} className={`p-4 ${r.severity === 'error' ? 'border-red-200' : r.severity === 'warning' ? 'border-amber-200' : r.severity === 'success' ? 'border-emerald-200' : 'border-blue-200'}`}>
              <div className="flex items-start gap-3">
                {severityIcon(r.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{r.category}</span>
                    <Badge className={severityBadge(r.severity)}>{severityLabel(r.severity)}</Badge>
                    {r.count !== undefined && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{r.count}</Badge>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{r.message}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hasRun && results.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <HeartPulse className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500">No issues detected. Click "Run Health Check" to validate.</p>
        </Card>
      )}

      {!hasRun && (
        <Card className="p-8 text-center">
          <HeartPulse className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500">Click "Run Health Check" to validate your data before scheduling exams.</p>
        </Card>
      )}
    </div>
  );
}
