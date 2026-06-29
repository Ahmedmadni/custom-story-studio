# Kidzy Growth Upgrade — 3 Milestones

This is a very large scope (7 features + design refresh). I'll ship it in 3 reviewable milestones. Each milestone is independently launchable.

Design language (applies everywhere): Disney+/Netflix Kids feel — purple `#6C4DFF` primary, large rounded cards, soft shadows, big illustrations, mobile-first, Arabic RTL. Reuse existing tokens in `src/styles.css`. No new color systems.

---

## Milestone 1 — Conversion Boosters (ship first)

Goal: lift conversion on the existing traffic before adding new acquisition surfaces.

### F3 — Trust counters (homepage)
- New `<TrustCounters />` strip above "Featured Stories" with 4 animated count-up cards: Stories Created, Happy Families, Avg Rating, Avg Delivery.
- Live numbers via a public `getTrustStats` server fn: count of `orders` with `status='delivered'`, distinct `user_id`, hardcoded 4.9/5 (until reviews ship in M2), avg `admin_approved_at - created_at`.

### F2 — Occasion Stories section
- Add `occasion` enum column on `story_templates` (birthday, graduation, ramadan, eid, back_to_school, bedtime, family, adventure).
- New homepage row "قصص لكل مناسبة" with 8 large illustrated category cards → `/stories?occasion=<key>`.
- Extend `stories.index.tsx` to filter by `occasion` search param.

### F5 — Favorites
- New `favorites` table (`user_id`, `template_id`, unique).
- Heart button on `StoryCard` + `stories.$slug.tsx` (auth-only; signed-out → toast "سجّل دخولك للحفظ").
- New `/_authenticated/favorites` route listing saved stories with cover + title + category + "اطلب الآن" CTA.

### F6 — Smart recommendations
- New `<RecommendedStories templateId|orderId|childAge>` carousel.
- Algorithm (server fn): same category + overlapping age range, excluding already-purchased, ordered by 30-day order count; fallback to popular.
- Mount on: post-checkout success page, `stories.$slug.tsx` bottom, `my-orders` order detail.

---

## Milestone 2 — Loyalty & Profiles

### F1 — Story Hero (child profiles)
- New `child_profiles` table: `user_id`, `name`, `name_en`, `age`, `gender`, `photo_path`, `personality` (text[]), `hobbies` (text[]), `favorite_character`, `favorite_color`, `avatar_url` (generated cartoon avatar).
- New `/_authenticated/children` management page (list/add/edit/delete profile cards).
- Wizard: "اختر بطل القصة" step in `/order/$templateId` and `/request-story` — pick existing child or create new. Auto-fills child name, age, gender, photo.
- Checkout banner: "👑 طفلك {name} هو بطل هذه القصة".
- Avatar generation via existing Lovable AI image fn (cartoon portrait, child reuses across orders).
- Feed `personality/hobbies/favorite_character/favorite_color` into story-generation prompts for personalization.

### F4 — Kidzy Rewards
- New `reward_accounts` (`user_id`, `points_balance`) + `reward_transactions` (`user_id`, `delta`, `reason`, `order_id`).
- Earning rules (DB trigger on `orders` when `admin_approved_at` set): first order +100, every order +50, review +30, successful referral +100.
- Redemption catalog (`reward_rewards` table seeded): 100 pts = 25 EGP off, 200 pts = free 10→16 page upgrade, 500 pts = free 10-page story.
- New `/_authenticated/rewards` page: balance, history, redemption catalog with "استبدل" buttons.
- Checkout: "استخدم نقاطك" toggle applying discount, stored as `points_used` + `points_discount_egp` on order.

---

## Milestone 3 — SEO & Content

### F7 — SEO landing pages + blog
- 8 static landing routes: `/stories-for-kids`, `/bedtime-stories`, `/educational-stories`, `/personalized-stories`, `/ai-kids-stories`, `/illustrated-kids-stories`, `/arabic-kids-stories`, `/custom-childrens-books`. Each has tailored Arabic+English meta, H1, intro, curated story grid (filtered by occasion/category), FAQ JSON-LD, CTA.
- Dynamic `/sitemap.xml` server route enumerating: home + landing pages + every published story + every blog post.
- Per-route canonical + OG + Twitter meta. Article JSON-LD on blog posts.
- New `blog_posts` table (slug, title, excerpt, cover_url, body_md, published_at, author). Admin CRUD under `/admin/blog`.
- `/blog` index + `/blog/$slug` route. Seed 5 starter posts on the listed topics.

---

## Open questions before I start coding

1. **Approve the 3-milestone split**, or want it merged/resequenced?
2. **Start with Milestone 1** (recommended — fastest revenue lift)?
3. **Rewards economics**: confirm 100→25 EGP, 200→size upgrade, 500→free 10-page story, +50 per order / +100 first / +30 review / +100 referral. OK or override?
4. **Occasion list**: 8 categories above match your plan exactly — add/remove any?
5. **Blog seed posts**: I write the 5 starter articles in Arabic myself, or you'll supply copy?

I won't touch code until you reply.
