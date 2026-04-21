-- Push tokens: one row per device so the server can send notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token             TEXT NOT NULL,
  platform          TEXT NOT NULL DEFAULT 'ios',   -- ios | android
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens(user_id);

-- Recall alerts: matched CPSC recalls for inventory items
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

-- Track the last time the recall checker ran so the cron doesn't re-process
CREATE TABLE IF NOT EXISTS public.recall_check_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  recalls_found     INTEGER NOT NULL DEFAULT 0,
  alerts_created    INTEGER NOT NULL DEFAULT 0
);
