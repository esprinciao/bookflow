import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { fetchBookings } from "@/lib/bookings";
import { cancelBooking } from "@/app/(dashboard)/bookings/actions";
import { SubmitButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { displayTimezone } from "@/lib/time";

export const metadata: Metadata = { title: "Bookings — BookFlow" };

const SCOPES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type Scope = (typeof SCOPES)[number]["key"];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const [{ business }, params] = await Promise.all([
    requireBusiness(),
    searchParams,
  ]);

  const scope = (SCOPES.find((s) => s.key === params.scope)?.key ??
    "upcoming") as Scope;
  const now = new Date();
  const bookings = await fetchBookings({
    businessId: business.id,
    scope,
    now,
  });

  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: business.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });

  const emptyCopy: Record<Scope, string> = {
    upcoming:
      "Nothing booked yet. Share your booking link and appointments will land here.",
    past: "No past appointments.",
    cancelled: "Nothing has been cancelled.",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-2 text-muted">
          Times shown in {displayTimezone(business.timezone)}.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {SCOPES.map((option) => (
          <Link
            key={option.key}
            href={`/bookings?scope=${option.key}`}
            className={
              option.key === scope
                ? "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"
                : "rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface"
            }
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">Nothing here</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {emptyCopy[scope]}
          </p>
          {scope === "upcoming" && (
            <p className="mt-4 font-mono text-sm text-brand">
              /book/{business.slug}
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-5"
            >
              <div className="min-w-0">
                <p className="font-medium">{booking.customer_name}</p>
                <p className="mt-0.5 text-sm break-all text-muted">
                  <a
                    href={`mailto:${booking.customer_email}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {booking.customer_email}
                  </a>
                </p>
                <p className="mt-2 text-sm">
                  {when.format(new Date(booking.starts_at))}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {booking.services?.name ?? "Service removed"}
                  {booking.staff?.name ? ` · with ${booking.staff.name}` : ""}
                  {booking.services
                    ? ` · ${formatMoney(booking.services.price_cents, business.currency)}`
                    : ""}
                </p>
              </div>
              {scope === "upcoming" && (
                <form action={cancelBooking}>
                  <input type="hidden" name="id" value={booking.id} />
                  <SubmitButton variant="danger" pendingLabel="Cancelling…">
                    Cancel
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {scope === "upcoming" && bookings.length > 0 && (
        <p className="text-sm text-muted">
          Cancelling frees the slot immediately — the exclusion constraint only
          covers confirmed bookings, so the time becomes bookable again the
          moment the status changes.
        </p>
      )}
    </div>
  );
}
