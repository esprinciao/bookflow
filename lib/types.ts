/**
 * Hand-maintained mirror of supabase/migrations/.
 *
 * Kept by hand rather than generated so the shapes stay readable and carry the
 * same notes as the SQL. If the two ever drift, the migrations are the truth.
 */

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

/** 0 = Sunday … 6 = Saturday, matching JavaScript's Date#getDay(). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  /** IANA zone name, e.g. "Asia/Kolkata". */
  timezone: string;
  /** ISO 4217, uppercase. */
  currency: string;
  /** Percentage of the price taken up front. 0 means no payment at booking. */
  deposit_percent: number;
  created_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  /** Reserved after the appointment. Not shown to the customer, not charged. */
  buffer_minutes: number;
  active: boolean;
  created_at: string;
}

export interface Staff {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  staff_id: string;
  day_of_week: DayOfWeek;
  /** "HH:MM:SS", local to the business timezone — not an instant. */
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface TimeOff {
  id: string;
  staff_id: string;
  /** ISO 8601 instant. Unlike availability rules, these are absolute. */
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  business_id: string;
  service_id: string;
  staff_id: string;
  customer_name: string;
  customer_email: string;
  starts_at: string;
  /** Service duration only. The buffer is applied when generating slots. */
  ends_at: string;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

/** SQLSTATE raised when the no_double_booking exclusion constraint rejects a row. */
export const EXCLUSION_VIOLATION = "23P01";
