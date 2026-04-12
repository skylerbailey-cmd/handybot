-- =============================================================================
-- Handy-Man cloud backup schema (v1)
--
-- Paste this entire file into Supabase dashboard → SQL Editor → New query,
-- then click Run. Safe to re-run: every statement uses IF [NOT] EXISTS.
--
-- What this creates:
--   * 6 tables: users, homes, issues, reminders, home_items, enabled_templates
--   * 1 storage bucket: "photos" (for cover images, chat photos, inventory
--     photos, verification photos)
--   * Row Level Security enabled on every table + storage policies
--
-- RLS policy strategy
--   * For now there is no login yet, so rows are keyed by a client-generated
--     `user_id` (TEXT). Policies are "ALLOW ALL" so the anon/publishable key
--     can read/write. This is intentional for v1.
--   * When real auth is wired up in the next step, we will:
--       1) add an `auth_user_id UUID REFERENCES auth.users` column,
--       2) backfill it for existing rows,
--       3) replace the permissive policies with per-user ones like:
--          USING (auth_user_id = auth.uid())
--     The app code is already structured so that flip is additive.
--
-- NOTE: ask_messages (general Q&A chat) is intentionally NOT synced to the
-- cloud. That stays on each device by design.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Profile table, one row per user. Mirrors the device-generated User object.
CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT PRIMARY KEY,          -- client-generated user id
  name        TEXT NOT NULL DEFAULT 'You',
  created_at  BIGINT NOT NULL,            -- unix ms, from client
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Homes: each user can have multiple homes.
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

-- Issues (repairs): the "projects on the homepage" + history.
-- plan and messages are stored as JSONB blobs for v1 — they are complex,
-- tightly coupled to the issue, and we don't need to query inside them.
CREATE TABLE IF NOT EXISTS public.issues (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id           TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL,                      -- in_progress | completed | verified
  cover_image_uri   TEXT,                               -- https URL (Supabase Storage) once uploaded
  plan              JSONB NOT NULL DEFAULT '{}'::jsonb,
  messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issues_user_home_idx ON public.issues(user_id, home_id);
CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues(status);

-- Reminders
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
  notification_id   TEXT,                               -- device-specific; not actually meaningful cross-device
  source_issue_id   TEXT,
  created_at        BIGINT NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_home_idx ON public.reminders(user_id, home_id);

-- Home inventory items
CREATE TABLE IF NOT EXISTS public.home_items (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id                   TEXT NOT NULL,
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL,
  icon                      TEXT NOT NULL,
  room                      TEXT NOT NULL,
  photo_uri                 TEXT,                       -- https URL once uploaded
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

-- Which prebuilt maintenance templates the user has enabled (small set;
-- one row per enabled template).
CREATE TABLE IF NOT EXISTS public.enabled_templates (
  user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id       TEXT NOT NULL,
  template_id   TEXT NOT NULL,
  enabled_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, home_id, template_id)
);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- RLS is ON for every table. The v1 policies are permissive (anon can do
-- anything) because there's no login yet. When auth lands, we drop these
-- policies and replace them with auth.uid()-based ones.

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

-- -----------------------------------------------------------------------------
-- Storage bucket for photos
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Permissive policies for v1. Same flip-to-auth plan as the tables above.
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
