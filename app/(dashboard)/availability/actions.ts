"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { instantFromWallClock, minutesFromTimeString } from "@/lib/time";

export type AvailabilityFormState = { error?: string };

/** Confirms the staff member belongs to the caller's business before writing. */
async function assertOwnsStaff(staffId: string): Promise<boolean> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  return Boolean(data);
}

export async function addAvailabilityRule(
  _prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const staffId = String(formData.get("staff_id") ?? "");
  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!staffId) return { error: "Pick a team member first." };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "That isn't a valid day." };
  }

  let startMinutes: number;
  let endMinutes: number;
  try {
    startMinutes = minutesFromTimeString(startTime);
    endMinutes = minutesFromTimeString(endTime);
  } catch {
    return { error: "Enter both a start and an end time." };
  }
  if (endMinutes <= startMinutes) {
    return { error: "The finish time has to be after the start time." };
  }

  if (!(await assertOwnsStaff(staffId))) {
    return { error: "That team member isn't yours to edit." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert({
    staff_id: staffId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: error.message };

  revalidatePath("/availability");
  redirect(`/availability?staff=${staffId}`);
}

export async function deleteAvailabilityRule(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!id || !(await assertOwnsStaff(staffId))) return;

  const supabase = await createClient();
  // RLS scopes this to the owner's own staff; the staff_id filter makes the
  // intent explicit and stops a mismatched pair deleting anything.
  await supabase
    .from("availability_rules")
    .delete()
    .eq("id", id)
    .eq("staff_id", staffId);

  revalidatePath("/availability");
}

export async function addTimeOff(
  _prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const staffId = String(formData.get("staff_id") ?? "");
  const startsLocal = String(formData.get("starts_at") ?? "");
  const endsLocal = String(formData.get("ends_at") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!staffId) return { error: "Pick a team member first." };

  const { business } = await requireBusiness();

  // <input type="datetime-local"> yields a wall-clock reading with no zone.
  // It means "9am where the business is", so it is resolved against the
  // business timezone — not the server's, and not the visitor's.
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return instantFromWallClock(
      {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        hour: Number(match[4]),
        minute: Number(match[5]),
      },
      business.timezone,
    );
  };

  const startsAt = parse(startsLocal);
  const endsAt = parse(endsLocal);

  if (!startsAt || !endsAt) {
    return {
      error:
        "Enter both a start and an end. If a time looks valid, it may be an hour that doesn't exist on a clock-change day — pick another.",
    };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { error: "The end has to be after the start." };
  }

  if (!(await assertOwnsStaff(staffId))) {
    return { error: "That team member isn't yours to edit." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("time_off").insert({
    staff_id: staffId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: reason || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/availability");
  redirect(`/availability?staff=${staffId}`);
}

export async function deleteTimeOff(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!id || !(await assertOwnsStaff(staffId))) return;

  const supabase = await createClient();
  await supabase.from("time_off").delete().eq("id", id).eq("staff_id", staffId);

  revalidatePath("/availability");
}
