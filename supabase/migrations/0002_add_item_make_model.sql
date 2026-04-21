-- Add manufacturer/model fields to home_items for recall matching
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS make             TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS model            TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS serial_number    TEXT;
ALTER TABLE public.home_items ADD COLUMN IF NOT EXISTS year_installed   INTEGER;
