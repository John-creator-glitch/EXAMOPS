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
  DEDICATED: 'bg-slate-100 text-slate-800 border-slate-200',
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
export type ProgramLevel = 'ASSOCIATE_DEGREE' | 'BACHELOR' | 'PROFESSIONAL_DOCTORATE' | 'MS' | 'MPHIL' | 'PHD';
export type PaperType = 'REGULAR' | 'BACKLOG';
export type ChairType = 'FIXED' | 'MOVABLE';
export type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';

export interface Program {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  duration_years: number;
  total_semesters: number;
  department: string | null;
  program_level: ProgramLevel;
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
  strength: number;
  paper_type: PaperType;
  shared_paper_group: string | null;
  faculty_name: string | null;
  faculty_emp_code: string | null;
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
  chair_type: ChairType;
  exam_capacity: number | null;
  status: RoomStatus;
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
  max_duties_per_cycle: number | null;
  available: boolean;
  off_days: string[];
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

export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = {
  ASSOCIATE_DEGREE: 'Associate Degree',
  BACHELOR: 'Bachelor',
  PROFESSIONAL_DOCTORATE: 'Professional Doctorate',
  MS: 'MS',
  MPHIL: 'MPhil',
  PHD: 'PhD',
};

export const PROGRAM_LEVEL_COLORS: Record<ProgramLevel, string> = {
  ASSOCIATE_DEGREE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  BACHELOR: 'bg-blue-100 text-blue-800 border-blue-200',
  PROFESSIONAL_DOCTORATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MS: 'bg-amber-100 text-amber-800 border-amber-200',
  MPHIL: 'bg-rose-100 text-rose-800 border-rose-200',
  PHD: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const PROGRAM_LEVEL_TRACK: Record<ProgramLevel, 'UG' | 'GR'> = {
  ASSOCIATE_DEGREE: 'UG',
  BACHELOR: 'UG',
  PROFESSIONAL_DOCTORATE: 'UG',
  MS: 'GR',
  MPHIL: 'GR',
  PHD: 'GR',
};

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  REGULAR: 'Regular',
  BACKLOG: 'Backlog',
};

export const PAPER_TYPE_COLORS: Record<PaperType, string> = {
  REGULAR: 'bg-blue-100 text-blue-800 border-blue-200',
  BACKLOG: 'bg-amber-100 text-amber-800 border-amber-200',
};

export const CHAIR_TYPE_LABELS: Record<ChairType, string> = {
  FIXED: 'Fixed Chairs',
  MOVABLE: 'Movable Chairs',
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  ACTIVE: 'Active',
  MAINTENANCE: 'Maintenance',
  OFFLINE: 'Offline',
};

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MAINTENANCE: 'bg-amber-100 text-amber-800 border-amber-200',
  OFFLINE: 'bg-red-100 text-red-800 border-red-200',
};

// ============================================================
// Module 3: Exam Cycles & Time Slots
// ============================================================

export type CycleType = 'MIDTERM' | 'FINAL' | 'SUPPLEMENTARY' | 'MAKEUP';
export type CycleStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'ARCHIVED';
export type CycleScope = 'UG' | 'GR' | 'BOTH';

export interface ExamCycle {
  id: string;
  tenant_id: string;
  name: string;
  cycle_type: CycleType;
  start_date: string;
  end_date: string;
  ms_start_date: string | null;
  ms_end_date: string | null;
  scope: CycleScope;
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

export const CYCLE_SCOPE_LABELS: Record<CycleScope, string> = {
  UG: 'Undergraduate (Mon–Fri)',
  GR: 'Graduate (Sat–Sun)',
  BOTH: 'Both Tracks',
};

export const CYCLE_SCOPE_COLORS: Record<CycleScope, string> = {
  UG: 'bg-blue-100 text-blue-800 border-blue-200',
  GR: 'bg-amber-100 text-amber-800 border-amber-200',
  BOTH: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

// ============================================================
// Module 4: Datesheet Engine
// ============================================================

export type DatesheetStatus = 'DRAFT' | 'PUBLISHED';

export interface Datesheet {
  id: string;
  tenant_id: string;
  cycle_id: string;
  name: string;
  status: DatesheetStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cycle?: ExamCycle | null;
  item_count?: number;
}

export interface DatesheetItem {
  id: string;
  tenant_id: string;
  datesheet_id: string;
  course_id: string;
  exam_date: string;
  time_slot_id: string | null;
  room_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  course?: Course | null;
  time_slot?: TimeSlot | null;
  room?: Room | null;
}

export const DATESHEET_STATUS_LABELS: Record<DatesheetStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
};

export const DATESHEET_STATUS_COLORS: Record<DatesheetStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

// ============================================================
// Module 6: Invigilation Duty Engine
// ============================================================

export type InvigilationRole = 'CHIEF_INVIGILATOR' | 'INVIGILATOR' | 'RELIEF';

export interface InvigilationDuty {
  id: string;
  tenant_id: string;
  datesheet_item_id: string;
  faculty_id: string;
  role: InvigilationRole;
  created_at: string;
  updated_at: string;
  faculty?: Faculty | null;
}

export const INVIGILATION_ROLE_LABELS: Record<InvigilationRole, string> = {
  CHIEF_INVIGILATOR: 'Chief Invigilator',
  INVIGILATOR: 'Invigilator',
  RELIEF: 'Relief',
};

export const INVIGILATION_ROLE_COLORS: Record<InvigilationRole, string> = {
  CHIEF_INVIGILATOR: 'bg-blue-100 text-blue-800 border-blue-200',
  INVIGILATOR: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  RELIEF: 'bg-amber-100 text-amber-800 border-amber-200',
};

// ============================================================
// Module 8: Envelope Tracker
// ============================================================

export type EnvelopeStatus = 'PREPARED' | 'DISTRIBUTED' | 'COLLECTED' | 'ARCHIVED';

export interface Envelope {
  id: string;
  tenant_id: string;
  datesheet_item_id: string;
  envelope_number: string;
  status: EnvelopeStatus;
  sealed_at: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  datesheet_item?: DatesheetItem | null;
}

export const ENVELOPE_STATUS_LABELS: Record<EnvelopeStatus, string> = {
  PREPARED: 'Prepared',
  DISTRIBUTED: 'Distributed',
  COLLECTED: 'Collected',
  ARCHIVED: 'Archived',
};

export const ENVELOPE_STATUS_COLORS: Record<EnvelopeStatus, string> = {
  PREPARED: 'bg-slate-100 text-slate-700 border-slate-200',
  DISTRIBUTED: 'bg-blue-100 text-blue-800 border-blue-200',
  COLLECTED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ARCHIVED: 'bg-gray-200 text-gray-600 border-gray-300',
};

// ============================================================
// Settings, Holidays, Faculty Leave, Bridging Students
// ============================================================

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface Setting {
  id: string;
  tenant_id: string;
  key: string;
  value: string;
  value_type: SettingValueType;
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  tenant_id: string;
  name: string;
  holiday_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacultyLeave {
  id: string;
  tenant_id: string;
  faculty_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  faculty?: Faculty | null;
}

export interface BridgingStudent {
  id: string;
  tenant_id: string;
  student_name: string;
  roll_number: string;
  primary_program_id: string;
  primary_semester: number;
  bridging_program_id: string;
  bridging_semester: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  primary_program?: Program | null;
  bridging_program?: Program | null;
}

export const SETTING_CATEGORIES: Record<string, string> = {
  ROOM: 'Room & Seating',
  INVIGILATION: 'Invigilation',
  SCHEDULING: 'Scheduling',
  INSTITUTE: 'Institute',
  GENERAL: 'General',
};
