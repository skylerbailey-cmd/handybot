-- ============================================================================
-- Migration 0013: Per-user activity log for family households
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  home_id         TEXT NOT NULL,
  actor_user_id   UUID NOT NULL,
  actor_name      TEXT NOT NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  entity_title    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_home_idx
  ON public.activity_log(home_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_select ON public.activity_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
