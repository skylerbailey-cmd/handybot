-- =============================================================================
-- Combined setup: all migrations (0001–0007)
-- Paste into Supabase SQL Editor and click Run for a fresh project.
-- =============================================================================

-- Helper function: resolve auth.uid() → users.id (TEXT)
CREATE OR REPLACE FUNCTION public.authed_user_ids()
RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- 0001: Initial schema
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'You',
  auth_user_id UUID UNIQUE,
  created_at  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_auth_user_id_idx ON users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.homes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '🏠',
  household_id TEXT,
  created_at  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homes_user_id_idx ON public.homes(user_id);
CREATE INDEX IF NOT EXISTS homes_household_idx ON public.homes (household_id)
  WHERE household_id IS NOT NULL;

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
  room              TEXT,
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
  make                      TEXT,
  model                     TEXT,
  serial_number             TEXT,
  year_installed            INTEGER,
  purchase_date             BIGINT,
  warranty_expiration       BIGINT,
  warranty_provider         TEXT,
  warranty_coverage_notes   TEXT,
  warranty_photo_uri        TEXT,
  receipt_photo_uri         TEXT,
  warranty_registered       BOOLEAN NOT NULL DEFAULT false,
  replacement_cost_usd      NUMERIC,
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

-- 0003: Push tokens + recall alerts
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
  is_exact_match    BOOLEAN NOT NULL DEFAULT false,
  dismissed         BOOLEAN NOT NULL DEFAULT false,
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id, recall_id)
);
CREATE INDEX IF NOT EXISTS recall_alerts_user_home_idx ON public.recall_alerts(user_id, home_id);
CREATE INDEX IF NOT EXISTS recall_alerts_item_idx ON public.recall_alerts(item_id);

CREATE TABLE IF NOT EXISTS public.recall_check_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  recalls_found     INTEGER NOT NULL DEFAULT 0,
  alerts_created    INTEGER NOT NULL DEFAULT 0
);

-- 0004: Custom rooms
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_rooms (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id     TEXT NOT NULL,
  label       TEXT NOT NULL,
  UNIQUE(user_id, home_id, label)
);
CREATE INDEX IF NOT EXISTS custom_rooms_user_home_idx ON public.custom_rooms(user_id, home_id);

-- 0005: Households
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'My Family',
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS households_owner_idx ON households (owner_id);

CREATE TABLE IF NOT EXISTS household_members (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (household_id, user_id)
);
CREATE INDEX IF NOT EXISTS household_members_user_idx ON household_members (user_id);
CREATE INDEX IF NOT EXISTS household_members_household_idx ON household_members (household_id);

