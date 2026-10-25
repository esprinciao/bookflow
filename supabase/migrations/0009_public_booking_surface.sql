-- The public booking page needs data, but every table denies anonymous reads
-- and that is correct: bookings holds customer names and email addresses.
--
-- So instead of loosening RLS, anonymous visitors get three SECURITY DEFINER
-- functions that return exactly what a stranger may see. The tables stay shut.
-- Note especially what is NOT returned: time_off.reason, and any customer
-- identity on existing bookings. A visitor learns only that a staff member is
-- busy between two instants, never who with.

-- ---------------------------------------------------------------------------
-- Everything needed to render /book/<slug>.
-- ---------------------------------------------------------------------------
create or replace function public.booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id, 'name', b.name, 'slug', b.slug,
      'timezone', b.timezone, 'currency', b.currency
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name,
               'durationMinutes', s.duration_minutes,
               'priceCents', s.price_cents,
               'bufferMinutes', s.buffer_minutes
             ) order by s.created_at)
      from public.services s
      where s.business_id = b.id and s.active
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name)
                       order by st.created_at)
      from public.staff st
      where st.business_id = b.id and st.active
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- The raw inputs the slot generator needs, anonymised.
-- ---------------------------------------------------------------------------
create or replace function public.staff_availability(
  p_staff_id uuid,
  p_from     timestamptz,
  p_to       timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dayOfWeek', r.day_of_week,
               'startTime', r.start_time::text,
               'endTime',   r.end_time::text))
      from public.availability_rules r
      where r.staff_id = p_staff_id
    ), '[]'::jsonb),

    -- Times only. The reason a person is away is nobody else's business.
    'timeOff', coalesce((
      select jsonb_agg(jsonb_build_object('startsAt', t.starts_at, 'endsAt', t.ends_at))
      from public.time_off t
      where t.staff_id = p_staff_id
        and t.ends_at > p_from and t.starts_at < p_to
    ), '[]'::jsonb),

    -- Busy intervals, carrying the buffer of whatever was booked so the
    -- generator can respect it. No customer name, no email, no service.
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', bk.starts_at,
               'endsAt',   bk.ends_at,
               'bufferMinutes', coalesce(sv.buffer_minutes, 0)))
      from public.bookings bk
      join public.services sv on sv.id = bk.service_id
      where bk.staff_id = p_staff_id
        and bk.status = 'confirmed'
        and bk.ends_at > p_from and bk.starts_at < p_to
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Creating the booking.
--
-- Anonymous customers have no INSERT policy on bookings, deliberately. This
-- function is the only way in, which means the integrity rules live in one
-- place: the service and staff must belong to this business and be active,
-- and the end time is derived from the stored duration rather than taken from
-- the request. A caller cannot book a 15-minute slot for a 3-hour service.
--
-- It does NOT re-check availability. Slot policy has one implementation, the
-- pure function in lib/availability.ts, and the API route verifies the
-- requested time against it before calling here. What this layer guarantees
-- is the thing application code cannot: no_double_booking raises 23P01 and
-- propagates to the caller untouched.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_slug           text,
  p_service_id     uuid,
  p_staff_id       uuid,
  p_customer_name  text,
  p_customer_email text,
  p_starts_at      timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_duration    int;
  v_ends_at     timestamptz;
  v_booking_id  uuid;
begin
  select b.id into v_business_id
    from public.businesses b where b.slug = p_slug;
  if v_business_id is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  select s.duration_minutes into v_duration
    from public.services s
   where s.id = p_service_id and s.business_id = v_business_id and s.active;
  if v_duration is null then
    raise exception 'service not available' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.staff st
     where st.id = p_staff_id and st.business_id = v_business_id and st.active
  ) then
    raise exception 'staff not available' using errcode = 'P0002';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  insert into public.bookings (
    business_id, service_id, staff_id,
    customer_name, customer_email, starts_at, ends_at, status
  ) values (
    v_business_id, p_service_id, p_staff_id,
    trim(p_customer_name), lower(trim(p_customer_email)),
    p_starts_at, v_ends_at, 'confirmed'
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'id', v_booking_id, 'startsAt', p_starts_at, 'endsAt', v_ends_at
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; make the surface explicit.
revoke execute on function public.booking_page(text) from public;
revoke execute on function public.staff_availability(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.create_booking(text, uuid, uuid, text, text, timestamptz) from public;

grant execute on function public.booking_page(text) to anon, authenticated;
grant execute on function public.staff_availability(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, uuid, text, text, timestamptz) to anon, authenticated;
