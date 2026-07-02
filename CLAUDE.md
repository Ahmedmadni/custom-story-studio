# Kidzy (حكايتي) — Custom Story Studio

AI-personalized children's story platform for the Egyptian/Arabic market. Parents upload
a photo + details of their child; the app generates an illustrated, personalized story or
educational book (cartoon or photo-realistic-in-scene art), which is reviewed by an admin
and delivered as a print-ready PDF (and via WhatsApp).

This repo was scaffolded and is actively edited by **Lovable** (lovable.dev AI builder) —
see `.lovable/`. Claude Code sessions work on the same codebase; keep conventions below so
changes stay compatible with the Lovable toolchain.

## Tech stack

- **Framework**: TanStack Start (React 19) on Vite 7, file-based routing under `src/routes/`
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives) — RTL-first, Arabic UI
- **Backend**: Supabase (Postgres + Auth + Storage), accessed via `src/integrations/supabase/`
- **AI**: Lovable AI functions (`src/integrations/lovable/`) for story text + image generation
- **Package manager**: **bun** (`bunfig.toml` enforces a 24h supply-chain release-age guard —
  don't add packages published in the last 24h without asking the user first)
- **Deploy target**: Cloudflare (via nitro, configured in `@lovable.dev/vite-tanstack-config`)

## Commands

```bash
bun install        # install deps
bun run dev         # vite dev server
bun run build        # production build
bun run lint          # eslint .
bun run format         # prettier --write .
```

There is no test runner configured in `package.json` — don't assume `bun test` covers this app;
verify manually per `docs/QA-CHECKLIST.md` for anything touching auth, orders, admin, or PDF export.

## Architecture conventions

- **Routing**: file-based via TanStack Router. Read `src/routes/README.md` before adding routes —
  do not create `src/pages/` or Next.js/Remix-style directories. `src/routeTree.gen.ts` is
  generated; never hand-edit it. Routes under `_authenticated.*` require a logged-in user;
  `_authenticated.admin.*` additionally requires the `admin` role (see `has_role` RPC).
- **Feature folders**: business logic lives in `src/features/<domain>/`, each with a
  `*.functions.ts` file holding TanStack Start `createServerFn` server functions (admin, ai,
  cart, children, games, library, orders, payments, pdf, puzzles, rewards, stats).
- **Server-only code**: any module with secrets or server-only imports must end in `.server.ts`
  (e.g. `client.server.ts`, `config.server.ts`) — this is how Vite excludes it from the client
  bundle. Read `src/lib/config.server.ts` for the env-access pattern (wrap `process.env` reads in
  a function; Cloudflare Workers bind env per-request, not at module scope). Public config uses
  `import.meta.env.VITE_*`; never put secrets behind a `VITE_` prefix.
- **Path alias**: `@/*` → `src/*`.
- **Supabase**: schema lives in `supabase/migrations/*.sql` (plain numbered SQL files, no Prisma/
  Drizzle). Every table has RLS enabled with explicit policies + `GRANT`s — follow that pattern
  for new tables (see any recent migration for the template: enable RLS, grant to `authenticated`
  and `service_role`, add owner-scoped policy + admin-view policy). Generated TS types live in
  `src/integrations/supabase/types.ts`.
- **Design tokens**: reuse existing Tailwind tokens in `src/styles.css` — purple `#6C4DFF`
  primary, large rounded cards, soft shadows, mobile-first, Arabic RTL. Don't introduce a new
  color system.

## Current data model (Supabase, `public` schema)

`profiles`, `user_roles`, `story_templates`, `orders`, `generated_pages`, `payment_logs`,
`wizard_drafts`, `favorites`, `child_profiles`, `child_story_universe`, `child_story_history`,
`reward_accounts`, `reward_transactions`, `game_progress`, plus RPCs `has_role`, `award_points`,
`calc_child_level`, `complete_story_for_child`.

## Project status vs. the growth plan

`.lovable/plan.md` defines a 3-milestone growth plan. Status as observed in the current tree:

- **Milestone 1 (Conversion Boosters)** — implemented: `TrustCounters`, `OccasionStrip` +
  `story_occasion` enum, `favorites` table + `FavoriteButton`, `RecommendedStories` +
  `recommendations.functions.ts`.
- **Milestone 2 (Loyalty & Profiles)** — mostly implemented: `child_profiles` +
  `child_story_universe` (Story Hero / leveling, beyond the original plan's simpler scope),
  `/my-children` + create/edit routes, `reward_accounts`/`reward_transactions` + `award_points`,
  `/rewards` page. **Needs verification**: whether points redemption actually discounts checkout
  (`points_used` / `points_discount_egp` on `orders`) — no evidence of this wiring found yet.
- **Milestone 3 (SEO & Content)** — **not started**: no `blog_posts` table, no `/blog` routes,
  no SEO landing routes (`/stories-for-kids`, `/bedtime-stories`, etc.), no `/sitemap.xml` route.

See `docs/DEVELOPMENT-PLAN.md` for the actionable next-steps checklist derived from this.

## Safety / QA

- Run through `docs/QA-CHECKLIST.md` for any change touching auth, order flow, admin approval,
  or PDF export — it's the manual regression list for this app (in Arabic).
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or Lovable AI keys to the client bundle — only use
  them from `.server.ts` files.
- Storage bucket `child-photos` must stay owner-scoped via RLS — don't loosen storage policies
  without checking existing policy migrations first.
