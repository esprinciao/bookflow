/**
 * Timezone conversion built on Intl, which exists in every runtime this app
 * touches — Node on Vercel, and every browser. Temporal would be cleaner but
 * is not reliably present in serverless runtimes yet, and a ReferenceError in
 * production is a worse trade than thirty lines of offset arithmetic.
 *
 * The core idea: JavaScript Dates are absolute instants. A timezone is a
 * function from instant to wall-clock reading. We need the inverse — wall
 * clock to instant — and that inverse is not total: a reading can be missing
 * (the hour skipped at spring-forward) or ambiguous (the hour repeated at
 * fall-back).
 */

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23", // explicit: some ICU builds render midnight as "24"
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** What a clock in `timeZone` reads at the given instant. */
export function wallClockAt(instant: Date, timeZone: string): Wall {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** The zone's UTC offset at a given instant, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
  const w = wallClockAt(instant, timeZone);
  const parts = formatterFor(timeZone).formatToParts(instant);
  const second = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, second);
  // Dates carry milliseconds the formatter doesn't show; drop them from both
  // sides so the subtraction is a clean offset.
  return asIfUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

function readsBackAs(instant: Date, wall: Wall, timeZone: string): boolean {
  const back = wallClockAt(instant, timeZone);
  return (
    back.year === wall.year &&
    back.month === wall.month &&
    back.day === wall.day &&
    back.hour === wall.hour &&
    back.minute === wall.minute
  );
}

const ONE_DAY_MS = 86_400_000;

/**
 * Wall-clock reading in a zone -> absolute instant.
 *
 * This inverse is not a function in the mathematical sense, so both failure
 * modes are handled explicitly:
 *
 *   - Skipped (spring forward). "2026-03-29 01:30" in Europe/London never
 *     occurs; the clock jumps 01:00 -> 02:00. Returns null. Offering a
 *     customer a slot at a time that does not exist would store an instant an
 *     hour away from what both parties agreed to.
 *
 *   - Ambiguous (fall back). "2026-10-25 01:30" in Europe/London occurs
 *     twice, once in BST and again an hour later in GMT. Returns the earlier,
 *     which is what iCalendar and most calendar software do.
 *
 * A single offset guess cannot tell these apart, because the guess always
 * produces *an* answer. Instead we take the offsets in force a day either side
 * — which bracket any transition near this reading — build a candidate from
 * each, and keep only those that read back as the reading we asked for. Zero
 * survivors means skipped; two means ambiguous.
 */
export function instantFromWallClock(wall: Wall, timeZone: string): Date | null {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  );

  const bracketing = new Set([
    offsetAt(new Date(naive - ONE_DAY_MS), timeZone),
    offsetAt(new Date(naive + ONE_DAY_MS), timeZone),
  ]);

  const valid: number[] = [];
  for (const offset of bracketing) {
    const candidate = new Date(naive - offset);
    if (readsBackAs(candidate, wall, timeZone)) valid.push(candidate.getTime());
  }

  if (valid.length === 0) return null;
  return new Date(Math.min(...valid));
}

/** "YYYY-MM-DD" -> its parts. Calendar dates carry no timezone of their own. */
export function parseDateOnly(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** 0 = Sunday … 6 = Saturday, matching availability_rules.day_of_week. */
export function dayOfWeekFor(date: string): number {
  const { year, month, day } = parseDateOnly(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "HH:MM" or "HH:MM:SS" -> minutes since local midnight. */
export function minutesFromTimeString(time: string): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) throw new Error(`Expected a HH:MM[:SS] time, got "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Canonicalises legacy IANA aliases for display — Asia/Calcutta is what many
 * browsers still report, though the zone was renamed Asia/Kolkata in 1993.
 * Identical rules either way; this only affects what the owner reads.
 */
const ZONE_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
};

export function displayTimezone(timeZone: string): string {
  return ZONE_ALIASES[timeZone] ?? timeZone;
}

/**
 * Indexed to match availability_rules.day_of_week and Date#getDay().
 *
 * Lives here rather than beside the forms that render it: a "use client"
 * module can only export components to a Server Component. Plain values
 * imported across that boundary arrive as client-reference proxies, and the
 * failure is a runtime TypeError that typechecking cannot see.
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
