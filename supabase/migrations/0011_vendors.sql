-- ============================================================================
-- Migration 0011: Vendor contact book (landlord tier)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  specialty       TEXT,
  hourly_rate_cents INT,
  notes           TEXT,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendors_user_home_idx ON public.vendors(user_id, home_id);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_owner ON public.vendors FOR ALL
  TO authenticated
  USING (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));
