-- Occasion enum
do $$ begin
  create type public.story_occasion as enum (
    'birthday','graduation','ramadan','eid','back_to_school','bedtime','family','adventure'
  );
exception when duplicate_object then null; end $$;

alter table public.story_templates
  add column if not exists occasion public.story_occasion;

-- Favorites
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.story_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, template_id)
);

grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;

alter table public.favorites enable row level security;

create policy "users read own favorites"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

create policy "users add own favorites"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users remove own favorites"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists favorites_user_idx on public.favorites(user_id);
create index if not exists story_templates_occasion_idx on public.story_templates(occasion);