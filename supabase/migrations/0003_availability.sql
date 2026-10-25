-- When staff work, and when they don't.

create table public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff(id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  constraint availability_rule_ordered check (start_time < end_time)
);

comment on table public.availability_rules is
  'The recurring weekly pattern. day_of_week is 0=Sunday..6=Saturday, matching '
  'JavaScript getDay(). Times are LOCAL to the business timezone, deliberately '
  'stored as `time` rather than timestamptz: "I work 9-5 on Tuesdays" is a '
  'statement about wall-clock time that stays true across DST changes.';

create index on public.availability_rules (staff_id, day_of_week);

create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint time_off_ordered check (starts_at < ends_at)
);

comment on table public.time_off is
  'One-off exceptions that subtract from the weekly pattern. Unlike '
  'availability_rules these ARE absolute instants, so timestamptz is correct.';

create index on public.time_off (staff_id, starts_at, ends_at);
