import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchBookingPage, fetchStaffAvailability } from "@/lib/public-booking";
import { generateSlots } from "@/lib/availability";
import { formatMoney } from "@/lib/money";
import { addDays, displayTimezone, todayInZone } from "@/lib/time";
import { ConfirmForm } from "@/components/booking/confirm-form";

const DAYS_AHEAD = 14;
const SLOT_INTERVAL_MINUTES = 15;
const MINIMUM_NOTICE_MINUTES = 30;

type Params = { slug: string };
type Query = { service?: string; staff?: string; date?: string; slot?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchBookingPage(slug);
  return page
    ? { title: `Book with ${page.business.name}` }
    : { title: "Booking page not found" };
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2.5 font-medium">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = await fetchBookingPage(slug);
  if (!page) notFound();

  const { business, services, staff } = page;
  const zone = business.timezone;

  const href = (next: Partial<Query>) => {
    const search = new URLSearchParams();
    const merged = { ...query, ...next };
    for (const key of ["service", "staff", "date", "slot"] as const) {
      const value = merged[key];
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    return `/book/${slug}${qs ? `?${qs}` : ""}`;
  };

  if (services.length === 0 || staff.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-4 text-muted">
          This business isn&apos;t taking online bookings just yet. Please check
          back shortly.
        </p>
      </main>
    );
  }

  const service = services.find((s) => s.id === query.service) ?? null;
  const member = staff.find((s) => s.id === query.staff) ?? null;

  // One instant for the whole render. Reading the clock in several places
  // could straddle midnight, leaving the day strip and the slots disagreeing
  // about what "today" is.
  const now = new Date();
  const today = todayInZone(zone, now);
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const selectedDate =
    query.date && dates.includes(query.date) ? query.date : null;

  // One availability fetch covers the whole window; slot generation itself is
  // a pure function, so running it fourteen times costs nothing.
  let slotsByDate = new Map<string, { startsAt: string; endsAt: string }[]>();
  if (service && member) {
    const to = new Date(now.getTime() + (DAYS_AHEAD + 1) * 86_400_000);
    const availability = await fetchStaffAvailability(member.id, now, to);

    slotsByDate = new Map(
      dates.map((date) => [
        date,
        generateSlots({
          date,
          timezone: zone,
          service: {
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
          },
          rules: availability.rules,
          timeOff: availability.timeOff,
          bookings: availability.bookings,
          slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
          minimumNoticeMinutes: MINIMUM_NOTICE_MINUTES,
          now,
        }),
      ]),
    );
  }

  const slots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];
  const chosenSlot = query.slot && slots.some((s) => s.startsAt === query.slot)
    ? query.slot
    : null;

  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, weekday: "short", day: "numeric", month: "short",
  });
  const timeLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const fullLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, dateStyle: "full", timeStyle: "short",
  });
  // A date string is noon-anchored before formatting so the weekday label can't
  // slip a day in zones far from UTC.
  const labelFor = (date: string) => dayLabel.format(new Date(`${date}T12:00:00Z`));

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Book with {business.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Times shown in {displayTimezone(zone)}. No account needed.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        <Step number={1} title="Choose a service">
          <ul className="space-y-2">
            {services.map((option) => {
              const active = option.id === service?.id;
              return (
                <li key={option.id}>
                  <Link
                    href={href({ service: option.id, date: undefined, slot: undefined })}
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-brand bg-brand-soft"
                        : "border-border hover:bg-surface"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{option.name}</span>
                      <span className="block text-sm text-muted">
                        {option.durationMinutes} min
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatMoney(option.priceCents, business.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Step>

        {service && (
          <Step number={2} title="Choose who with">
            <div className="flex flex-wrap gap-2">
              {staff.map((option) => (
                <Link
                  key={option.id}
                  href={href({ staff: option.id, date: undefined, slot: undefined })}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    option.id === member?.id
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border hover:bg-surface"
                  }`}
                >
                  {option.name}
                </Link>
              ))}
            </div>
          </Step>
        )}

        {service && member && (
          <Step number={3} title="Pick a day">
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                {dates.map((date) => {
                  const count = slotsByDate.get(date)?.length ?? 0;
                  const active = date === selectedDate;
                  return (
                    <Link
                      key={date}
                      href={count ? href({ date, slot: undefined }) : href({})}
                      aria-disabled={count === 0}
                      className={`min-w-20 shrink-0 rounded-xl border p-3 text-center transition-colors ${
                        active
                          ? "border-brand bg-brand-soft"
                          : count
                            ? "border-border hover:bg-surface"
                            : "pointer-events-none border-border opacity-40"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {labelFor(date)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {count ? `${count} free` : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </Step>
        )}

        {service && member && selectedDate && !chosenSlot && (
          <Step number={4} title="Pick a time">
            {slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
                Nothing free that day. Try another.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <Link
                    key={slot.startsAt}
                    href={href({ slot: slot.startsAt })}
                    className="rounded-lg border border-border py-2.5 text-center text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
                  >
                    {timeLabel.format(new Date(slot.startsAt))}
                  </Link>
                ))}
              </div>
            )}
          </Step>
        )}

        {service && member && chosenSlot && (
          <Step number={4} title="Your details">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{service.name}</p>
              <p className="mt-1 text-muted">
                {fullLabel.format(new Date(chosenSlot))} · {service.durationMinutes} min
                · with {member.name}
              </p>
              <p className="mt-1 text-muted">
                {formatMoney(service.priceCents, business.currency)}
              </p>
            </div>
            <ConfirmForm
              slug={slug}
              serviceId={service.id}
              staffId={member.id}
              startsAt={chosenSlot}
              backHref={href({ slot: undefined })}
              depositCents={Math.round(
                (service.priceCents * (business.depositPercent ?? 0)) / 100,
              )}
              currency={business.currency}
            />
          </Step>
        )}
      </div>
    </main>
  );
}
