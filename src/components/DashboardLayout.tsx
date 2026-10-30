import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import {
  GraduationCap, LayoutDashboard, Building2, Users, LogOut,
  Menu, X, ChevronDown, Calendar, BookOpen, DoorOpen, FileText,
  QrCode, BarChart3, ClipboardList, UserRound
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/dashboard/tenants', label: 'Tenants', icon: Building2, roles: ['SUPER_ADMIN'] },
      { to: '/dashboard/users', label: 'Users', icon: Users, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
    ],
  },
  {
    title: 'Academic',
    items: [
      { to: '/dashboard/programs', label: 'Programs', icon: BookOpen, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR', 'HOD'] },
      { to: '/dashboard/courses', label: 'Courses', icon: BookOpen, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR', 'HOD'] },
      { to: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER'] },
      { to: '/dashboard/faculty', label: 'Faculty', icon: UserRound, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR', 'HOD'] },
      { to: '/dashboard/cycles', label: 'Exam Cycles', icon: Calendar, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER'] },
    ],
  },
  {
    title: 'Operations (Module 4+)',
    items: [
      { to: '/dashboard/datesheet', label: 'Datesheet', icon: FileText, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR', 'HOD'] },
      { to: '/dashboard/allocation', label: 'Room Allocation', icon: ClipboardList, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER'] },
      { to: '/dashboard/invigilation', label: 'Invigilation', icon: Users, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER'] },
    ],
  },
  {
    title: 'Insights (Module 9+)',
    items: [
      { to: '/dashboard/envelopes', label: 'Envelope Tracker', icon: ClipboardList, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR'] },
      { to: '/dashboard/qr', label: 'QR Publisher', icon: QrCode, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER'] },
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
    ],
  },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!user || !user.profile) return null;

  const role = user.profile.role;
  const tenantName = user.tenant?.name || 'No Tenant';
  const tenantShort = user.tenant?.short_name || user.tenant?.slug || 'N/A';
  const tenantColor = user.tenant?.primary_color || '#1d4ed8';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white">ExamOps</h1>
            <p className="text-xs text-slate-400 truncate">Exam Management</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tenant indicator */}
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-800/50 px-3 py-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: tenantColor }}
            >
              {tenantShort.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{tenantName}</p>
              <p className="text-xs text-slate-400">Your University</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {filteredSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isFuture = section.title.includes('Module');
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isFuture && <span className="text-xs text-slate-500">soon</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + Sign out */}
        <div className="border-t border-slate-800 p-3 shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:text-slate-900"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Page title area (can be dynamic) */}
          <div className="hidden sm:block">
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                {user.profile.full_name.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-900 leading-tight">{user.profile.full_name || user.email}</p>
                <p className="text-xs text-slate-500 leading-tight">{ROLE_LABELS[role]}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-40 py-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user.profile.full_name || user.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    <div className="mt-2">
                      <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                    </div>
                  </div>
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-500">University</p>
                    <p className="text-sm font-medium text-slate-900">{tenantName}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
