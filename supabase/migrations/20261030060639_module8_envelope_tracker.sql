/*
# Module 8: Envelope Tracker

## Overview
Tracks exam paper envelopes through their lifecycle: prepared → distributed → collected → archived.

## New Tables

### envelopes
- id (uuid, PK)
- tenant_id (uuid, FK to tenants)
- datesheet_item_id (uuid, FK to datesheet_items, ON DELETE CASCADE)
- envelope_number (text) — sequential identifier
- status (enum: PREPARED, DISTRIBUTED, COLLECTED, ARCHIVED)
- sealed_at (timestamptz, nullable) — when sealed/sent out
- returned_at (timestamptz, nullable) — when collected back
- notes (text, nullable)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled, tenant-scoped policies
- SUPER_ADMIN bypass via is_super_admin()
- Grants to authenticated role only
*/

DO $$ BEGIN
  CREATE TYPE envelope_status AS ENUM ('PREPARED', 'DISTRIBUTED', 'COLLECTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  datesheet_item_id uuid NOT NULL REFERENCES datesheet_items(id) ON DELETE CASCADE,
  envelope_number text NOT NULL,
  status envelope_status NOT NULL DEFAULT 'PREPARED',
  sealed_at timestamptz,
  returned_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON envelopes TO authenticated;

DROP POLICY IF EXISTS "envelopes_select" ON envelopes;
CREATE POLICY "envelopes_select" ON envelopes FOR SELECT
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "envelopes_insert" ON envelopes;
CREATE POLICY "envelopes_insert" ON envelopes FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "envelopes_update" ON envelopes;
CREATE POLICY "envelopes_update" ON envelopes FOR UPDATE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "envelopes_delete" ON envelopes;
CREATE POLICY "envelopes_delete" ON envelopes FOR DELETE
  TO authenticated USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS envelopes_updated_at ON envelopes;
CREATE TRIGGER envelopes_updated_at BEFORE UPDATE ON envelopes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_envelopes_tenant_id ON envelopes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_datesheet_item_id ON envelopes(datesheet_item_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status ON envelopes(status);
