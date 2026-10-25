import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { fetchBookings, fetchBookingsBetween } from "@/lib/bookings";
import { WeekCalendar } from "@/components/dashboard/week-calendar";
import { formatMoney } from "@/lib/money";
import { addDays, displayTimezone, todayInZone } from "@/lib/time";

export const metadata: Metadata = { title: "Overview — BookFlow" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

const SETUP_STEPS = [
  {
    key: "services",
    title: "Add your services",
    body: "What you offer, how long each one takes, and what it costs.",
    href: "/services",
    cta: "Add a service",
  },
  {
    key: "staff",
    title: "Add your team",
    body: "Bookings are made against a person, even if that person is you.",
    href: "/staff",
    cta: "Add someone",
  },
  {
    key: "availability",
    title: "Set your weekly hours",
    body: "The hours you work each day. Block out time off when plans change.",
    href: "/availability",
    cta: "Set availability",
  },
] as const;

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const now = new Date();
  const zone = business.timezone;

  // The week starts on the Sunday on or before today, in the business's zone.
  const today = todayInZone(zone, now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekStart = addDays(today, -weekday);

  const [
    { count: serviceCount },
    { count: staffCount },
    { count: ruleCount },
    { count: upcomingCount },
    upcoming,
    thisWeek,
  ] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("availability_rules").select("id", { count: "exact", head: true }),
    // Counted separately rather than taken from the list below, which is
    // capped at five for display — a stat read off a LIMITed query silently
    // stops counting past the limit.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte("starts_at", now.toISOString()),
    fetchBookings({ businessId: business.id, scope: "upcoming", now, limit: 5 }),
    fetchBookingsBetween(
      business.id,
      new Date(`${weekStart}T00:00:00Z`),
      new Date(`${addDays(weekStart, 7)}T00:00:00Z`),
    ),
  ]);

  const done = {
    services: (serviceCount ?? 0) > 0,
    staff: (staffCount ?? 0) > 0,
    availability: (ruleCount ?? 0) > 0,
  };
  const outstanding = SETUP_STEPS.filter((step) => !done[step.key]);
  const ready = outstanding.length === 0;

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/book/${business.slug}`;
  const weekRevenue = thisWeek.reduce(
    (total, booking) => total + (booking.services?.price_cents ?? 0),
    0,
  );
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, dateStyle: "medium", timeStyle: "short",
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-2 text-muted">
          {ready
            ? "You're taking bookings."
            : "A few things left before you can take bookings."}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Your public booking page</h2>
        <p className="mt-1.5 font-mono text-sm break-all text-brand">
          {bookingUrl || `/book/${business.slug}`}
        </p>
        <p className="mt-2 text-sm text-muted">
          {ready
            ? "Share this link. Customers book without creating an account."
            : "Not live yet — finish the steps below first."}
        </p>
      </section>

      {!ready && (
        <ol className="grid gap-4 sm:grid-cols-3">
          {outstanding.map((step, index) => (
            <li key={step.key} className="flex flex-col rounded-xl border border-border p-5">
              <span className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-brand-soft text-sm font-medium text-brand">
                {index + 1}
              </span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{step.body}</p>
              <Link href={step.href} className="mt-4 text-sm font-medium text-brand hover:underline">
                {step.cta} →
              </Link>
            </li>
          ))}
        </ol>
      )}

      {ready && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Booked this week" value={String(thisWeek.length)} />
            <Stat label="Upcoming" value={String(upcomingCount ?? 0)} />
            <Stat
              label="This week's value"
              value={formatMoney(weekRevenue, business.currency)}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">This week</h2>
            <WeekCalendar bookings={thisWeek} weekStart={weekStart} timezone={zone} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">Next up</h2>
              <Link href="/bookings" className="text-sm font-medium text-brand hover:underline">
                All bookings →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
                Nothing booked yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {upcoming.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{booking.customer_name}</p>
                      <p className="text-sm text-muted">
                        {booking.services?.name ?? "Service removed"}
                        {booking.staff?.name ? ` · ${booking.staff.name}` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-muted">
                      {when.format(new Date(booking.starts_at))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="text-sm text-muted">
        Timezone:{" "}
        <span className="font-medium text-foreground">{displayTimezone(zone)}</span>.
        All times are stored in UTC and shown to you in this zone.
      </p>
    </div>
  );
}
