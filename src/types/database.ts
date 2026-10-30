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
