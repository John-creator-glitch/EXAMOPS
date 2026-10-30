/*
# Module 1: Foundation — Tenants, Profiles, Auth, RLS

## Overview
Creates the multi-tenant foundation for the Examination Management System ERP.
Tenants represent universities (e.g., Green International University).
Profiles link Supabase auth.users to app-specific data (role, tenant membership).

## New Tables

### tenants
- id (uuid, PK)
- slug (text, unique) — URL-friendly identifier e.g. "giu"
- name (text) — full university name
- short_name (text) — abbreviated name
- status (enum: TRIAL, ACTIVE, SUSPENDED, CANCELLED)
- plan (enum: STARTER, PROFESSIONAL, ENTERPRISE, DEDICATED)
- primary_color (text) — hex color for UI theming
- logo_url (text, nullable)
- timezone (text, default 'Asia/Karachi')
- locale (text, default 'en')
- created_at (timestamptz)
- updated_at (timestamptz)

### profiles
- id (uuid, PK, FK to auth.users)
- tenant_id (uuid, FK to tenants)
- full_name (text)
- role (enum: SUPER_ADMIN, TENANT_ADMIN, EXAM_OFFICER, REGISTRAR, HOD, FACULTY, VIEWER)
- is_active (boolean, default true)
- created_at (timestamptz)
- updated_at (timestamptz)

## Security
- RLS enabled on both tables
- profiles: users can read/update their own profile; SUPER_ADMIN can read all profiles; TENANT_ADMIN can read profiles in their tenant
- tenants: SUPER_ADMIN can CRUD all tenants; tenant members can read their own tenant
- Auto-profile trigger on auth.users INSERT
- Grants to authenticated role only (app requires sign-in)

## Important Notes
1. SUPER_ADMIN users have tenant_id set to the first tenant but can see all tenants via policies
2. A database function checks if a user is SUPER_ADMIN to bypass tenant filtering on tenants table
3. Profile creation is automated via a trigger on auth.users
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_plan AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'DEDICATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'EXAM_OFFICER', 'REGISTRAR', 'HOD', 'FACULTY', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TENANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  short_name text,
  status tenant_status NOT NULL DEFAULT 'TRIAL',
  plan tenant_plan NOT NULL DEFAULT 'STARTER',
  primary_color text DEFAULT '#1d4ed8',
  logo_url text,
  timezone text DEFAULT 'Asia/Karachi',
  locale text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'VIEWER',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- SEED: Green International University (GIU)
-- ============================================================
INSERT INTO tenants (slug, name, short_name, status, plan, primary_color, timezone, locale)
SELECT 'giu', 'Green International University', 'GIU', 'ACTIVE', 'ENTERPRISE', '#059669', 'Asia/Karachi', 'en'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'giu');

-- ============================================================
-- HELPER FUNCTIONS (must come after tables exist)
-- ============================================================
DROP FUNCTION IF EXISTS public.is_super_admin();
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND is_active = true
  );
$$;

DROP FUNCTION IF EXISTS public.current_tenant_id();
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- RLS: TENANTS
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO authenticated;

DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  TO authenticated USING (
    public.is_super_admin() OR id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  TO authenticated USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "tenants_delete" ON tenants;
CREATE POLICY "tenants_delete" ON tenants FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================
-- RLS: PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (tenant_id = public.current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'TENANT_ADMIN' AND p.is_active = true
    ))
  );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================
-- AUTO-PROFILE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_tenant uuid;
BEGIN
  SELECT id INTO first_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  INSERT INTO public.profiles (id, tenant_id, full_name, role)
  VALUES (
    NEW.id,
    first_tenant,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'VIEWER')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
