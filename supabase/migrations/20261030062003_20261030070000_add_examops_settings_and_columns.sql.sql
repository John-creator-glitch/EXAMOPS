/*
# Add GAS Settings, Holidays, Faculty Leave, Bridging Students + Extend Existing Tables

## Summary
This migration adds the missing columns and tables needed to match the Google Apps Script
"Examination Management System" logic by Nadab Liaqat. It extends programs, courses, rooms,
faculty, and exam_cycles with the fields the GAS settings engine relies on, and creates four
new tables: settings, holidays, faculty_leave, and bridging_students.

## 1. New Tables
- `settings` — key-value configuration store (MaxPapersPerRoom, SpareSeatsPerRoom, etc.)
- `holidays` — dates the scheduler must skip (name, date, is_active).
- `faculty_leave` — from-date/to-date leave ranges for faculty.
- `bridging_students` — students sitting exams across multiple cohorts.

## 2. Modified Tables (new columns, all nullable or with defaults — no data loss)
- `programs`: department (text), program_level (text with CHECK constraint)
- `courses`: strength (int default 0), paper_type (text default 'REGULAR'), shared_paper_group,
  faculty_name, faculty_emp_code
- `rooms`: chair_type (text default 'FIXED'), exam_capacity (int), status (text default 'ACTIVE')
- `faculty`: available (boolean default true), off_days (text[]), max_duties_per_cycle (int)
- `exam_cycles`: ms_start_date (date), ms_end_date (date), scope (text default 'UG')

## 3. Security
- RLS enabled on all four new tables.
- Grants: SELECT, INSERT, UPDATE, DELETE to authenticated.
- Policies: tenant-scoped via is_super_admin() OR tenant_id = current_tenant_id().

## 4. Notes
- All column additions use DO $$ ... IF NOT EXISTS ... END $$ for idempotency.
- No data is dropped or altered.
*/

-- ============================================================
-- Extend existing tables with new columns
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'department') THEN
    ALTER TABLE programs ADD COLUMN department text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'program_level') THEN
    ALTER TABLE programs ADD COLUMN program_level text DEFAULT 'BACHELOR'
      CHECK (program_level IN ('ASSOCIATE_DEGREE', 'BACHELOR', 'PROFESSIONAL_DOCTORATE', 'MS', 'MPHIL', 'PHD'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'strength') THEN
    ALTER TABLE courses ADD COLUMN strength int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'paper_type') THEN
    ALTER TABLE courses ADD COLUMN paper_type text NOT NULL DEFAULT 'REGULAR'
      CHECK (paper_type IN ('REGULAR', 'BACKLOG'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'shared_paper_group') THEN
    ALTER TABLE courses ADD COLUMN shared_paper_group text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'faculty_name') THEN
    ALTER TABLE courses ADD COLUMN faculty_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'faculty_emp_code') THEN
    ALTER TABLE courses ADD COLUMN faculty_emp_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'chair_type') THEN
    ALTER TABLE rooms ADD COLUMN chair_type text NOT NULL DEFAULT 'FIXED'
      CHECK (chair_type IN ('FIXED', 'MOVABLE'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'exam_capacity') THEN
    ALTER TABLE rooms ADD COLUMN exam_capacity int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'status') THEN
    ALTER TABLE rooms ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
      CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'faculty' AND column_name = 'available') THEN
    ALTER TABLE faculty ADD COLUMN available boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'faculty' AND column_name = 'off_days') THEN
    ALTER TABLE faculty ADD COLUMN off_days text[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'faculty' AND column_name = 'max_duties_per_cycle') THEN
    ALTER TABLE faculty ADD COLUMN max_duties_per_cycle int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_cycles' AND column_name = 'ms_start_date') THEN
    ALTER TABLE exam_cycles ADD COLUMN ms_start_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_cycles' AND column_name = 'ms_end_date') THEN
    ALTER TABLE exam_cycles ADD COLUMN ms_end_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_cycles' AND column_name = 'scope') THEN
    ALTER TABLE exam_cycles ADD COLUMN scope text NOT NULL DEFAULT 'UG'
      CHECK (scope IN ('UG', 'GR', 'BOTH'));
  END IF;
END $$;

-- ============================================================
-- New table: settings (key-value configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  value_type text NOT NULL DEFAULT 'STRING' CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
  category text NOT NULL DEFAULT 'GENERAL',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO authenticated;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "insert_settings" ON settings;
CREATE POLICY "insert_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "delete_settings" ON settings;
CREATE POLICY "delete_settings" ON settings FOR DELETE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);

-- ============================================================
-- New table: holidays
-- ============================================================

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  holiday_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON holidays TO authenticated;

DROP POLICY IF EXISTS "select_holidays" ON holidays;
CREATE POLICY "select_holidays" ON holidays FOR SELECT
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "insert_holidays" ON holidays;
CREATE POLICY "insert_holidays" ON holidays FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "update_holidays" ON holidays;
CREATE POLICY "update_holidays" ON holidays FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "delete_holidays" ON holidays;
CREATE POLICY "delete_holidays" ON holidays FOR DELETE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_holidays_tenant_date ON holidays(tenant_id, holiday_date);

-- ============================================================
-- New table: faculty_leave
-- ============================================================

