-- What the business offers, and who delivers it.

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  duration_minutes int  not null check (duration_minutes > 0),
  price_cents      int  not null default 0 check (price_cents >= 0),
  buffer_minutes   int  not null default 0 check (buffer_minutes >= 0),
  active           bool not null default true,
  created_at       timestamptz not null default now()
);

comment on column public.services.buffer_minutes is
  'Cleanup/turnaround time reserved after the appointment. It is not shown to '
  'the customer and not charged for, but the next slot cannot start inside it.';

comment on column public.services.active is
  'Soft delete. Hard-deleting a service would orphan historical bookings that '
  'reference it, so services are deactivated instead and hidden from the '
  'booking page.';

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  email       text,
  active      bool not null default true,
  created_at  timestamptz not null default now()
);

create index on public.services (business_id) where active;
create index on public.staff (business_id) where active;
