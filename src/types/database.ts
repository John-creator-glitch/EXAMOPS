export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type TenantPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'DEDICATED';
export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EXAM_OFFICER' | 'REGISTRAR' | 'HOD' | 'FACULTY' | 'VIEWER';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  status: TenantStatus;
  plan: TenantPlan;
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
  tenant: Tenant | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Tenant Admin',
  EXAM_OFFICER: 'Exam Officer',
  REGISTRAR: 'Registrar',
  HOD: 'Head of Department',
  FACULTY: 'Faculty',
  VIEWER: 'Viewer',
};

export const STATUS_LABELS: Record<TenantStatus, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
  DEDICATED: 'Dedicated',
};

export const STATUS_COLORS: Record<TenantStatus, string> = {
  TRIAL: 'bg-amber-100 text-amber-800 border-amber-200',
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SUSPENDED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const PLAN_COLORS: Record<TenantPlan, string> = {
  STARTER: 'bg-blue-100 text-blue-800 border-blue-200',
  PROFESSIONAL: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  ENTERPRISE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DEDICATED: 'bg-purple-100 text-purple-800 border-purple-200',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  TENANT_ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  EXAM_OFFICER: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  REGISTRAR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  HOD: 'bg-amber-100 text-amber-800 border-amber-200',
  FACULTY: 'bg-gray-100 text-gray-800 border-gray-200',
  VIEWER: 'bg-slate-100 text-slate-800 border-slate-200',
};

// ============================================================
// Module 2: Academic Master Data
// ============================================================

export type RoomType = 'CLASSROOM' | 'HALL' | 'LAB' | 'OPEN_SPACE';

export interface Program {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  duration_years: number;
  total_semesters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  tenant_id: string;
  program_id: string;
  code: string;
  title: string;
  credit_hours: number;
  semester: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  program?: Program | null;
}

export interface Room {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number;
  room_type: RoomType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Faculty {
  id: string;
  tenant_id: string;
  employee_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  max_duties_per_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  CLASSROOM: 'Classroom',
  HALL: 'Hall',
  LAB: 'Lab',
  OPEN_SPACE: 'Open Space',
};

export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  CLASSROOM: 'bg-blue-100 text-blue-800 border-blue-200',
  HALL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LAB: 'bg-amber-100 text-amber-800 border-amber-200',
  OPEN_SPACE: 'bg-slate-100 text-slate-800 border-slate-200',
};

// ============================================================
// Module 3: Exam Cycles & Time Slots
// ============================================================

export type CycleType = 'MIDTERM' | 'FINAL' | 'SUPPLEMENTARY' | 'MAKEUP';
export type CycleStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'ARCHIVED';

export interface ExamCycle {
  id: string;
  tenant_id: string;
  name: string;
  cycle_type: CycleType;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: string;
  tenant_id: string;
  cycle_id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cycle?: ExamCycle | null;
}

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  MIDTERM: 'Midterm',
  FINAL: 'Final',
  SUPPLEMENTARY: 'Supplementary',
  MAKEUP: 'Makeup',
};

export const CYCLE_TYPE_COLORS: Record<CycleType, string> = {
  MIDTERM: 'bg-blue-100 text-blue-800 border-blue-200',
  FINAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SUPPLEMENTARY: 'bg-amber-100 text-amber-800 border-amber-200',
  MAKEUP: 'bg-rose-100 text-rose-800 border-rose-200',
};

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const CYCLE_STATUS_COLORS: Record<CycleStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  PUBLISHED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ARCHIVED: 'bg-gray-200 text-gray-600 border-gray-300',
};
