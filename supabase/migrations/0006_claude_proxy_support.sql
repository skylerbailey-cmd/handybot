-- ============================================================================
-- Migration 0006: Claude proxy support tables
--
-- Adds server-side tier gating, usage tracking, and token logging for the
-- claude-proxy Edge Function.
-- ============================================================================

-- 1. User entitlements — maps auth.users to a billing tier
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier      TEXT NOT NULL DEFAULT 'free',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- Clients can read their own tier; only service_role can write.
CREATE POLICY entitlements_select ON public.user_entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Usage actions — one row per metered action (plan, ask, etc.)
CREATE TABLE IF NOT EXISTS public.usage_actions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_actions_user_action_idx
  ON public.usage_actions (user_id, action, created_at);

ALTER TABLE public.usage_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_actions_insert ON public.usage_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY usage_actions_select ON public.usage_actions
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Claude usage — token-level logging for cost tracking
CREATE TABLE IF NOT EXISTS public.claude_usage (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model                TEXT NOT NULL,
  input_tokens         INT NOT NULL DEFAULT 0,
  output_tokens        INT NOT NULL DEFAULT 0,
  cache_read_tokens    INT NOT NULL DEFAULT 0,
  cache_creation_tokens INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claude_usage_user_idx
  ON public.claude_usage (user_id, created_at);

ALTER TABLE public.claude_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY claude_usage_select ON public.claude_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY claude_usage_insert ON public.claude_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
