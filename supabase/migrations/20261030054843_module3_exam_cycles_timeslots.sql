/*
# Module 3: Exam Cycles & Time Slots

## Overview
Creates exam cycles (e.g. "Fall 2025 Midterm") and time slots (e.g. "Morning 9:00-11:00") for scheduling exams.

## New Tables

### exam_cycles
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- name (text) — e.g. "Fall 2025 Midterm"
- cycle_type (enum: MIDTERM, FINAL, SUPPLEMENTARY, MAKEUP)
- start_date (date)
- end_date (date)
- status (enum: DRAFT, PUBLISHED, COMPLETED, ARCHIVED)
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

### time_slots
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- cycle_id (uuid, FK to exam_cycles, ON DELETE CASCADE)
- name (text) — e.g. "Morning", "Afternoon"
- start_time (time) — e.g. "09:00"
- end_time (time) — e.g. "11:00"
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled on all tables, tenant-scoped policies
- SUPER_ADMIN bypass via is_super_admin()
- Grants to authenticated role only
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE cycle_type AS ENUM ('MIDTERM', 'FINAL', 'SUPPLEMENTARY', 'MAKEUP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cycle_status AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXAM_CYCLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  cycle_type cycle_type NOT NULL DEFAULT 'MIDTERM',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status cycle_status NOT NULL DEFAULT 'DRAFT',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exam_cycles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_cycles TO authenticated;

DROP POLICY IF EXISTS "exam_cycles_select" ON exam_cycles;
CREATE POLICY "exam_cycles_select" ON exam_cycles FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "exam_cycles_insert" ON exam_cycles;
CREATE POLICY "exam_cycles_insert" ON exam_cycles FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "exam_cycles_update" ON exam_cycles;
CREATE POLICY "exam_cycles_update" ON exam_cycles FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "exam_cycles_delete" ON exam_cycles;
CREATE POLICY "exam_cycles_delete" ON exam_cycles FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- TIME_SLOTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON time_slots TO authenticated;

DROP POLICY IF EXISTS "time_slots_select" ON time_slots;
CREATE POLICY "time_slots_select" ON time_slots FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "time_slots_insert" ON time_slots;
CREATE POLICY "time_slots_insert" ON time_slots FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "time_slots_update" ON time_slots;
CREATE POLICY "time_slots_update" ON time_slots FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "time_slots_delete" ON time_slots;
CREATE POLICY "time_slots_delete" ON time_slots FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS exam_cycles_updated_at ON exam_cycles;
CREATE TRIGGER exam_cycles_updated_at
  BEFORE UPDATE ON exam_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS time_slots_updated_at ON time_slots;
CREATE TRIGGER time_slots_updated_at
  BEFORE UPDATE ON time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exam_cycles_tenant_id ON exam_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_tenant_id ON time_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_cycle_id ON time_slots(cycle_id);
