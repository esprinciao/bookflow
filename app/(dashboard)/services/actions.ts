"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";

export type ServiceFormState = { error?: string };

type ParsedService = {
  name: string;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
};

function parseForm(formData: FormData, currency: string): ParsedService | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Give the service a name.";
  if (name.length > 80) return "Keep the name under 80 characters.";

  const duration = Number(formData.get("duration_minutes"));
  if (!Number.isInteger(duration) || duration <= 0) {
    return "Duration must be a whole number of minutes, greater than zero.";
  }
  if (duration > 24 * 60) return "Duration can't be longer than a day.";

  const buffer = Number(formData.get("buffer_minutes") || 0);
  if (!Number.isInteger(buffer) || buffer < 0) {
    return "Buffer must be zero or more whole minutes.";
  }

  const price = parseMoney(String(formData.get("price") ?? "0"), currency);
  if (price === null) return "Price doesn't look like a valid amount.";

  return {
    name,
    duration_minutes: duration,
    price_cents: price,
    buffer_minutes: buffer,
  };
}

export async function createService(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { business } = await requireBusiness();
  const parsed = parseForm(formData, business.currency);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .insert({ ...parsed, business_id: business.id });

  if (error) return { error: error.message };

  revalidatePath("/services");
  redirect("/services");
}

export async function updateService(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { business } = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing service id." };

  const parsed = parseForm(formData, business.currency);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  // RLS already restricts this to the caller's own rows. The business_id
  // filter is belt-and-braces: if a policy were ever loosened by mistake,
  // this still scopes the write to the current tenant.
  // .select() makes the update return the rows it touched. Without it a write
  // that matches nothing — because the row was deleted, or because it belongs
  // to another tenant — succeeds silently and the user is told their edit
  // saved when it did not.
  const { data, error } = await supabase
    .from("services")
    .update(parsed)
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That service no longer exists, or isn't yours to edit." };
  }

  revalidatePath("/services");
  redirect("/services");
}

/**
 * Services are deactivated, never deleted. Historical bookings reference them,
 * and the foreign key is ON DELETE RESTRICT precisely so that a past
 * appointment can still say what was booked.
 */
export async function setServiceActive(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("services")
    .update({ active })
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/services");
}
