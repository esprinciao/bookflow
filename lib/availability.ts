import {
  dayOfWeekFor,
  instantFromWallClock,
  minutesFromTimeString,
  parseDateOnly,
} from "@/lib/time";

/**
 * Slot generation.
 *
 * Deliberately pure: everything it needs arrives as arguments, and it returns
 * plain data. No Supabase client, no `new Date()` it didn't receive, no React.
 * That is what makes the awkward cases — DST, buffers, back-to-back
 * appointments — testable without a database or a browser, and it is the
 * reason this logic lives here rather than inside the booking page.
 */

export interface WeeklyWindow {
  dayOfWeek: number;
  /** "HH:MM[:SS]", local to the business timezone. */
  startTime: string;
  endTime: string;
}

export interface Interval {
  startsAt: string;
  endsAt: string;
}

export interface BookedInterval extends Interval {
  /** Trailing buffer of the service that was booked, in minutes. */
  bufferMinutes: number;
}

export interface SlotRequest {
  /** Calendar date in the business's timezone, "YYYY-MM-DD". */
  date: string;
  /** IANA zone name. */
  timezone: string;
  service: { durationMinutes: number; bufferMinutes: number };
  /** All weekly rules for the staff member; irrelevant days are ignored. */
  rules: WeeklyWindow[];
  timeOff: Interval[];
  /** Existing confirmed bookings for this staff member. */
  bookings: BookedInterval[];
  /** Granularity of offered start times. Defaults to 15 minutes. */
  slotIntervalMinutes?: number;
  /** Treated as "now". Defaults to the real clock. */
  now?: Date;
  /** How far ahead a booking must be made. Defaults to none. */
  minimumNoticeMinutes?: number;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
}

const MINUTE_MS = 60_000;

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

/**
 * Resolves a wall-clock reading, stepping forward if that reading is inside a
 * DST gap. A salon that opens at 02:00 on the night the clocks skip 02:00-03:00
 * opens at 03:00; it does not fail to open.
 */
function resolveForward(
  date: { year: number; month: number; day: number },
  totalMinutes: number,
  timeZone: string,
): Date | null {
  for (let nudge = 0; nudge <= 180; nudge++) {
    const minutes = totalMinutes + nudge;
    const instant = instantFromWallClock(
      {
        year: date.year,
        month: date.month,
        day: date.day,
        hour: Math.floor(minutes / 60) % 24,
        minute: minutes % 60,
      },
      timeZone,
    );
    if (instant) return instant;
  }
  return null;
}

export function generateSlots(request: SlotRequest): Slot[] {
  const {
    date,
    timezone,
    service,
    rules,
    timeOff,
    bookings,
    slotIntervalMinutes = 15,
    now = new Date(),
    minimumNoticeMinutes = 0,
  } = request;

  if (service.durationMinutes <= 0) return [];

  const parts = parseDateOnly(date);
  const dayOfWeek = dayOfWeekFor(date);
  const earliest = now.getTime() + minimumNoticeMinutes * MINUTE_MS;

  // Precompute everything that blocks a slot, as absolute instants. Each
  // existing booking blocks its own duration plus the buffer of the service it
  // was booked under — not the buffer of the service being booked now.
  const blocked: Array<[number, number]> = [
    ...timeOff.map(
      (off) =>
        [Date.parse(off.startsAt), Date.parse(off.endsAt)] as [number, number],
    ),
    ...bookings.map(
      (booking) =>
        [
          Date.parse(booking.startsAt),
          Date.parse(booking.endsAt) + booking.bufferMinutes * MINUTE_MS,
        ] as [number, number],
    ),
  ].filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end));

  const byStart = new Map<number, Slot>();

  for (const rule of rules) {
    if (rule.dayOfWeek !== dayOfWeek) continue;

    const openMinutes = minutesFromTimeString(rule.startTime);
    const closeMinutes = minutesFromTimeString(rule.endTime);
    if (closeMinutes <= openMinutes) continue;

    const closesAt = resolveForward(parts, closeMinutes, timezone);
    if (!closesAt) continue;

    for (
      let minutes = openMinutes;
      minutes + service.durationMinutes <= closeMinutes;
      minutes += slotIntervalMinutes
    ) {
      // Step in wall-clock minutes so slots land on round local times (09:00,
      // 09:15, …) rather than drifting by an hour across a DST boundary.
      const startsAt = instantFromWallClock(
        {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hour: Math.floor(minutes / 60) % 24,
          minute: minutes % 60,
        },
        timezone,
      );
      // A reading inside a DST gap is simply not a bookable time.
      if (!startsAt) continue;

      const startMs = startsAt.getTime();
      const endMs = startMs + service.durationMinutes * MINUTE_MS;

      // The appointment itself must finish before closing — compared as real
      // instants, because wall-clock arithmetic lies across a transition.
      if (endMs > closesAt.getTime()) continue;

      if (startMs < earliest) continue;

      // The slot occupies its duration plus this service's own buffer, so a
      // 15-minute cleanup can't be swallowed by the next appointment.
      const occupiedEnd = endMs + service.bufferMinutes * MINUTE_MS;
      if (blocked.some(([bs, be]) => overlaps(startMs, occupiedEnd, bs, be))) {
        continue;
      }

      // Overlapping rules for the same day would otherwise offer a slot twice.
      if (!byStart.has(startMs)) {
        byStart.set(startMs, {
          startsAt: startsAt.toISOString(),
          endsAt: new Date(endMs).toISOString(),
        });
      }
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, slot]) => slot);
}
