# Kidzy Launch Readiness Plan

This is a large multi-phase scope. I'll break it into 3 shippable milestones so you can review and approve before each big leap, instead of one giant unreviewable change.

## Guiding rules (apply to every phase)
- **Keep all DB/backend** for Kashier, printing, shipping intact. Only hide the customer-facing UI behind "coming soon" screens.
- **Vodafone Cash** stays the only active payment.
- Design: Disney+/Netflix Kids vibe, purple primary `#6C4DFF`, large cinematic cards, soft shadows, mobile-first, Arabic RTL.
- Reuse the existing design tokens in `src/styles.css`; do not introduce new color systems.

---

## Milestone A — Disable + Story-First Launch (Phases 1, 2, 3, 4, 6)
Goal: site is launch-ready today, payments/printing safely hidden, homepage is story-first.

### Phase 1 — Disable Kashier (UI only)
- In `_authenticated.checkout.tsx`, when user picks "بطاقة ائتمان": open a `ComingSoonPaymentDialog` with Visa/Mastercard icons, two CTAs:
  - "الدفع بفودافون كاش" → switches selection to Vodafone Cash.
  - "إشعاري عند توفر الخدمة" → writes a row to a new `notify_signups` table (kind='kashier').
- Default payment method = Vodafone Cash. Kashier server functions, webhook, env vars, `payment_logs`, `payment_provider` all untouched.

### Phase 2 — Postpone printing
- Remove print/delivery selectors from checkout UI and order edit dialog.
- Add a "📚 النسخة المطبوعة قريباً" banner card with the feature list and a disabled "🚀 قريباً" button.
- DB columns `print_copy`, `delivery_address`, etc. remain; checkout always sends `print_copy=false`.

### Phase 3 — Story-first homepage
Rebuild `src/routes/index.tsx` sections in this order:
1. Hero (existing, tightened) + "تصفح القصص" CTA.
2. **Featured Stories Carousel** (admin flag `is_featured` on `story_templates`).
3. **Trending** (orders count last 30 days).
4. **Most Popular** (all-time orders count).
5. **Continue Reading** (auth users only — orders with status in generating/ready).
6. **Recommended** (same category as last viewed/ordered, fallback random).
7. AI creation strip (20%).
8. Books / games / puzzles (10%).

### Phase 4 — Free preview (cover + 3 pages)
- `stories.$slug.tsx`: render cover + pages 1-3 with full image + text. Pages 4+ shown blurred with a single overlay card "أكمل قصة طفلك الآن" + "اطلب القصة" CTA → `/order/$templateId`.
- Already-paying owners (matching order with `payment_status` verified) bypass the gate.

### Phase 6 — Visual order tracking
- Replace text status in `my-orders` and `story.$orderId` with a 7-step horizontal stepper:
  استلام → انتظار الدفع → تأكيد الدفع → كتابة القصة → تصميم الرسومات → مراجعة الجودة → تسليم.
- Map existing `status` + `payment_status` + `admin_approved_at` to step index; show ETA based on `created_at + 48h`.

---

## Milestone B — Revenue + Conversion (Phases 5, 7, 8, 10, 11)

### Phase 5 — Story packages (bundles)
- New table `story_packages` (slug, name, story_count, price_egp, savings_pct, sort).
- Seed: Starter (1 / 150), Family (3 / 400, ~11% off), Premium (5 / 625, ~17% off), Ultimate (10 / 1150, ~24% off).
- New `/packages` route + section on homepage. Add `package_id` + `remaining_stories` to `orders` (or new `package_credits` table). Checkout supports package purchase; order creation decrements credits.

### Phase 7 — Portfolio "قصص قمنا بإنشائها"
- New `/portfolio` route reading from orders where `publish_consent=true` AND `admin_approved_at` set.
- Card shows cover, child age, category, parent rating (new optional `rating` int column on orders, set by customer after delivery).

### Phase 8 — Testimonials
- New table `testimonials` (parent_name, child_name, rating, body, approved). Admin CRUD under `/admin/testimonials`. Display 5-star carousel on homepage + portfolio page.

### Phase 10 — Coupons
- New table `coupons` (code, discount_pct OR discount_egp, max_uses, used_count, valid_until, active).
- Seed WELCOME20, KIDZY10, BIRTHDAY. Checkout input applies coupon, validates server-side, stores `coupon_code` + `discount_egp` on order.

### Phase 11 — Free story idea generator
- New `/ideas` public route: form (child name, age, favorite character, interests).
- Server function calls Lovable AI Gateway (gemini-2.5-flash) → returns 3 idea cards (title + 2-line synopsis). Each card has CTA "اطلب القصة الكاملة" → `/request-story` prefilled.

---

## Milestone C — Growth + Admin (Phases 9, 12)

### Phase 9 — Referral system
- Add `referral_code` (auto-generated) + `referred_by` + `credit_egp` to profiles.
- Friend signup with `?ref=CODE` → friend gets 20% off first order, referrer gets 50 EGP credit applied automatically once friend's first order is verified.
- "ادعُ صديقاً" page with shareable link + WhatsApp share.

### Phase 12 — Admin analytics dashboard
- Upgrade `/admin` index with cards: revenue (today/30d/total), orders count, conversion rate (orders/visits — visits tracked via simple `page_views` table), top categories, most requested themes (from `custom_brief` keywords), avg delivery time (admin_approved_at - created_at), retention (% customers with ≥2 orders).
- Recharts for line/bar visualizations.

---

## Technical notes
- New DB migrations grouped per milestone (one migration each), with GRANTs + RLS following project rules.
- All new public-facing routes get `head()` meta for SEO.
- Reuse existing `StoryCard`, `Footer`, `Header` components; create new `SectionCarousel`, `OrderStepper`, `ComingSoonPaymentDialog`, `ComingSoonPrintCard`, `PackageCard`, `TestimonialCard`, `CouponInput`, `ReferralBanner`.
- No changes to Kashier server functions, webhook, or auto-generated Supabase files.

---

## What I need from you before starting
1. **Approve this 3-milestone split**, or tell me to merge/split differently.
2. **Start with Milestone A?** (recommended — it's the launch-blocker work). I will not begin coding until you confirm.
3. **Package prices** above are my proposal — confirm or override the 4 tiers.
4. **Referral economics** (50 EGP credit, 20% friend discount) — confirm or change numbers.
