/*
# Module 6: Invigilation Duty Engine

## Overview
Assigns faculty members to invigilate exams (datesheet_items).
Tracks who is supervising which exam, in which room, on which date and time slot.

## New Tables

### invigilation_duties
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- datesheet_item_id (uuid, FK to datesheet_items, ON DELETE CASCADE)
- faculty_id (uuid, FK to faculty, ON DELETE CASCADE)
- role (enum: CHIEF_INVIGILATOR, INVIGILATOR, RELIEF)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled, tenant-scoped policies
- SUPER_ADMIN bypass via is_super_admin()
- Grants to authenticated role only
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE invigilation_role AS ENUM ('CHIEF_INVIGILATOR', 'INVIGILATOR', 'RELIEF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- INVIGILATION_DUTIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS invigilation_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  datesheet_item_id uuid NOT NULL REFERENCES datesheet_items(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  role invigilation_role NOT NULL DEFAULT 'INVIGILATOR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invigilation_duties ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON invigilation_duties TO authenticated;

DROP POLICY IF EXISTS "invigilation_duties_select" ON invigilation_duties;
CREATE POLICY "invigilation_duties_select" ON invigilation_duties FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "invigilation_duties_insert" ON invigilation_duties;
CREATE POLICY "invigilation_duties_insert" ON invigilation_duties FOR INSERT
  TO authenticated WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "invigilation_duties_update" ON invigilation_duties;
CREATE POLICY "invigilation_duties_update" ON invigilation_duties FOR UPDATE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "invigilation_duties_delete" ON invigilation_duties;
CREATE POLICY "invigilation_duties_delete" ON invigilation_duties FOR DELETE
  TO authenticated USING (
    public.is_super_admin() OR tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS invigilation_duties_updated_at ON invigilation_duties;
CREATE TRIGGER invigilation_duties_updated_at
  BEFORE UPDATE ON invigilation_duties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invigilation_duties_tenant_id ON invigilation_duties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_duties_datesheet_item_id ON invigilation_duties(datesheet_item_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_duties_faculty_id ON invigilation_duties(faculty_id);