CREATE TABLE IF NOT EXISTS household_invites (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  invited_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at    BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  expires_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS household_invites_email_idx ON household_invites (email);
CREATE INDEX IF NOT EXISTS household_invites_token_idx ON household_invites (token);
CREATE INDEX IF NOT EXISTS household_invites_household_idx ON household_invites (household_id);

ALTER TABLE homes ADD CONSTRAINT homes_household_fk
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;

-- 0006: Claude proxy support
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier       TEXT NOT NULL DEFAULT 'free',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_actions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS usage_actions_user_action_idx
  ON public.usage_actions (user_id, action, created_at);

CREATE TABLE IF NOT EXISTS public.claude_usage (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model                 TEXT NOT NULL,
  input_tokens          INT NOT NULL DEFAULT 0,
  output_tokens         INT NOT NULL DEFAULT 0,
  cache_read_tokens     INT NOT NULL DEFAULT 0,
  cache_creation_tokens INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS claude_usage_user_idx
  ON public.claude_usage (user_id, created_at);

-- =============================================================================
-- Row Level Security — owner-scoped (0007)
-- =============================================================================

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enabled_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_check_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_rooms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_actions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_usage      ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY users_owner ON public.users FOR ALL
  TO authenticated
  USING  (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Owner-scoped tables
CREATE POLICY homes_owner ON public.homes FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY issues_owner ON public.issues FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY reminders_owner ON public.reminders FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY home_items_owner ON public.home_items FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY enabled_templates_owner ON public.enabled_templates FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY push_tokens_owner ON public.push_tokens FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY recall_alerts_owner ON public.recall_alerts FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY custom_rooms_owner ON public.custom_rooms FOR ALL
  TO authenticated
  USING  (user_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (user_id IN (SELECT public.authed_user_ids()));

-- 0006 tables (already use auth.users UUID directly)
CREATE POLICY entitlements_select ON public.user_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY usage_actions_insert ON public.usage_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY usage_actions_select ON public.usage_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY claude_usage_select ON public.claude_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY claude_usage_insert ON public.claude_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Households
CREATE POLICY households_select ON public.households FOR SELECT
  TO authenticated
  USING (id IN (SELECT household_id FROM public.household_members
                WHERE user_id IN (SELECT public.authed_user_ids())));
CREATE POLICY households_insert ON public.households FOR INSERT
  TO authenticated WITH CHECK (owner_id IN (SELECT public.authed_user_ids()));
CREATE POLICY households_update ON public.households FOR UPDATE
  TO authenticated
  USING (owner_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (owner_id IN (SELECT public.authed_user_ids()));
CREATE POLICY households_delete ON public.households FOR DELETE
  TO authenticated USING (owner_id IN (SELECT public.authed_user_ids()));

CREATE POLICY hm_select ON public.household_members FOR SELECT
  TO authenticated
  USING (household_id IN (SELECT household_id FROM public.household_members
                          WHERE user_id IN (SELECT public.authed_user_ids())));
CREATE POLICY hm_insert ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (household_id IN (SELECT id FROM public.households
              WHERE owner_id IN (SELECT public.authed_user_ids()))
              AND role <> 'owner');
CREATE POLICY hm_insert_owner ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (role = 'owner'
              AND user_id IN (SELECT public.authed_user_ids())
              AND household_id IN (SELECT id FROM public.households
                  WHERE owner_id IN (SELECT public.authed_user_ids())));
CREATE POLICY hm_delete ON public.household_members FOR DELETE
  TO authenticated
  USING (household_id IN (SELECT id FROM public.households
         WHERE owner_id IN (SELECT public.authed_user_ids()))
         OR user_id IN (SELECT public.authed_user_ids()));

CREATE POLICY hi_select ON public.household_invites FOR SELECT
  TO authenticated
  USING (invited_by IN (SELECT public.authed_user_ids())
         OR email = (auth.jwt() ->> 'email'));
CREATE POLICY hi_insert ON public.household_invites FOR INSERT
  TO authenticated
  WITH CHECK (invited_by IN (SELECT public.authed_user_ids())
              AND household_id IN (SELECT household_id FROM public.household_members
                  WHERE user_id IN (SELECT public.authed_user_ids())));
CREATE POLICY hi_update ON public.household_invites FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'))
  WITH CHECK (email = (auth.jwt() ->> 'email'));
CREATE POLICY hi_delete ON public.household_invites FOR DELETE
  TO authenticated
  USING (invited_by IN (SELECT public.authed_user_ids()));

-- Household home constraint trigger
CREATE OR REPLACE FUNCTION public.check_home_household_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.household_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.household_members
                   WHERE household_id = NEW.household_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User is not a member of household %', NEW.household_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_home_household
  BEFORE INSERT OR UPDATE ON public.homes
  FOR EACH ROW WHEN (NEW.household_id IS NOT NULL)
  EXECUTE FUNCTION public.check_home_household_membership();

-- Storage bucket — private + owner-scoped
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

CREATE POLICY photos_owner ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'photos'
         AND (storage.foldername(name))[1] IN (SELECT public.authed_user_ids()))
  WITH CHECK (bucket_id = 'photos'
              AND (storage.foldername(name))[1] IN (SELECT public.authed_user_ids()));

-- 0008: Accept household invite RPC
CREATE OR REPLACE FUNCTION public.accept_household_invite(p_invite_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id TEXT; v_caller_email TEXT; v_invite RECORD; v_existing INT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;
  v_caller_email := lower(auth.jwt() ->> 'email');
  IF v_caller_email IS NULL OR v_caller_email = '' THEN RETURN FALSE; END IF;
  SELECT * INTO v_invite FROM public.household_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_invite.status <> 'pending' THEN RETURN FALSE; END IF;
  IF lower(v_invite.email) <> v_caller_email THEN RETURN FALSE; END IF;
  IF v_invite.expires_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT THEN
    UPDATE public.household_invites SET status = 'expired' WHERE id = p_invite_id;
    RETURN FALSE;
  END IF;
  SELECT COUNT(*) INTO v_existing FROM public.household_members WHERE user_id = v_user_id;
  IF v_existing > 0 THEN RETURN FALSE; END IF;
  INSERT INTO public.household_members (id, household_id, user_id, role, joined_at)
    VALUES (encode(gen_random_bytes(8), 'hex'), v_invite.household_id, v_user_id, 'member',
            (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
  UPDATE public.household_invites SET status = 'accepted' WHERE id = p_invite_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_household_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(TEXT) TO authenticated;
