/*
# Fix: Infinite recursion in profiles RLS policy

## Problem
The profiles_select policy contained an inline subquery `SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'TENANT_ADMIN'` which queries the profiles table from within the profiles RLS policy, causing infinite recursion.

## Fix
1. Create a new SECURITY DEFINER function `is_tenant_admin()` that checks if the current user is a TENANT_ADMIN — this bypasses RLS and avoids recursion.
2. Update profiles_select policy to use `is_tenant_admin()` instead of the inline subquery.
3. Drop and recreate all affected policies.
*/

-- ============================================================
-- NEW HELPER: is_tenant_admin()
-- ============================================================
DROP FUNCTION IF EXISTS public.is_tenant_admin();
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'TENANT_ADMIN' AND is_active = true
  );
$$;

-- ============================================================
-- FIX: profiles_select policy (remove inline subquery)
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (tenant_id = public.current_tenant_id() AND public.is_tenant_admin())
  );

-- ============================================================
-- Re-affirm other profiles policies (unchanged but safe to re-run)
-- ============================================================
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
