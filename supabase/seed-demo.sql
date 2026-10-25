-- Seeds a realistic demo business so a visiting client sees a working product
-- rather than an empty shell. The landing page links to /book/demo.
--
-- Idempotent: deletes the demo account first, which cascades away its
-- business, services, staff, rules and bookings. Re-run any time the demo gets
-- messed up. Touches nothing but the demo account.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed-demo.sql

begin;

delete from auth.users where email = 'demo@bookflow.example';

do $$
declare
  v_user_id    uuid := gen_random_uuid();
  v_business   uuid;
  v_aisha      uuid := gen_random_uuid();
  v_marco      uuid := gen_random_uuid();
  v_cut        uuid := gen_random_uuid();
  v_trim       uuid := gen_random_uuid();
  v_colour     uuid := gen_random_uuid();
  v_tz         text := 'Asia/Kolkata';
  v_today      date;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo@bookflow.example',
    extensions.crypt('demo-booking-2026', extensions.gen_salt('bf')), now(),
    '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('business_name', 'Lumen Hair Studio', 'timezone', v_tz),
    now(), now()
  );

  -- The signup trigger already created the business; make its slug predictable
  -- so the landing page can link straight to it.
  -- Razorpay settles in INR, so the demo prices in rupees. price_cents holds
  -- the smallest unit, which for INR is paise: 150000 is Rs 1,500.
  update public.businesses
     set slug = 'demo', currency = 'INR', deposit_percent = 20
   where owner_id = v_user_id
  returning id into v_business;

  insert into public.services (id, business_id, name, duration_minutes, price_cents, buffer_minutes, active) values
    (v_cut,    v_business, 'Cut & finish',        60, 150000,  15, true),
    (v_trim,   v_business, 'Quick trim',          20,  60000,   0, true),
    (v_colour, v_business, 'Colour & cut',       150, 400000,  30, true),
    (gen_random_uuid(), v_business, 'Bridal styling (seasonal)', 180, 800000, 30, false);

  insert into public.staff (id, business_id, name, email, active) values
    (v_aisha, v_business, 'Aisha Rahman', 'aisha@lumen.example', true),
    (v_marco, v_business, 'Marco Silva',  'marco@lumen.example', true);

  -- Aisha works Tuesday to Saturday; Marco Wednesday to Sunday. Overlapping
  -- but not identical, so the staff picker visibly changes the slots offered.
  insert into public.availability_rules (staff_id, day_of_week, start_time, end_time)
  select v_aisha, d, time '09:00', time '18:00' from unnest(array[2,3,4,5,6]) d
  union all
  select v_marco, d, time '11:00', time '19:00' from unnest(array[3,4,5,6,0]) d;

  v_today := (now() at time zone v_tz)::date;

  -- A long weekend off next week, so the date strip shows a real gap.
  insert into public.time_off (staff_id, starts_at, ends_at, reason)
  values (
    v_aisha,
    ((v_today + 9) + time '00:00') at time zone v_tz,
    ((v_today + 11) + time '23:59') at time zone v_tz,
    'Annual leave'
  );

  -- Bookings are placed by WEEKDAY, not by a blind day offset, so every one
  -- lands inside the hours that staff member actually works. Aisha is Tue-Sat
  -- and Marco Wed-Sun, so nobody works Monday — the studio is closed and the
  -- demo has to stay consistent with that.
  --
  -- next_dow: 1-7 days ahead.  prev_dow: 1-7 days back. Never today, so the
  -- seed cannot produce a time that has already passed this morning.
  insert into public.bookings
    (business_id, service_id, staff_id, customer_name, customer_email, starts_at, ends_at, status)
  select
    v_business, s.service_id, s.staff_id, s.customer_name, s.customer_email,
    (d.day + s.local_time) at time zone v_tz,
    (d.day + s.local_time) at time zone v_tz + make_interval(mins => s.duration),
    s.status
  from (values
    -- upcoming
    ( 2, true,  time '10:00', v_cut,    v_aisha, 'Hannah Blake',   'hannah.blake@example.com',   60, 'confirmed'),
    ( 2, true,  time '14:30', v_colour, v_aisha, 'Yusuf Demir',    'yusuf.demir@example.com',   150, 'confirmed'),
    ( 3, true,  time '11:30', v_trim,   v_marco, 'Grace Okafor',   'grace.okafor@example.com',   20, 'confirmed'),
    ( 3, true,  time '15:00', v_cut,    v_marco, 'Tom Whitfield',  'tom.whitfield@example.com',  60, 'confirmed'),
    ( 4, true,  time '09:30', v_cut,    v_aisha, 'Mei Lin Chen',   'meilin.chen@example.com',    60, 'confirmed'),
    ( 5, true,  time '16:00', v_colour, v_marco, 'Sofia Rossi',    'sofia.rossi@example.com',   150, 'confirmed'),
    ( 6, true,  time '12:00', v_cut,    v_aisha, 'Oliver Grant',   'oliver.grant@example.com',   60, 'cancelled'),
    -- already happened
    ( 5, false, time '13:00', v_cut,    v_aisha, 'Daniel Adeyemi', 'daniel.adeyemi@example.com', 60, 'confirmed'),
    ( 4, false, time '12:30', v_trim,   v_marco, 'Priya Nair',     'priya.nair@example.com',     20, 'confirmed')
  ) as s(target_dow, upcoming, local_time, service_id, staff_id, customer_name, customer_email, duration, status)
  cross join lateral (
    select case
      when s.upcoming then
        v_today + (((s.target_dow - extract(dow from v_today)::int + 6) % 7) + 1)
      else
        v_today - (((extract(dow from v_today)::int - s.target_dow + 6) % 7) + 1)
    end as day
  ) d;

  raise notice 'Seeded Lumen Hair Studio at /book/demo (INR, 20%% deposit)';
end $$;

commit;
