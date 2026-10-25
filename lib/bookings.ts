import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";

/** A booking joined to the names a human needs to read it. */
export interface BookingRow extends Booking {
  services: { name: string; price_cents: number } | null;
  staff: { name: string } | null;
}

const SELECT = "*, services(name, price_cents), staff(name)";

export async function fetchBookings(options: {
  businessId: string;
  /** "upcoming" and "past" both mean confirmed; "cancelled" is its own view. */
  scope: "upcoming" | "past" | "cancelled";
  now: Date;
  limit?: number;
}): Promise<BookingRow[]> {
  const supabase = await createClient();
  const nowIso = options.now.toISOString();

  let query = supabase
    .from("bookings")
    .select(SELECT)
    .eq("business_id", options.businessId);

  if (options.scope === "upcoming") {
    query = query
      .eq("status", "confirmed")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true });
  } else if (options.scope === "past") {
    query = query
      .eq("status", "confirmed")
      .lt("starts_at", nowIso)
      .order("starts_at", { ascending: false });
  } else {
    query = query
      .eq("status", "cancelled")
      .order("starts_at", { ascending: false });
  }

  const { data, error } = await query
    .limit(options.limit ?? 100)
    .returns<BookingRow[]>();

  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return data ?? [];
}

/** Confirmed bookings inside a window, for the weekly calendar. */
export async function fetchBookingsBetween(
  businessId: string,
  from: Date,
  to: Date,
): Promise<BookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("business_id", businessId)
    .eq("status", "confirmed")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true })
    .returns<BookingRow[]>();

  if (error) throw new Error(`Could not load the calendar: ${error.message}`);
  return data ?? [];
}
