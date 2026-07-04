-- Phase 6 (Database Health Audit): orders.user_id/status and
-- generated_pages.order_id are the predicate columns for every
-- storage-bucket RLS check (story-pdfs, story-pages, reference-children)
-- and for the "Order owner or admin views pages" policy on
-- generated_pages, plus the app's own "my orders" queries. Purely
-- additive/idempotent — safe even if an equivalent index already exists
-- from the pre-migration-history schema.
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_generated_pages_order ON public.generated_pages (order_id);
