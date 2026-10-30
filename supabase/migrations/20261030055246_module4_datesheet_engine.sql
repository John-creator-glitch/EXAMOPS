/*
# Module 4: Datesheet Engine

## Overview
Creates datesheets (exam schedules) that link exam cycles to individual exam entries.
Each datesheet item assigns a course to a specific date, time slot, and room.

## New Tables

### datesheets
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- cycle_id (uuid, FK to exam_cycles)
- name (text) — e.g. "Fall 2025 Final Exam Schedule"
- status (enum: DRAFT, PUBLISHED)
- published_at (timestamptz, nullable)
- created_at, updated_at (timestamptz)

### datesheet_items
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- datesheet_id (uuid, FK to datesheets, ON DELETE CASCADE)
- course_id (uuid, FK to courses)
- exam_date (date) — the date of this exam
- time_slot_id (uuid, FK to time_slots, nullable) — which time slot
- room_id (uuid, FK to rooms, nullable) — which room (can be assigned later in Module 5)
- notes (text, nullable)
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
  CREATE TYPE datesheet_status AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- DATESHEETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS datesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
  name text NOT NULL,
  status datesheet_status NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE datesheets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON datesheets TO authenticated;

DROP POLICY IF EXISTS "datesheets_select" ON datesheets;
CREATE POLICY "datesheets_select" ON datesheets FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheets_insert" ON datesheets;
CREATE POLICY "datesheets_insert" ON datesheets FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheets_update" ON datesheets;
CREATE POLICY "datesheets_update" ON datesheets FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheets_delete" ON datesheets;
CREATE POLICY "datesheets_delete" ON datesheets FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- DATESHEET_ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS datesheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  datesheet_id uuid NOT NULL REFERENCES datesheets(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  time_slot_id uuid REFERENCES time_slots(id) ON DELETE SET NULL,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE datesheet_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON datesheet_items TO authenticated;

DROP POLICY IF EXISTS "datesheet_items_select" ON datesheet_items;
CREATE POLICY "datesheet_items_select" ON datesheet_items FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheet_items_insert" ON datesheet_items;
CREATE POLICY "datesheet_items_insert" ON datesheet_items FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheet_items_update" ON datesheet_items;
CREATE POLICY "datesheet_items_update" ON datesheet_items FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "datesheet_items_delete" ON datesheet_items;
CREATE POLICY "datesheet_items_delete" ON datesheet_items FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS datesheets_updated_at ON datesheets;
CREATE TRIGGER datesheets_updated_at
  BEFORE UPDATE ON datesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS datesheet_items_updated_at ON datesheet_items;
CREATE TRIGGER datesheet_items_updated_at
  BEFORE UPDATE ON datesheet_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_datesheets_tenant_id ON datesheets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_datesheets_cycle_id ON datesheets(cycle_id);
CREATE INDEX IF NOT EXISTS idx_datesheet_items_tenant_id ON datesheet_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_datesheet_items_datesheet_id ON datesheet_items(datesheet_id);
CREATE INDEX IF NOT EXISTS idx_datesheet_items_exam_date ON datesheet_items(exam_date);
