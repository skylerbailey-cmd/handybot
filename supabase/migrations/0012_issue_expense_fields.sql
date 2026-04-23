-- ============================================================================
-- Migration 0012: Schedule E expense tracking fields on issues
-- ============================================================================

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS expense_amount_cents INT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS expense_category TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS expense_date TIMESTAMPTZ;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS receipt_vendor TEXT;
