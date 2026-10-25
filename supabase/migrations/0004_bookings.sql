-- Bookings, and the constraint that is the point of the whole project.

create table public.bookings (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses(id) on delete cascade,
  service_id               uuid not null references public.services(id) on delete restrict,
  staff_id                 uuid not null references public.staff(id)    on delete restrict,
  customer_name            text not null check (length(trim(customer_name)) > 0),
  customer_email           text not null check (position('@' in customer_email) > 1),
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  status                   text not null default 'confirmed'
                             check (status in ('pending','confirmed','cancelled','completed')),
  stripe_payment_intent_id text,
  created_at               timestamptz not null default now(),
  constraint booking_ordered check (starts_at < ends_at)
);

comment on column public.bookings.ends_at is
  'Includes the service duration only, NOT the buffer. The buffer is applied '
  'when generating offerable slots, so it shrinks availability without '
  'misrepresenting the appointment length to the customer.';

comment on column public.bookings.service_id is
  'ON DELETE RESTRICT, not CASCADE: deleting a service must not silently erase '
  'the history of appointments that were sold under it. Services are '
  'deactivated instead.';

-- ---------------------------------------------------------------------------
-- The heart of it.
--
-- "Check whether the slot is free, then insert the booking" is two statements.
-- Two customers can both run the check, both see the slot as free, and both
-- insert — because nothing stops the second check from happening before the
-- first insert commits. The window is small; it is not zero, and the failure
-- is two people in one chair.
--
-- An exclusion constraint makes the write itself the check. Postgres refuses
-- any row whose (staff_id, time range) overlaps an existing confirmed row, and
-- it does so under the same lock that performs the insert, so there is no gap
-- to race in. The loser gets SQLSTATE 23P01, which the API turns into
-- "that slot was just taken".
--
-- btree_gist is required because `staff_id WITH =` compares a uuid, and GiST
-- has no native equality operator class for uuid without it.
-- ---------------------------------------------------------------------------
alter table public.bookings add constraint no_double_booking
  exclude using gist (
    staff_id                          with =,
    tstzrange(starts_at, ends_at)     with &&
  ) where (status = 'confirmed');

create index on public.bookings (business_id, starts_at desc);
create index on public.bookings (staff_id, starts_at);
