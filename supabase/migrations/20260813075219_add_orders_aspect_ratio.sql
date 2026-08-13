-- أبعاد الصورة/الطباعة التي يختارها العميل عند طلب القصة (مربع/أفقي/عمودي)،
-- تُستخدم لتوجيه توليد صور الصفحات وأبعاد ملف PDF النهائي معاً.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '16:9';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_aspect_ratio_check,
  ADD CONSTRAINT orders_aspect_ratio_check CHECK (aspect_ratio IN ('1:1', '16:9', '9:16'));
