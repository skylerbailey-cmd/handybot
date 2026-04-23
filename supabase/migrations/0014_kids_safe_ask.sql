-- ============================================================================
-- Migration 0014: Kids-safe Ask mode with parent notifications
-- ============================================================================

-- 1. Add minor flags to household_members
ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS minor_parent_user_id UUID;

-- 2. Parent notifications table
CREATE TABLE IF NOT EXISTS public.parent_notifications (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minor_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  response        TEXT,
  category        TEXT,
  acknowledged    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parent_notifications_parent_idx
  ON public.parent_notifications(parent_user_id, created_at DESC);

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_notifications_select ON public.parent_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_user_id);

CREATE POLICY parent_notifications_update ON public.parent_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = parent_user_id);

-- Service role inserts from the edge function
CREATE POLICY parent_notifications_insert ON public.parent_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Push notification trigger for parent alerts
CREATE OR REPLACE FUNCTION public.notify_parent_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
  v_minor_name TEXT;
BEGIN
  -- Look up the minor's name from users via household_members
  SELECT u.name INTO v_minor_name
    FROM public.household_members hm
    JOIN public.users u ON u.auth_user_id = NEW.minor_user_id
    WHERE hm.is_minor = true
    LIMIT 1;

  v_minor_name := COALESCE(v_minor_name, 'A household member');

  -- Send push to all parent devices
  FOR v_token IN
    SELECT pt.token
      FROM public.push_tokens pt
      JOIN public.users u ON u.id = pt.user_id
      WHERE u.auth_user_id = NEW.parent_user_id
  LOOP
    -- Use pg_net or http extension if available; otherwise this is a
    -- best-effort no-op. The edge function also does a direct insert
    -- as a fallback.
    BEGIN
      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := json_build_object(
          'to', v_token.token,
          'title', 'Safety check from HandyBot',
          'body', v_minor_name || ' asked about ' || COALESCE(NEW.category, 'a repair') || ' — tap to review',
          'data', json_build_object('type', 'minor_safety', 'notificationId', NEW.id),
          'sound', 'default',
          'channelId', 'maintenance'
        )::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- pg_net may not be enabled; edge function handles push as fallback
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parent_notification_push ON public.parent_notifications;
CREATE TRIGGER parent_notification_push
  AFTER INSERT ON public.parent_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parent_on_insert();
