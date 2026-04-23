-- ============================================================================
-- Migration 0007: Replace permissive RLS with owner-scoped policies
--
-- Drops every "allow_all_v1" policy and replaces it with auth-scoped
-- policies that resolve the caller via users.auth_user_id = auth.uid().
--
-- The photos storage bucket is made private and scoped to the owner's
-- folder path.
--
-- recall_check_log is restricted to service_role only (server-side cron).
-- ============================================================================

-- Helper: reusable function to resolve auth.uid() → users.id (TEXT).
-- Used by every table's USING/WITH CHECK clause.
CREATE OR REPLACE FUNCTION public.authed_user_ids()
RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- =========================================================================
-- 1. Drop ALL allow_all_v1 policies
-- =========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','homes','issues','reminders','home_items','enabled_templates',
    'push_tokens','recall_alerts','recall_check_log','custom_rooms',
    'households','household_members','household_invites'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_v1" ON public.%I;', t);
  END LOOP;
END $$;

-- =========================================================================
-- 2. users — scoped by auth_user_id directly
-- =========================================================================
CREATE POLICY users_owner ON public.users FOR ALL
  TO authenticated
  USING  (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- =========================================================================
-- 3. Owner-scoped tables (user_id → users.id → auth_user_id)
-- =========================================================================
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

-- =========================================================================
-- 4. recall_check_log — service_role only (server-side cron writes here)
-- =========================================================================
-- RLS is already enabled. With no policy for authenticated/anon, only
-- service_role (which bypasses RLS) can read/write.

-- =========================================================================
-- 5. Households — membership-based policies
-- =========================================================================

-- households: readable by members; INSERT requires owner_id = caller;
-- UPDATE/DELETE only by the owner.
CREATE POLICY households_select ON public.households FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id IN (SELECT public.authed_user_ids())
    )
  );

CREATE POLICY households_insert ON public.households FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id IN (SELECT public.authed_user_ids())
  );

CREATE POLICY households_update ON public.households FOR UPDATE
  TO authenticated
  USING (owner_id IN (SELECT public.authed_user_ids()))
  WITH CHECK (owner_id IN (SELECT public.authed_user_ids()));

CREATE POLICY households_delete ON public.households FOR DELETE
  TO authenticated
  USING (owner_id IN (SELECT public.authed_user_ids()));

-- household_members: readable by co-members; INSERT/DELETE by household owner.
-- Members can also delete their own row (self-leave).
CREATE POLICY hm_select ON public.household_members FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id IN (SELECT public.authed_user_ids())
    )
  );

CREATE POLICY hm_insert ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only the household owner can add members
    household_id IN (
      SELECT id FROM public.households
      WHERE owner_id IN (SELECT public.authed_user_ids())
    )
    -- Prevent anyone from inserting themselves as 'owner'
    AND role <> 'owner'
  );

-- Special case: owner can insert themselves with role='owner' during creation
CREATE POLICY hm_insert_owner ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'owner'
    AND user_id IN (SELECT public.authed_user_ids())
    AND household_id IN (
      SELECT id FROM public.households
      WHERE owner_id IN (SELECT public.authed_user_ids())
    )
  );

CREATE POLICY hm_delete ON public.household_members FOR DELETE
  TO authenticated
  USING (
    -- Household owner can remove anyone
    household_id IN (
      SELECT id FROM public.households
      WHERE owner_id IN (SELECT public.authed_user_ids())
    )
    -- OR member can remove themselves (self-leave)
    OR user_id IN (SELECT public.authed_user_ids())
  );

-- household_invites: SELECT by inviter OR matching invitee email;
-- INSERT by household members; UPDATE (accept) by matching invitee only.
CREATE POLICY hi_select ON public.household_invites FOR SELECT
  TO authenticated
  USING (
    -- Inviter can see their invites
    invited_by IN (SELECT public.authed_user_ids())
    -- Invitee matched by email can see invites addressed to them
    OR email = (auth.jwt() ->> 'email')
  );

CREATE POLICY hi_insert ON public.household_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by IN (SELECT public.authed_user_ids())
    AND household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id IN (SELECT public.authed_user_ids())
    )
  );

CREATE POLICY hi_update ON public.household_invites FOR UPDATE
  TO authenticated
  USING (
    -- Only the matching invitee can accept
    email = (auth.jwt() ->> 'email')
  )
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
  );

CREATE POLICY hi_delete ON public.household_invites FOR DELETE
  TO authenticated
  USING (
    -- Inviter can cancel
    invited_by IN (SELECT public.authed_user_ids())
  );

-- =========================================================================
-- 6. Homes: household_id constraint
-- =========================================================================
-- Ensure homes.household_id can only be set to a household the caller
-- is a member of. We use a trigger since WITH CHECK on a single column
-- within an existing policy is cumbersome.
CREATE OR REPLACE FUNCTION public.check_home_household_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = NEW.household_id
        AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'User is not a member of household %', NEW.household_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_home_household ON public.homes;
CREATE TRIGGER enforce_home_household
  BEFORE INSERT OR UPDATE ON public.homes
  FOR EACH ROW
  WHEN (NEW.household_id IS NOT NULL)
  EXECUTE FUNCTION public.check_home_household_membership();

-- =========================================================================
-- 7. Photos storage bucket — make private + owner-scoped
-- =========================================================================
UPDATE storage.buckets SET public = FALSE WHERE id = 'photos';

DROP POLICY IF EXISTS "photos_select_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_update_v1" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_v1" ON storage.objects;

CREATE POLICY photos_owner ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.authed_user_ids()
    )
  )
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.authed_user_ids()
    )
  );
