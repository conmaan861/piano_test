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

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.studio_teacher_secrets (
  studio_slug text primary key references public.practice_studios(slug) on delete cascade,
  code_hash text not null
);

create table if not exists public.teacher_notes (
  id bigint generated always as identity primary key,
  studio_slug text not null,
  focus text not null default '',
  note text not null check (char_length(note) between 1 and 1000),
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.teacher_notes enable row level security;
revoke all on table public.teacher_notes from anon, authenticated;
grant select on table public.teacher_notes to anon, authenticated;
grant update on table public.teacher_notes to authenticated;

create policy "Public can view teacher notes"
on public.teacher_notes for select
to anon, authenticated
using (true);

create policy "Connor can complete teacher notes"
on public.teacher_notes for update
to authenticated
using (
  exists (
    select 1 from public.practice_studios
    where slug = teacher_notes.studio_slug
      and owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.practice_studios
    where slug = teacher_notes.studio_slug
      and owner_id = auth.uid()
  )
);

create or replace function public.add_teacher_note(
  p_slug text,
  p_access_code text,
  p_note text,
  p_focus text default '',
  p_due_date date default null
) returns bigint
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
  v_id bigint;
begin
  select code_hash into v_hash
  from private.studio_teacher_secrets
  where studio_slug = p_slug;

  if v_hash is null or extensions.crypt(p_access_code, v_hash) <> v_hash then
    raise exception 'Invalid teacher access code';
  end if;

  insert into public.teacher_notes (studio_slug, focus, note, due_date)
  values (p_slug, trim(coalesce(p_focus, '')), trim(p_note), p_due_date)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.set_teacher_access_code(
  p_slug text,
  p_access_code text
) returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if char_length(p_access_code) < 8 then
    raise exception 'Teacher access code must be at least 8 characters';
  end if;

  if not exists (
    select 1 from public.practice_studios
    where slug = p_slug and owner_id = auth.uid()
  ) then
    raise exception 'Only Connor can set the teacher access code';
  end if;

  insert into private.studio_teacher_secrets (studio_slug, code_hash)
  values (p_slug, extensions.crypt(p_access_code, extensions.gen_salt('bf')))
  on conflict (studio_slug) do update set code_hash = excluded.code_hash;
end;
$$;

create or replace function public.delete_teacher_note(
  p_slug text,
  p_access_code text,
  p_note_id bigint
) returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
begin
  select code_hash into v_hash
  from private.studio_teacher_secrets
  where studio_slug = p_slug;

  if v_hash is null or extensions.crypt(p_access_code, v_hash) <> v_hash then
    raise exception 'Invalid teacher access code';
  end if;

  delete from public.teacher_notes
  where id = p_note_id and studio_slug = p_slug;
end;
$$;

revoke all on function public.add_teacher_note(text, text, text, text, date) from public;
revoke all on function public.set_teacher_access_code(text, text) from public;
revoke all on function public.delete_teacher_note(text, text, bigint) from public;
grant execute on function public.add_teacher_note(text, text, text, text, date) to anon, authenticated;
grant execute on function public.set_teacher_access_code(text, text) to authenticated;
grant execute on function public.delete_teacher_note(text, text, bigint) to anon, authenticated;

-- Set the teacher access code privately in Supabase; never commit it here.
