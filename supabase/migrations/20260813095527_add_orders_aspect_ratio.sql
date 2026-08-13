-- نسبة أبعاد الصورة/الطباعة التي يختارها العميل (مربع 1:1 / أفقي 16:9 / عمودي 9:16).
-- عمود جديد يتعايش مع orders.orientation الحالي (landscape/portrait) بدل استبداله:
-- عمود nullable بلا قيمة افتراضية عمداً، حتى تبقى NULL تعني "لا يوجد اختيار صريح
-- لنسبة الأبعاد لهذا الطلب — استنتجها من orientation القديم". هذا يحفظ بيانات
-- الإنتاج الحالية دون أي تعديل بأثر رجعي؛ منطق الاستنتاج الوحيد المعتمد هو
-- resolveOrderAspectRatio() في src/features/ai/storyStyle.ts.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS aspect_ratio text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_aspect_ratio_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_aspect_ratio_check
  CHECK (aspect_ratio IS NULL OR aspect_ratio IN ('1:1', '16:9', '9:16'));
