-- staff_availability reported only confirmed bookings, so a slot being held by
-- someone mid-checkout was still offered to everyone else. They would pick it,
-- type in their details, and only then be told it was taken — by the exclusion
-- constraint, which has covered pending rows since 0010.
--
-- The availability view has to agree with what the constraint enforces.
-- Expired holds are excluded here too: the row is still 'pending' until
-- release_expired_holds sweeps it, but it is no longer holding anything.

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

    'timeOff', coalesce((
      select jsonb_agg(jsonb_build_object('startsAt', t.starts_at, 'endsAt', t.ends_at))
      from public.time_off t
      where t.staff_id = p_staff_id
        and t.ends_at > p_from and t.starts_at < p_to
    ), '[]'::jsonb),

    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', bk.starts_at,
               'endsAt',   bk.ends_at,
               'bufferMinutes', coalesce(sv.buffer_minutes, 0)))
      from public.bookings bk
      join public.services sv on sv.id = bk.service_id
      where bk.staff_id = p_staff_id
        and (
          bk.status = 'confirmed'
          or (bk.status = 'pending'
              and bk.hold_expires_at is not null
              and bk.hold_expires_at > now())
        )
        and bk.ends_at > p_from and bk.starts_at < p_to
    ), '[]'::jsonb)
  );
$$;
