-- Add warranty, purchase, and cost fields to home_items
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS purchase_date           BIGINT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS warranty_expiration     BIGINT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS warranty_provider       TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS warranty_coverage_notes TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS warranty_photo_uri      TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS receipt_photo_uri       TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS warranty_registered     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS replacement_cost_usd    NUMERIC;

-- Add room field to reminders
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS room TEXT;

-- Custom room labels per home
CREATE TABLE IF NOT EXISTS public.custom_rooms (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  home_id     TEXT NOT NULL,
  label       TEXT NOT NULL,
  UNIQUE(user_id, home_id, label)
);
CREATE INDEX IF NOT EXISTS custom_rooms_user_home_idx ON public.custom_rooms(user_id, home_id);

ALTER TABLE public.custom_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_v1" ON public.custom_rooms;
CREATE POLICY "allow_all_v1" ON public.custom_rooms FOR ALL USING (true) WITH CHECK (true);
