-- =============================================================================
-- Combined setup: all migrations (0001 + 0002 + 0003)
-- Paste into Supabase SQL Editor and click Run.
-- =============================================================================

-- 0001: Initial schema
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'You',
  created_at  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '🏠',
  created_at  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homes_user_id_idx ON public.homes(user_id);

CREATE TABLE IF NOT EXISTS public.issues (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id           TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL,
  cover_image_uri   TEXT,
  plan              JSONB NOT NULL DEFAULT '{}'::jsonb,
  messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issues_user_home_idx ON public.issues(user_id, home_id);
CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues(status);

CREATE TABLE IF NOT EXISTS public.reminders (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id           TEXT NOT NULL,
  template_id       TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  icon              TEXT NOT NULL DEFAULT '🛠',
  category          TEXT NOT NULL DEFAULT 'general',
  frequency_days    INTEGER NOT NULL,
  next_due          BIGINT NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  notification_id   TEXT,
  source_issue_id   TEXT,
  created_at        BIGINT NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_home_idx ON public.reminders(user_id, home_id);

CREATE TABLE IF NOT EXISTS public.home_items (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id                   TEXT NOT NULL,
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL,
  icon                      TEXT NOT NULL,
  room                      TEXT NOT NULL,
  photo_uri                 TEXT,
  estimated_age_years       INTEGER NOT NULL DEFAULT 0,
  typical_lifespan_years    INTEGER NOT NULL DEFAULT 0,
  condition                 TEXT NOT NULL DEFAULT 'good',
  condition_notes           TEXT NOT NULL DEFAULT '',
  maintenance_tips          JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_reminders       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                BIGINT NOT NULL,
  updated_at                BIGINT NOT NULL,
  synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS home_items_user_home_idx ON public.home_items(user_id, home_id);

CREATE TABLE IF NOT EXISTS public.enabled_templates (
  user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id       TEXT NOT NULL,
  template_id   TEXT NOT NULL,
  enabled_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, home_id, template_id)
);

-- RLS
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enabled_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','homes','issues','reminders','home_items','enabled_templates'
  ]) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "allow_all_v1" ON public.%I;', t
    );
    EXECUTE format(
      'CREATE POLICY "allow_all_v1" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t
    );
  END LOOP;
END $$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "photos_select_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_update_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_v1" ON storage.objects;

CREATE POLICY "photos_select_v1" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "photos_insert_v1" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "photos_update_v1" ON storage.objects
  FOR UPDATE USING (bucket_id = 'photos') WITH CHECK (bucket_id = 'photos');
CREATE POLICY "photos_delete_v1" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');

-- 0002: Add make/model fields to home_items
-- -----------------------------------------------------------------------------

ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS make             TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS model            TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS serial_number    TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS year_installed   INTEGER;

-- 0003: Recall alerts and push tokens
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token             TEXT NOT NULL,
  platform          TEXT NOT NULL DEFAULT 'ios',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_v1" ON public.push_tokens;
CREATE POLICY "allow_all_v1" ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.recall_alerts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id           TEXT NOT NULL,
  item_id           TEXT NOT NULL,
  recall_id         INTEGER NOT NULL,
  recall_number     TEXT NOT NULL,
  recall_date       TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  hazard            TEXT,
  remedy            TEXT,
  url               TEXT,
  image_url         TEXT,
  match_reason      TEXT,
  dismissed         BOOLEAN NOT NULL DEFAULT false,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id, recall_id)
);
CREATE INDEX IF NOT EXISTS recall_alerts_user_home_idx ON public.recall_alerts(user_id, home_id);
CREATE INDEX IF NOT EXISTS recall_alerts_item_idx ON public.recall_alerts(item_id);

ALTER TABLE public.recall_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_v1" ON public.recall_alerts;
CREATE POLICY "allow_all_v1" ON public.recall_alerts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.recall_check_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  recalls_found     INTEGER NOT NULL DEFAULT 0,
  alerts_created    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.recall_check_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_v1" ON public.recall_check_log;
CREATE POLICY "allow_all_v1" ON public.recall_check_log FOR ALL USING (true) WITH CHECK (true);
