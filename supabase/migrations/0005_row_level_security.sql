-- Multi-tenant isolation. Every table is owner-scoped and denies by default.
--
-- Nothing here opens a public read path. The public booking page needs one, but
-- it gets added in Phase 5 as a narrow SECURITY DEFINER function returning
-- exactly the columns a stranger may see — not by making these tables readable.
-- Until then the correct behaviour for an anonymous visitor is "nothing".

-- Ownership checks live in SECURITY DEFINER helpers so that evaluating a policy
-- on `services` doesn't re-trigger the policy on `businesses` underneath it.
create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff s
    join public.businesses b on b.id = s.business_id
    where s.id = p_staff_id
      and b.owner_id = (select auth.uid())
  );
$$;

alter table public.businesses         enable row level security;
alter table public.services           enable row level security;
alter table public.staff              enable row level security;
alter table public.availability_rules enable row level security;
alter table public.time_off           enable row level security;
alter table public.bookings           enable row level security;

-- auth.uid() is wrapped in a scalar subquery throughout so Postgres evaluates it
-- once per statement as an InitPlan, rather than once per candidate row.

create policy "owner reads own business" on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "owner updates own business" on public.businesses
  for update to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Deliberately no INSERT or DELETE policy on businesses: rows are created only
-- by the signup trigger, and a tenant should not be able to delete itself out
-- from under its own bookings.

create policy "owner manages services" on public.services
  for all to authenticated
  using      (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "owner manages staff" on public.staff
  for all to authenticated
  using      (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "owner manages availability" on public.availability_rules
  for all to authenticated
  using      (public.owns_staff(staff_id))
  with check (public.owns_staff(staff_id));

create policy "owner manages time off" on public.time_off
  for all to authenticated
  using      (public.owns_staff(staff_id))
  with check (public.owns_staff(staff_id));

create policy "owner manages bookings" on public.bookings
  for all to authenticated
  using      (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- Defence in depth. Supabase grants table privileges to `anon` by default, and
-- RLS alone would already deny these reads; revoking makes the intent explicit
-- and means a future policy added by accident still can't expose the table.
revoke all on public.businesses         from anon;
revoke all on public.services           from anon;
revoke all on public.staff              from anon;
revoke all on public.availability_rules from anon;
revoke all on public.time_off           from anon;
revoke all on public.bookings           from anon;
