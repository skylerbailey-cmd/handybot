-- ============================================================================
-- Migration 0008: accept_household_invite RPC
--
-- Moves the invite-accept flow into a SECURITY DEFINER function so the
-- invitee can INSERT into household_members without needing the owner-only
-- hm_insert policy. All validation is server-side.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_household_invite(p_invite_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      TEXT;
  v_caller_email TEXT;
  v_invite       RECORD;
  v_existing     INT;
BEGIN
  -- 1. Resolve caller's users.id
  SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Resolve caller's email from JWT (not auth.users — RLS blocks that)
  v_caller_email := lower(auth.jwt() ->> 'email');
  IF v_caller_email IS NULL OR v_caller_email = '' THEN
    RETURN FALSE;
  END IF;

  -- 3. Load and lock the invite
  SELECT * INTO v_invite
    FROM public.household_invites
    WHERE id = p_invite_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 4. Validate status
  IF v_invite.status <> 'pending' THEN
    RETURN FALSE;
  END IF;

  -- 5. Validate email matches caller
  IF lower(v_invite.email) <> v_caller_email THEN
    RETURN FALSE;
  END IF;

  -- 6. Check expiry
  IF v_invite.expires_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT THEN
    UPDATE public.household_invites
      SET status = 'expired'
      WHERE id = p_invite_id;
    RETURN FALSE;
  END IF;

  -- 7. Check caller isn't already in any household
  SELECT COUNT(*) INTO v_existing
    FROM public.household_members
    WHERE user_id = v_user_id;
  IF v_existing > 0 THEN
    RETURN FALSE;
  END IF;

  -- 8. Insert as member
  INSERT INTO public.household_members (id, household_id, user_id, role, joined_at)
    VALUES (
      encode(gen_random_bytes(8), 'hex'),
      v_invite.household_id,
      v_user_id,
      'member',
      (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    );

  -- 9. Mark invite accepted
  UPDATE public.household_invites
    SET status = 'accepted'
    WHERE id = p_invite_id;

  RETURN TRUE;
END;
$$;

-- Only authenticated users can call this
REVOKE ALL ON FUNCTION public.accept_household_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(TEXT) TO authenticated;
