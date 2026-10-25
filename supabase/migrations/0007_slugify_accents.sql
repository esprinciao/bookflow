-- "Café Niño" slugified to "caf-ni-o": accented letters were falling into the
-- non-alphanumeric class and becoming separators. Transliterate them first.

create extension if not exists unaccent with schema extensions;

-- Note the drop to STABLE. unaccent() depends on a text-search dictionary that
-- can be changed, so it is STABLE, not IMMUTABLE — and a function is only as
-- immutable as what it calls. Claiming IMMUTABLE here would be a lie that goes
-- unnoticed until someone builds an index on slugify() and it silently
-- disagrees with reality. Nothing indexes on it, so STABLE costs us nothing.
create or replace function public.slugify(value text)
returns text
language sql
stable
as $fn$
  select coalesce(
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(
            lower(extensions.unaccent(coalesce(value, ''))),
            $q$['’‘`´]$q$, '', 'g'
          ),
          '[^a-z0-9]+', '-', 'g'
        )
      ),
      ''
    ),
    'business'
  );
$fn$;
