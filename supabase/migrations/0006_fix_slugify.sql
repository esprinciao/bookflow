-- slugify turned apostrophes into separators: "Aisha's Hair Studio" became
-- "aisha-s-hair-studio" rather than "aishas-hair-studio". Strip quote
-- characters entirely before collapsing everything else into hyphens, which is
-- what every slug library does and what reads correctly in a URL.

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $fn$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(lower(coalesce(value, '')), $q$['’‘`´]$q$, '', 'g'),
          '[^a-z0-9]+', '-', 'g'
        )
      ),
      ''
    ),
    'business'
  );
$fn$;

-- Also guard the display name. Supabase anonymous sign-ins have no email, so
-- split_part(null,'@',1) would be null and the insert would fail the NOT NULL
-- on businesses.name — breaking signup entirely rather than degrading.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  display_name text;
  base_slug    text;
  try_slug     text;
  suffix       int := 1;
  failed_on    text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'My business'
  );

  base_slug := public.slugify(display_name);
  try_slug  := base_slug;

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

-- schema_migrations is bookkeeping for scripts/migrate.sh and is reached only
-- over the direct Postgres connection. No policies, so RLS denies everyone
-- except roles that bypass it.
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
