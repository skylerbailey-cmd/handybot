-- ============================================================================
-- Migration 0009: Fix invite email check
--
-- Replaces auth.users subquery (which authenticated users can't read)
-- with auth.jwt() ->> 'email' in household_invites policies.
-- ============================================================================

DROP POLICY IF EXISTS hi_select ON public.household_invites;
CREATE POLICY hi_select ON public.household_invites FOR SELECT
  TO authenticated
  USING (
    invited_by IN (SELECT public.authed_user_ids())
    OR email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS hi_update ON public.household_invites;
CREATE POLICY hi_update ON public.household_invites FOR UPDATE
  TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')
  )
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
  );
