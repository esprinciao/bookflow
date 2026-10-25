"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

export type StaffFormState = { error?: string };

function parseForm(formData: FormData): { name: string; email: string | null } | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Give this person a name.";
  if (name.length > 80) return "Keep the name under 80 characters.";

  const rawEmail = String(formData.get("email") ?? "").trim();
  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return "That email address doesn't look right.";
  }

  return { name, email: rawEmail || null };
}

export async function createStaff(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { business } = await requireBusiness();
  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .insert({ ...parsed, business_id: business.id });

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/availability");
  redirect("/staff");
}

export async function updateStaff(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { business } = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing staff id." };

  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  // See the note in services/actions.ts: without .select(), an update that
  // matches no rows reports success.
  const { data, error } = await supabase
    .from("staff")
    .update(parsed)
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "That person no longer exists, or isn't yours to edit." };
  }

  revalidatePath("/staff");
  revalidatePath("/availability");
  redirect("/staff");
}

/**
 * Deactivated, not deleted — same reasoning as services. Bookings reference
 * staff with ON DELETE RESTRICT so an appointment always knows who it was
 * with, even after that person leaves.
 */
export async function setStaffActive(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("staff")
    .update({ active })
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/staff");
  revalidatePath("/availability");
}
