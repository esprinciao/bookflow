"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean };

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { business } = await requireBusiness();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Your business needs a name." };

  const depositPercent = Number(formData.get("deposit_percent"));
  if (!Number.isInteger(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    return { error: "Deposit must be a whole percentage between 0 and 100." };
  }

  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Currency must be a three-letter code, like INR or GBP." };
  }

  const timezone = String(formData.get("timezone") ?? "").trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "That doesn't look like a valid timezone." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({ name, deposit_percent: depositPercent, currency, timezone })
    .eq("id", business.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Couldn't save your settings." };

  revalidatePath("/", "layout");
  return { saved: true };
}
