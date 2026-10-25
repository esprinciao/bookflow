-- Proves the claim the whole project rests on: overlapping confirmed bookings
-- for one staff member are impossible at the database level.
--
-- Runs entirely inside a transaction and rolls back, so it is safe against any
-- database including production.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/no_double_booking_test.sql

begin;

-- A tenant. The signup trigger on auth.users creates the business row for us,
-- which also exercises slug generation.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000aa',
  'owner@example.test',
  '{"business_name":"Aisha''s Hair Studio","timezone":"Asia/Kolkata"}'::jsonb
);

do $$
declare
  got_slug text;
begin
  select slug into got_slug from public.businesses
   where owner_id = '00000000-0000-0000-0000-0000000000aa';
  if got_slug is distinct from 'aishas-hair-studio' then
    raise exception 'FAIL: expected slug aishas-hair-studio, got %', got_slug;
  end if;
  raise notice 'PASS  signup trigger created business with slug %', got_slug;
end $$;

insert into public.staff (id, business_id, name)
select '00000000-0000-0000-0000-0000000000bb', id, 'Aisha'
  from public.businesses where owner_id = '00000000-0000-0000-0000-0000000000aa';

insert into public.services (id, business_id, name, duration_minutes, price_cents)
select '00000000-0000-0000-0000-0000000000cc', id, 'Cut and finish', 60, 250000
  from public.businesses where owner_id = '00000000-0000-0000-0000-0000000000aa';

-- Customer one takes 10:00-11:00.
insert into public.bookings
  (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
select b.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb',
       'Customer One', 'one@example.test',
       '2026-11-02 10:00+00', '2026-11-02 11:00+00', 'confirmed'
  from public.businesses b where b.owner_id = '00000000-0000-0000-0000-0000000000aa';

-- Customer two tries 10:30-11:30 with the same staff member. This is the race:
-- in an application-level check both requests could have seen the slot as free.
do $$
begin
  insert into public.bookings
    (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
  select b.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb',
         'Customer Two', 'two@example.test',
         '2026-11-02 10:30+00', '2026-11-02 11:30+00', 'confirmed'
    from public.businesses b where b.owner_id = '00000000-0000-0000-0000-0000000000aa';
  raise exception 'FAIL: overlapping confirmed booking was accepted';
exception when exclusion_violation then
  raise notice 'PASS  overlapping booking rejected with SQLSTATE 23P01';
end $$;

-- Adjacent, not overlapping. tstzrange is half-open [start, end), so a booking
-- starting exactly when another ends must be allowed.
do $$
begin
  insert into public.bookings
    (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
  select b.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb',
         'Customer Three', 'three@example.test',
         '2026-11-02 11:00+00', '2026-11-02 12:00+00', 'confirmed'
    from public.businesses b where b.owner_id = '00000000-0000-0000-0000-0000000000aa';
  raise notice 'PASS  back-to-back booking at the boundary accepted';
end $$;

-- The constraint is partial: it only covers confirmed rows. A pending booking
-- may overlap, which is what lets a Stripe checkout sit in flight without
-- holding the slot. Phase 6 has to reckon with that.
do $$
begin
  insert into public.bookings
    (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
  select b.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb',
         'Customer Four', 'four@example.test',
         '2026-11-02 10:15+00', '2026-11-02 11:15+00', 'pending'
    from public.businesses b where b.owner_id = '00000000-0000-0000-0000-0000000000aa';
  raise notice 'PASS  pending booking may overlap (constraint is partial)';
end $$;

-- A cancelled booking must free its slot again.
update public.bookings set status = 'cancelled'
 where customer_email = 'one@example.test';

do $$
begin
  insert into public.bookings
    (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
  select b.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb',
         'Customer Five', 'five@example.test',
         '2026-11-02 10:00+00', '2026-11-02 11:00+00', 'confirmed'
    from public.businesses b where b.owner_id = '00000000-0000-0000-0000-0000000000aa';
  raise notice 'PASS  cancelling a booking releases the slot';
end $$;

rollback;
