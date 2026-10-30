/*
# Module 2: Academic Master Data — Programs, Courses, Rooms, Faculty

## Overview
Creates the academic foundation tables for the Examination Management System.
All tables are tenant-scoped (each university sees only its own data) with RLS enforcement.

## New Tables

### programs
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- code (text) — e.g. "BSCS", "BBA"
- name (text) — e.g. "BS Computer Science"
- duration_years (int) — program length
- total_semesters (int) — derived from duration
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

### courses
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- program_id (uuid, FK to programs)
- code (text) — e.g. "CS101"
- title (text) — e.g. "Introduction to Programming"
- credit_hours (int)
- semester (int) — which semester this course belongs to
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

### rooms
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- code (text) — e.g. "R-101", "HALL-A"
- name (text) — e.g. "Examination Hall A"
- building (text, nullable)
- floor (text, nullable)
- capacity (int) — seating capacity
- room_type (enum: CLASSROOM, HALL, LAB, OPEN_SPACE)
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

### faculty
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- employee_id (text) — university employee ID
- full_name (text)
- email (text, nullable)
- phone (text, nullable)
- department (text, nullable)
- designation (text, nullable) — e.g. "Professor", "Lecturer"
- max_duties_per_day (int, default 2) — for invigilation scheduling
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled on all tables
- All tables are tenant-scoped: users can only CRUD rows in their own tenant
- SUPER_ADMIN can access all tenants' data (via is_super_admin check)
- Grants to authenticated role only

## Important Notes
1. All tables have tenant_id with DEFAULT auth.uid()-based lookup is NOT used here — tenant_id is passed explicitly from the frontend using the user's profile tenant_id
2. RLS policies check that the row's tenant_id matches the current user's tenant_id (or user is SUPER_ADMIN)
3. For INSERT, the WITH CHECK ensures the new row's tenant_id matches the user's tenant
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE room_type AS ENUM ('CLASSROOM', 'HALL', 'LAB', 'OPEN_SPACE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROGRAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  duration_years int NOT NULL DEFAULT 4,
  total_semesters int NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON programs TO authenticated;

DROP POLICY IF EXISTS "programs_select" ON programs;
CREATE POLICY "programs_select" ON programs FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "programs_insert" ON programs;
CREATE POLICY "programs_insert" ON programs FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "programs_update" ON programs;
CREATE POLICY "programs_update" ON programs FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "programs_delete" ON programs;
CREATE POLICY "programs_delete" ON programs FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- Unique constraint: code per tenant
DO $$ BEGIN
  ALTER TABLE programs ADD CONSTRAINT programs_tenant_code_unique UNIQUE (tenant_id, code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- COURSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  credit_hours int NOT NULL DEFAULT 3,
  semester int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON courses TO authenticated;

DROP POLICY IF EXISTS "courses_select" ON courses;
CREATE POLICY "courses_select" ON courses FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "courses_insert" ON courses;
CREATE POLICY "courses_insert" ON courses FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "courses_update" ON courses;
CREATE POLICY "courses_update" ON courses FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "courses_delete" ON courses;
CREATE POLICY "courses_delete" ON courses FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DO $$ BEGIN
  ALTER TABLE courses ADD CONSTRAINT courses_tenant_code_unique UNIQUE (tenant_id, code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  building text,
  floor text,
  capacity int NOT NULL DEFAULT 50,
  room_type room_type NOT NULL DEFAULT 'CLASSROOM',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON rooms TO authenticated;

DROP POLICY IF EXISTS "rooms_select" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "rooms_insert" ON rooms;
CREATE POLICY "rooms_insert" ON rooms FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DO $$ BEGIN
  ALTER TABLE rooms ADD CONSTRAINT rooms_tenant_code_unique UNIQUE (tenant_id, code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FACULTY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  department text,
  designation text,
  max_duties_per_day int NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON faculty TO authenticated;

DROP POLICY IF EXISTS "faculty_select" ON faculty;
CREATE POLICY "faculty_select" ON faculty FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "faculty_insert" ON faculty;
CREATE POLICY "faculty_insert" ON faculty FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "faculty_update" ON faculty;
CREATE POLICY "faculty_update" ON faculty FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "faculty_delete" ON faculty;
CREATE POLICY "faculty_delete" ON faculty FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DO $$ BEGIN
  ALTER TABLE faculty ADD CONSTRAINT faculty_tenant_employee_unique UNIQUE (tenant_id, employee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS programs_updated_at ON programs;
CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS courses_updated_at ON courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS faculty_updated_at ON faculty;
CREATE TRIGGER faculty_updated_at
  BEFORE UPDATE ON faculty
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_programs_tenant_id ON programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_program_id ON courses(program_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faculty_tenant_id ON faculty(tenant_id);
