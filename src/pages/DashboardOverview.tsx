import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge } from '@/components/ui/Card';
import { ROLE_LABELS, ROLE_COLORS, STATUS_LABELS, STATUS_COLORS, PLAN_LABELS, PLAN_COLORS } from '@/types/database';
import {
  GraduationCap, Users, Calendar, BookOpen, DoorOpen, FileText,
  TrendingUp, Clock, CheckCircle2, AlertCircle, UserRound, Layers
} from 'lucide-react';

export default function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({
    tenants: 0,
    users: 0,
    programs: 0,
    courses: 0,
    rooms: 0,
    faculty: 0,
    cycles: 0,
    datesheets: 0,
  });

  if (!user || !user.profile) return null;

  const role = user.profile.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const firstName = user.profile.full_name.split(' ')[0] || user.email;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const loadCounts = useCallback(async () => {
    const [tenants, users, programs, courses, rooms, faculty, cycles, datesheets] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('programs').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('faculty').select('*', { count: 'exact', head: true }),
      supabase.from('exam_cycles').select('*', { count: 'exact', head: true }),
      supabase.from('datesheets').select('*', { count: 'exact', head: true }),
    ]);

    setCounts({
      tenants: tenants.count || 0,
      users: users.count || 0,
      programs: programs.count || 0,
      courses: courses.count || 0,
      rooms: rooms.count || 0,
      faculty: faculty.count || 0,
      cycles: cycles.count || 0,
      datesheets: datesheets.count || 0,
    });
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const stats = isSuperAdmin
    ? [
        { label: 'Total Tenants', value: counts.tenants, icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
        { label: 'Active Users', value: counts.users, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Exam Cycles', value: counts.cycles, icon: Calendar, color: 'text-amber-600 bg-amber-50' },
        { label: 'System Status', value: 'Online', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
      ]
    : [
        { label: 'Programs', value: counts.programs, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
        { label: 'Courses', value: counts.courses, icon: Layers, color: 'text-cyan-600 bg-cyan-50' },
        { label: 'Rooms', value: counts.rooms, icon: DoorOpen, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Faculty', value: counts.faculty, icon: UserRound, color: 'text-amber-600 bg-amber-50' },
        { label: 'Exam Cycles', value: counts.cycles, icon: Calendar, color: 'text-rose-600 bg-rose-50' },
        { label: 'Datesheets', value: counts.datesheets, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
      ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{greeting}, {firstName}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Here's what's happening in your examination management system.
        </p>
      </div>

      {/* User & tenant info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Your Account</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{user.profile.full_name || user.email}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (user.tenant?.primary_color || '#1d4ed8') + '20' }}>
              <GraduationCap className="h-5 w-5" style={{ color: user.tenant?.primary_color || '#1d4ed8' }} />
            </div>
            {user.tenant && <Badge className={STATUS_COLORS[user.tenant.status]}>{STATUS_LABELS[user.tenant.status]}</Badge>}
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">University</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{user.tenant?.name || 'Not assigned'}</p>
          {user.tenant && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-500">{user.tenant.short_name}</p>
              <Badge className={PLAN_COLORS[user.tenant.plan]}>{PLAN_LABELS[user.tenant.plan]}</Badge>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Account Status</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {user.profile.is_active ? 'Active' : 'Inactive'}
          </p>
          <p className="text-sm text-slate-500">
            Member since {new Date(user.profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </Card>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Overview</h2>
        <div className={`grid ${isSuperAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'} gap-4`}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Module progress */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Module Progress</h2>
        <Card className="p-6">
          <div className="space-y-4">
            {[
              { name: 'Module 1: Foundation (Auth, Tenants, Users)', status: 'active' },
              { name: 'Module 2: Academic Master Data (Programs, Courses, Rooms, Faculty)', status: 'active' },
              { name: 'Module 3: Exam Cycles & Time Slots', status: 'active' },
              { name: 'Module 4: Datesheet Engine', status: 'active' },
              { name: 'Module 5: Room Allocation Engine', status: 'pending' },
              { name: 'Module 6: Invigilation Duty Engine', status: 'pending' },
              { name: 'Modules 7-11: Reports, Tracking, QR, CRM, Analytics', status: 'pending' },
            ].map((module) => {
              const Icon = module.status === 'active' ? CheckCircle2 : AlertCircle;
              return (
                <div key={module.name} className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${module.status === 'active' ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span className={`text-sm flex-1 ${module.status === 'active' ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                    {module.name}
                  </span>
                  {module.status === 'active' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 border-slate-200">Upcoming</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isSuperAdmin ? (
            <>
              <QuickActionCard icon={GraduationCap} title="Manage Tenants" description="Add and configure universities" color="text-blue-600 bg-blue-50" onClick={() => navigate('/dashboard/tenants')} />
              <QuickActionCard icon={Users} title="Manage Users" description="View and assign user roles" color="text-emerald-600 bg-emerald-50" onClick={() => navigate('/dashboard/users')} />
              <QuickActionCard icon={Calendar} title="Exam Cycles" description="Create and manage exam schedules" color="text-amber-600 bg-amber-50" onClick={() => navigate('/dashboard/cycles')} />
            </>
          ) : (
            <>
              <QuickActionCard icon={BookOpen} title="Academic Data" description="Manage programs, courses, and faculty" color="text-blue-600 bg-blue-50" onClick={() => navigate('/dashboard/programs')} />
              <QuickActionCard icon={Calendar} title="Exam Cycles" description="Create and manage exam schedules" color="text-amber-600 bg-amber-50" onClick={() => navigate('/dashboard/cycles')} />
              <QuickActionCard icon={FileText} title="Datesheets" description="Build and publish exam schedules" color="text-indigo-600 bg-indigo-50" onClick={() => navigate('/dashboard/datesheet')} />
              <QuickActionCard icon={DoorOpen} title="Rooms" description="Manage exam halls and classrooms" color="text-emerald-600 bg-emerald-50" onClick={() => navigate('/dashboard/rooms')} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, description, color, onClick }: { icon: typeof BookOpen; title: string; description: string; color: string; onClick?: () => void }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </Card>
  );
}
