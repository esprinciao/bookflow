"use client";

import { useActionState } from "react";
import {
  addAvailabilityRule,
  addTimeOff,
  type AvailabilityFormState,
} from "@/app/(dashboard)/availability/actions";
import { SubmitButton } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { DAY_NAMES } from "@/lib/time";

export function AddRuleForm({ staffId }: { staffId: string }) {
  const [state, formAction] = useActionState<AvailabilityFormState, FormData>(
    addAvailabilityRule,
    {},
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-medium">Add working hours</h3>
      <FormError>{state.error}</FormError>
      <input type="hidden" name="staff_id" value={staffId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Day">
          <select
            name="day_of_week"
            defaultValue="1"
            className="block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
          >
            {DAY_NAMES.map((day, index) => (
              <option key={day} value={index}>{day}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <Input name="start_time" type="time" defaultValue="09:00" required />
        </Field>
        <Field label="Until">
          <Input name="end_time" type="time" defaultValue="17:00" required />
        </Field>
      </div>
      <SubmitButton pendingLabel="Adding…">Add hours</SubmitButton>
    </form>
  );
}

export function AddTimeOffForm({
  staffId,
  timezone,
}: {
  staffId: string;
  timezone: string;
}) {
  const [state, formAction] = useActionState<AvailabilityFormState, FormData>(
    addTimeOff,
    {},
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-medium">Block out time</h3>
      <p className="text-sm text-muted">
        Holidays, appointments, anything that overrides the weekly pattern.
        Times are in {timezone}.
      </p>
      <FormError>{state.error}</FormError>
      <input type="hidden" name="staff_id" value={staffId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From">
          <Input name="starts_at" type="datetime-local" required />
        </Field>
        <Field label="Until">
          <Input name="ends_at" type="datetime-local" required />
        </Field>
      </div>
      <Field label="Reason" hint="Optional, and only ever visible to you.">
        <Input name="reason" maxLength={120} placeholder="Annual leave" />
      </Field>
      <SubmitButton pendingLabel="Saving…">Block this time</SubmitButton>
    </form>
  );
}