CREATE TABLE IF NOT EXISTS faculty_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE faculty_leave ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON faculty_leave TO authenticated;

DROP POLICY IF EXISTS "select_faculty_leave" ON faculty_leave;
CREATE POLICY "select_faculty_leave" ON faculty_leave FOR SELECT
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "insert_faculty_leave" ON faculty_leave;
CREATE POLICY "insert_faculty_leave" ON faculty_leave FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "update_faculty_leave" ON faculty_leave;
CREATE POLICY "update_faculty_leave" ON faculty_leave FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "delete_faculty_leave" ON faculty_leave;
CREATE POLICY "delete_faculty_leave" ON faculty_leave FOR DELETE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_faculty_leave_faculty_dates ON faculty_leave(faculty_id, start_date, end_date);

-- ============================================================
-- New table: bridging_students
-- ============================================================

CREATE TABLE IF NOT EXISTS bridging_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  roll_number text NOT NULL,
  primary_program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  primary_semester int NOT NULL,
  bridging_program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  bridging_semester int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bridging_students ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON bridging_students TO authenticated;

DROP POLICY IF EXISTS "select_bridging_students" ON bridging_students;
CREATE POLICY "select_bridging_students" ON bridging_students FOR SELECT
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "insert_bridging_students" ON bridging_students;
CREATE POLICY "insert_bridging_students" ON bridging_students FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "update_bridging_students" ON bridging_students;
CREATE POLICY "update_bridging_students" ON bridging_students FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "delete_bridging_students" ON bridging_students;
CREATE POLICY "delete_bridging_students" ON bridging_students FOR DELETE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_bridging_tenant ON bridging_students(tenant_id);

-- ============================================================
-- Seed default settings for existing tenants
-- ============================================================

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'MaxPapersPerRoom', '1', 'NUMBER', 'ROOM', 'Maximum papers per room per slot'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'MaxPapersPerRoom')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'SpareSeatsPerRoom', '5', 'NUMBER', 'ROOM', 'Spare seats kept empty per room'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'SpareSeatsPerRoom')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'MinInvigilatorsPerRoom', '1', 'NUMBER', 'INVIGILATION', 'Minimum invigilators assigned per room'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'MinInvigilatorsPerRoom')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'StudentsPerInvigilator', '30', 'NUMBER', 'INVIGILATION', 'Students managed per invigilator'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'StudentsPerInvigilator')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'ForceTwoInvigilatorsPerRoom', 'false', 'BOOLEAN', 'INVIGILATION', 'Always assign at least 2 invigilators per room'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'ForceTwoInvigilatorsPerRoom')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'RelaxRulesIfRoomsShort', 'true', 'BOOLEAN', 'INVIGILATION', 'Relax invigilation rules when rooms are insufficient'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'RelaxRulesIfRoomsShort')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'StrengthSource', 'COURSE_STRENGTH', 'STRING', 'SCHEDULING', 'Source of student strength (COURSE_STRENGTH or MANUAL)'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'StrengthSource')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'FixedChairUsablePercent', '50', 'NUMBER', 'ROOM', 'Usable capacity percentage for fixed-chair rooms'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'FixedChairUsablePercent')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'MovableChairUsablePercent', '100', 'NUMBER', 'ROOM', 'Usable capacity percentage for movable-chair rooms'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'MovableChairUsablePercent')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'ExtraChairsPerRoom', '0', 'NUMBER', 'ROOM', 'Extra chairs allowed per room beyond capacity'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'ExtraChairsPerRoom')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'ReserveInvigilatorsPerSlot', '0', 'NUMBER', 'INVIGILATION', 'Reserve invigilators kept on standby per slot'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'ReserveInvigilatorsPerSlot')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'FridayPartialHoliday', 'false', 'BOOLEAN', 'SCHEDULING', 'Treat Friday as partial holiday (drop break-window slots)'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'FridayPartialHoliday')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'EnforceSemesterSlots', 'false', 'BOOLEAN', 'SCHEDULING', 'Enforce semester-based slot assignments'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'EnforceSemesterSlots')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'SemesterSlotStrict', 'false', 'BOOLEAN', 'SCHEDULING', 'Strictly enforce semester slot assignments (no overrides)'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'SemesterSlotStrict')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'AllowRegularSameDay', 'true', 'BOOLEAN', 'SCHEDULING', 'Allow regular papers on the same day for different semesters'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'AllowRegularSameDay')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'MSAllowedSlots', '2', 'NUMBER', 'SCHEDULING', 'Allowed slots per day for MS/PhD track'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'MSAllowedSlots')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'MSMaxPapersPerDay', '1', 'NUMBER', 'SCHEDULING', 'Max papers per day for MS/PhD track'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'MSMaxPapersPerDay')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'InstituteName', '', 'STRING', 'INSTITUTE', 'Institution name for print headers'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'InstituteName')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'CreatorName', '', 'STRING', 'INSTITUTE', 'Examination officer name for print signatures'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'CreatorName')
ON CONFLICT DO NOTHING;

INSERT INTO settings (tenant_id, key, value, value_type, category, description)
SELECT t.id, 'PrintSignatures', 'false', 'BOOLEAN', 'INSTITUTE', 'Include signature lines on printed datesheets'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.tenant_id = t.id AND s.key = 'PrintSignatures')
ON CONFLICT DO NOTHING;