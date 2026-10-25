-- Lets the booking page watch for the webhook landing.
--
-- After Checkout closes, the browser knows the customer paid but the booking
-- is still 'pending' until Razorpay's webhook reaches us — usually a second or
-- two. Without this the customer stares at an unresolved screen, or we lie and
-- claim confirmation we haven't got.
--
-- Returns a status and nothing else. The caller must already hold the booking
-- id, which is a v4 uuid they were handed; it exposes no name, no email, no
-- time, and cannot be used to enumerate bookings.
create or replace function public.booking_status(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('status', b.status)
  from public.bookings b
  where b.id = p_booking_id;
$$;

revoke execute on function public.booking_status(uuid) from public;
grant execute on function public.booking_status(uuid) to anon, authenticated;
