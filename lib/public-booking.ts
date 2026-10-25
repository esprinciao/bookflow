import { createClient } from "@/lib/supabase/server";
import type { WeeklyWindow, Interval, BookedInterval } from "@/lib/availability";

/**
 * The anonymous read surface.
 *
 * Every call here goes through a SECURITY DEFINER function rather than a table,
 * because row-level security denies anonymous reads on all six tables and that
 * is deliberate — `bookings` holds customer names and email addresses. These
 * functions return exactly what a stranger may see and nothing else.
 */

export interface PublicService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  bufferMinutes: number;
}

export interface PublicStaff {
  id: string;
  name: string;
}

export interface BookingPageData {
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
  };
  services: PublicService[];
  staff: PublicStaff[];
}

export interface StaffAvailabilityData {
  rules: WeeklyWindow[];
  timeOff: Interval[];
  bookings: BookedInterval[];
}

export async function fetchBookingPage(
  slug: string,
): Promise<BookingPageData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_page", { p_slug: slug });
  if (error) throw new Error(`Could not load booking page: ${error.message}`);
  return (data as BookingPageData | null) ?? null;
}

export async function fetchStaffAvailability(
  staffId: string,
  from: Date,
  to: Date,
): Promise<StaffAvailabilityData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_availability", {
    p_staff_id: staffId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(`Could not load availability: ${error.message}`);
  return (data as StaffAvailabilityData) ?? { rules: [], timeOff: [], bookings: [] };
}
