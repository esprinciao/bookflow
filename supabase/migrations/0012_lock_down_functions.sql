-- Security fixes found by auditing has_function_privilege('anon', ...) over
-- every function in the public schema.

-- ---------------------------------------------------------------------------
-- 1. The overload that would have made deposits optional.
--
-- 0011 added two parameters to create_booking with defaults. CREATE OR REPLACE
-- does not replace a function when the argument list changes — it creates a
-- second one. Both were live and both granted to anon, and the older 6-argument
-- version predates deposits: it confirms every booking immediately.
--
-- Anyone who knew the signature could have called it directly and walked away
-- with a confirmed appointment without paying. Drop it.
-- ---------------------------------------------------------------------------
drop function if exists public.create_booking(text, uuid, uuid, text, text, timestamptz);

-- ---------------------------------------------------------------------------
-- 2. Functions that were never meant to be part of the public API.
--
-- Supabase grants EXECUTE on functions in `public` to anon and authenticated
-- through default privileges, so REVOKE ... FROM PUBLIC does not remove it —
-- the grant to those roles is separate and has to be revoked by name.
-- ---------------------------------------------------------------------------

-- Releases other people's expired holds. Called internally by create_booking,
-- which is SECURITY DEFINER and so runs it regardless of the caller's rights.
revoke execute on function public.release_expired_holds(uuid) from public, anon, authenticated;

-- A trigger function. Invoking it outside a trigger is nonsense, but it runs
-- SECURITY DEFINER and writes to businesses, so it should not be exposed.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Used only by the signup trigger.
revoke execute on function public.slugify(text) from public, anon, authenticated;

-- RLS helpers. `authenticated` must keep EXECUTE because the policies call
-- them, but an anonymous caller has no business asking.
revoke execute on function public.owns_business(uuid) from public, anon;
revoke execute on function public.owns_staff(uuid) from public, anon;
