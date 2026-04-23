-- ============================================================================
-- Migration 0010: Normalize invite emails to lowercase
--
-- Ensures RLS policies using auth.jwt() ->> 'email' (which returns
-- lowercase) always match the stored invite email.
-- ============================================================================

-- Backfill any existing rows with mixed-case emails
UPDATE public.household_invites
  SET email = lower(email)
  WHERE email <> lower(email);

-- Trigger function to normalize on every INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.lowercase_invite_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lowercase_invite_email_trg ON public.household_invites;
CREATE TRIGGER lowercase_invite_email_trg
  BEFORE INSERT OR UPDATE ON public.household_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.lowercase_invite_email();
