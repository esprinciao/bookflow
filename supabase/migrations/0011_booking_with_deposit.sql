-- create_booking now understands deposits, and confirmation moves to a
-- separate function that anonymous callers cannot reach.

create or replace function public.create_booking(
  p_slug             text,
  p_service_id       uuid,
  p_staff_id         uuid,
  p_customer_name    text,
  p_customer_email   text,
  p_starts_at        timestamptz,
  p_payment_provider text default null,
  p_payment_order_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id     uuid;
  v_deposit_percent int;
  v_currency        text;
  v_duration        int;
  v_price           int;
  v_deposit         int;
  v_status          text;
  v_hold_until      timestamptz;
  v_ends_at         timestamptz;
  v_booking_id      uuid;
begin
  -- Release holds whose time is up before competing for the slot, so an
  -- abandoned checkout from twenty minutes ago is not still occupying it.
  perform public.release_expired_holds(p_staff_id);

  select b.id, b.deposit_percent, b.currency
    into v_business_id, v_deposit_percent, v_currency
    from public.businesses b where b.slug = p_slug;
  if v_business_id is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  select s.duration_minutes, s.price_cents into v_duration, v_price
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

  -- The deposit is computed HERE, from the business and service rows, and is
  -- never accepted from the caller. This function is reachable by anyone with
  -- the publishable key, so a caller-supplied amount would let someone send
  -- zero and walk away with a confirmed booking they never paid for.
  v_deposit := round(v_price * v_deposit_percent / 100.0);

  if v_deposit > 0 then
    v_status     := 'pending';
    v_hold_until := now() + interval '15 minutes';
  else
    v_status     := 'confirmed';
    v_hold_until := null;
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  insert into public.bookings (
    business_id, service_id, staff_id,
    customer_name, customer_email, starts_at, ends_at, status,
    payment_provider, payment_order_id, deposit_cents, hold_expires_at
  ) values (
    v_business_id, p_service_id, p_staff_id,
    trim(p_customer_name), lower(trim(p_customer_email)),
    p_starts_at, v_ends_at, v_status,
    case when v_deposit > 0 then p_payment_provider end,
    case when v_deposit > 0 then p_payment_order_id end,
    v_deposit, v_hold_until
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'id', v_booking_id,
    'startsAt', p_starts_at,
    'endsAt', v_ends_at,
    'status', v_status,
    'depositCents', v_deposit,
    'currency', v_currency
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirmation.
--
-- NOT granted to anon. If an anonymous caller could reach this, the entire
-- payment step would be decorative: anyone could confirm their own pending
-- booking by calling it with the order id they already know.
--
-- Only the webhook handler calls it, using the service role key, and only
-- after it has verified the provider's signature over the raw request body.
--
-- Idempotent, because webhooks retry. A second delivery of the same event
-- returns the same result instead of erroring or double-confirming.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking_payment(
  p_order_id   text,
  p_payment_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking
    from public.bookings
   where payment_order_id = p_order_id
   limit 1;

  if v_booking.id is null then
    return jsonb_build_object('status', 'unknown_order');
  end if;

  if v_booking.status = 'confirmed' then
    return jsonb_build_object('status', 'already_confirmed', 'id', v_booking.id);
  end if;

  if v_booking.status <> 'pending' then
    -- The hold expired and the slot was released, or the owner cancelled.
    -- The customer has paid for an appointment that no longer exists, so this
    -- has to be visible rather than silently swallowed.
    return jsonb_build_object('status', 'not_pending', 'id', v_booking.id,
                              'bookingStatus', v_booking.status);
  end if;

  update public.bookings
     set status            = 'confirmed',
         payment_reference = p_payment_id,
         hold_expires_at   = null
   where id = v_booking.id;

  return jsonb_build_object('status', 'confirmed', 'id', v_booking.id);
end;
$$;

revoke execute on function public.create_booking(text, uuid, uuid, text, text, timestamptz, text, text) from public;
grant execute on function public.create_booking(text, uuid, uuid, text, text, timestamptz, text, text) to anon, authenticated;

revoke execute on function public.confirm_booking_payment(text, text) from public, anon, authenticated;
grant execute on function public.confirm_booking_payment(text, text) to service_role;

-- booking_page gains the deposit percentage so the page can say what will be
-- charged before the customer commits.
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
      'timezone', b.timezone, 'currency', b.currency,
      'depositPercent', b.deposit_percent
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name,
               'durationMinutes', s.duration_minutes,
               'priceCents', s.price_cents,
               'bufferMinutes', s.buffer_minutes
             ) order by s.created_at)
      from public.services s where s.business_id = b.id and s.active
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name)
                       order by st.created_at)
      from public.staff st where st.business_id = b.id and st.active
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = p_slug;
$$;
