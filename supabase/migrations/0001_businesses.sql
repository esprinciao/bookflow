-- Phase 2 groundwork: tenants, plus the trigger that creates one on signup.

create extension if not exists btree_gist;

-- Turns "Aisha's Hair Studio" into "aishas-hair-studio".
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g')), ''),
    'business'
  );
$$;

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now()
);

comment on column public.businesses.owner_id is
  'UNIQUE: one business per owner for now. Multi-tenant means many businesses '
  'isolated from each other, not many businesses per person. Relaxing this later '
  'is a migration plus a business-picker in the dashboard.';

comment on column public.businesses.timezone is
  'IANA name, e.g. Asia/Kolkata. Everything is stored in UTC; this is only used '
  'to decide what "9am Tuesday" means when generating and displaying slots.';

-- Creates the tenant row the moment a user signs up, so there is never a
-- signed-in user without a business.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  display_name    text;
  base_slug       text;
  try_slug        text;
  suffix          int := 1;
  failed_on       text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    split_part(new.email, '@', 1)
  );

  base_slug := public.slugify(display_name);
  try_slug  := base_slug;

  -- Same lesson as the booking constraint: don't SELECT-then-INSERT to check
  -- for a free slug, because two signups can both pass the check. Let the
  -- unique index be the arbiter and retry on the violation it raises.
  --
  -- Bounded, and only retries the *slug* collision. A duplicate owner_id means
  -- this user already has a business, which is a real error, not something to
  -- paper over by spinning.
  while suffix <= 50 loop
    begin
      insert into public.businesses (owner_id, name, slug, timezone)
      values (
        new.id,
        display_name,
        try_slug,
        coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC')
      );
      return new;
    exception when unique_violation then
      get stacked diagnostics failed_on = constraint_name;
      if failed_on is distinct from 'businesses_slug_key' then
        raise;
      end if;
      suffix   := suffix + 1;
      try_slug := base_slug || '-' || suffix;
    end;
  end loop;

  raise exception 'could not allocate a unique slug for % after 50 attempts', base_slug;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
