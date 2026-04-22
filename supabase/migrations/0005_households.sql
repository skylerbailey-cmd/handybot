-- ============================================================================
-- Migration 0005: Households (family plan)
--
-- Adds multi-user sharing via households. A household groups users around
-- shared homes. The owner creates the household and invites members by email.
-- ============================================================================

-- 1. Add auth_user_id to users so we can link client-generated IDs to
--    Supabase Auth UUIDs. This column is nullable because free-tier users
--    never authenticate.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Index for fast lookups by auth UUID.
CREATE INDEX IF NOT EXISTS users_auth_user_id_idx ON users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 2. Households
CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'My Family',
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS households_owner_idx ON households (owner_id);

-- 3. Household members (join table)
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

-- 4. Household invites (pending invitations sent by email)
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

-- 5. Add household_id to homes so homes can be shared via a household.
--    Nullable — personal (unshared) homes leave this NULL.
ALTER TABLE homes ADD COLUMN IF NOT EXISTS household_id TEXT REFERENCES households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS homes_household_idx ON homes (household_id)
  WHERE household_id IS NOT NULL;

-- 6. RLS policies — permissive v1 for now (matches existing pattern).
--    When auth-based RLS is ready, replace these with auth.uid() checks.
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'households' AND policyname = 'allow_all_v1') THEN
    CREATE POLICY allow_all_v1 ON households FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_members' AND policyname = 'allow_all_v1') THEN
    CREATE POLICY allow_all_v1 ON household_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_invites' AND policyname = 'allow_all_v1') THEN
    CREATE POLICY allow_all_v1 ON household_invites FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
