import { DAY_NAMES, addDays } from "@/lib/time";
import type { BookingRow } from "@/lib/bookings";

/**
 * Seven columns, one per day, each listing that day's appointments.
 *
 * Grouping is done by formatting each booking into the business timezone and
 * reading the date back, rather than slicing the ISO string. An appointment at
 * 02:00 in Kolkata is the previous day in UTC, and slicing would file it under
 * the wrong column.
 */
export function WeekCalendar({
  bookings,
  weekStart,
  timezone,
}: {
  bookings: BookingRow[];
  weekStart: string;
  timezone: string;
}) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const grouped = new Map<string, BookingRow[]>(days.map((d) => [d, []]));
  for (const booking of bookings) {
    const key = dateKey.format(new Date(booking.starts_at));
    grouped.get(key)?.push(booking);
  }

  const dayNumber = (date: string) =>
    new Date(`${date}T12:00:00Z`).getUTCDate();

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="grid min-w-3xl grid-cols-7 gap-2">
        {days.map((date) => {
          const forDay = grouped.get(date) ?? [];
          const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
          return (
            <div
              key={date}
              className="rounded-xl border border-border p-3"
            >
              <p className="text-xs font-medium text-muted">
                {DAY_NAMES[weekday].slice(0, 3)} {dayNumber(date)}
              </p>
              {forDay.length === 0 ? (
                <p className="mt-2 text-xs text-muted">—</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {forDay.map((booking) => (
                    <li
                      key={booking.id}
                      className="rounded-lg bg-brand-soft px-2 py-1.5"
                    >
                      <p className="font-mono text-xs font-medium text-brand">
                        {timeLabel.format(new Date(booking.starts_at))}
                      </p>
                      <p className="truncate text-xs">{booking.customer_name}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
