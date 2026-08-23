create table if not exists public.practice_studios (
  slug text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.practice_studios enable row level security;

revoke all on table public.practice_studios from anon, authenticated;
grant select on table public.practice_studios to anon, authenticated;
grant insert, update on table public.practice_studios to authenticated;

create policy "Public can view the piano studio"
on public.practice_studios for select
to anon, authenticated
using (true);

create policy "Owner can create the piano studio"
on public.practice_studios for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owner can update the piano studio"
on public.practice_studios for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
