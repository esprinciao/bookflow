"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

/**
 * Cancels a booking.
 *
 * Status moves to 'cancelled' rather than the row being deleted: the customer
 * still booked it, the owner may need to see that it happened, and a deleted
 * row cannot answer "why was my appointment dropped?".
 *
 * Cancelling also frees the slot, because the exclusion constraint is partial
 * — it only covers confirmed rows — so the time becomes bookable again the
 * moment the status changes. No separate release step, and no window where
 * the slot is held by a booking nobody is coming to.
 */
export async function cancelBooking(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("business_id", business.id)
    .eq("status", "confirmed");

  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}
