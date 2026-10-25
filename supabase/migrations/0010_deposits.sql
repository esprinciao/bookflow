-- Phase 6: deposits.
--
-- Columns are named for the job, not the vendor. The original schema had
-- stripe_payment_intent_id; Stripe is invite-only in India, so this project
-- uses Razorpay. A booking needs to record "which payment, at which provider"
-- — not "which Stripe object".

alter table public.bookings
  rename column stripe_payment_intent_id to payment_reference;

alter table public.bookings
  add column payment_provider text check (payment_provider in ('razorpay')),
  add column payment_order_id text,
  add column deposit_cents int not null default 0 check (deposit_cents >= 0),
  add column hold_expires_at timestamptz;

comment on column public.bookings.payment_order_id is
  'The provider order the customer was sent to pay. Recorded before they pay '
  'so an incoming webhook can be matched back to a booking.';

comment on column public.bookings.payment_reference is
  'The provider payment id, set once payment is confirmed by webhook.';

comment on column public.bookings.hold_expires_at is
  'When a pending booking stops holding its slot. Null for confirmed rows.';

alter table public.businesses
  add column deposit_percent int not null default 0
    check (deposit_percent between 0 and 100);

comment on column public.businesses.deposit_percent is
  'Percentage of the service price taken up front. 0 means book without '
  'paying, and the booking is confirmed immediately.';

-- ---------------------------------------------------------------------------
-- The constraint has to widen.
--
-- Until now it covered only confirmed rows, which was right when every booking
-- was confirmed on insert. With deposits a booking is created as 'pending'
-- while the customer is away at the payment page — and two customers could
-- hold pending rows for the same slot, both pay, and the second confirmation
-- would fail. They would have paid for an appointment that does not exist.
--
-- So a pending booking must hold the slot too. The cost is that an abandoned
-- checkout would hold it forever, which is what hold_expires_at is for:
-- expired holds are released before each new booking attempt.
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint no_double_booking;

alter table public.bookings add constraint no_double_booking
  exclude using gist (
    staff_id                      with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'));

create index on public.bookings (hold_expires_at)
  where status = 'pending';

-- Releases holds whose time is up. Called before taking a new booking, so a
-- customer who abandoned checkout twenty minutes ago is not still occupying a
-- slot someone else is trying to book.
create or replace function public.release_expired_holds(p_staff_id uuid default null)
returns int
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with released as (
    update public.bookings
       set status = 'cancelled'
     where status = 'pending'
       and hold_expires_at is not null
       and hold_expires_at < now()
       and (p_staff_id is null or staff_id = p_staff_id)
    returning 1
  )
  select count(*)::int from released;
$$;

revoke execute on function public.release_expired_holds(uuid) from public;
