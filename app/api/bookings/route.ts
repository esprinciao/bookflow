import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchBookingPage,
  fetchStaffAvailability,
} from "@/lib/public-booking";
import { generateSlots } from "@/lib/availability";
import { EXCLUSION_VIOLATION } from "@/lib/types";
import { wallClockAt } from "@/lib/time";

/** Bookings must be at least this far ahead. */
const MINIMUM_NOTICE_MINUTES = 30;
const SLOT_INTERVAL_MINUTES = 15;

type Payload = {
  slug?: unknown;
  serviceId?: unknown;
  staffId?: unknown;
  startsAt?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
};

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return fail("Malformed request.", 400);
  }

  const slug = str(payload.slug);
  const serviceId = str(payload.serviceId);
  const staffId = str(payload.staffId);
  const startsAt = str(payload.startsAt);
  const customerName = str(payload.customerName);
  const customerEmail = str(payload.customerEmail);

  if (!slug || !serviceId || !staffId || !startsAt) {
    return fail("Missing booking details.", 400);
  }
  if (!customerName) return fail("Please give your name.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return fail("That email address doesn't look right.", 400);
  }

  const requested = new Date(startsAt);
  if (Number.isNaN(requested.getTime())) {
    return fail("That isn't a valid time.", 400);
  }

  const page = await fetchBookingPage(slug);
  if (!page) return fail("That booking page doesn't exist.", 404);

  const service = page.services.find((s) => s.id === serviceId);
  if (!service) return fail("That service isn't available.", 400);
  if (!page.staff.some((s) => s.id === staffId)) {
    return fail("That team member isn't available.", 400);
  }

  // Re-derive the offerable slots for the requested day and require the
  // requested time to be one of them. The browser is not trusted: without this
  // anyone could POST a 3am time, or a time inside someone's holiday, and the
  // exclusion constraint would happily accept it because nothing else is
  // booked then. The constraint prevents collisions, not nonsense.
  const timezone = page.business.timezone;
  const local = wallClockAt(requested, timezone);
  const date = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;

  const dayStart = new Date(requested.getTime() - 48 * 3600_000);
  const dayEnd = new Date(requested.getTime() + 48 * 3600_000);
  const availability = await fetchStaffAvailability(staffId, dayStart, dayEnd);

  const slots = generateSlots({
    date,
    timezone,
    service: {
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    },
    rules: availability.rules,
    timeOff: availability.timeOff,
    bookings: availability.bookings,
    slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
    minimumNoticeMinutes: MINIMUM_NOTICE_MINUTES,
  });

  if (!slots.some((slot) => slot.startsAt === requested.toISOString())) {
    return fail(
      "That time isn't available any more. Please pick another slot.",
      409,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: slug,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_customer_name: customerName,
    p_customer_email: customerEmail,
    p_starts_at: requested.toISOString(),
    });

  if (error) {
    // 23P01 is the exclusion constraint firing. Two customers tapped the same
    // slot close enough together that both passed the availability check above
    // — which is exactly the race application-level checking cannot close.
    // Postgres refused the second write, and this is where that refusal turns
    // into a sentence a person can act on.
    if (error.code === EXCLUSION_VIOLATION) {
      return fail(
        "Sorry — that slot was taken a moment before you confirmed. Please choose another time.",
        409,
      );
    }
    if (error.code === "P0002") {
      return fail("That service or team member is no longer available.", 409);
    }
    console.error("create_booking failed", error);
    return fail("Something went wrong creating your booking.", 500);
  }

  return NextResponse.json({ booking: data, service: service.name }, { status: 201 });
}

export const dynamic = "force-dynamic";
