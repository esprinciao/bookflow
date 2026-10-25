"use client";

import { Field, Input } from "@/components/ui/field";
import type { Service } from "@/lib/types";
import { toMoneyInput } from "@/lib/money";

export function ServiceFields({
  service,
  currency,
}: {
  service?: Service;
  currency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Service name">
          <Input
            name="name"
            required
            maxLength={80}
            defaultValue={service?.name}
            placeholder="Cut and finish"
          />
        </Field>
      </div>

      <Field label="Duration" hint="Minutes the appointment actually takes.">
        <Input
          name="duration_minutes"
          type="number"
          min={1}
          max={1440}
          step={1}
          required
          defaultValue={service?.duration_minutes ?? 30}
        />
      </Field>

      <Field label={`Price (${currency})`} hint="Use 0 for free consultations.">
        <Input
          name="price"
          type="text"
          inputMode="decimal"
          required
          defaultValue={toMoneyInput(service?.price_cents ?? 0, currency)}
        />
      </Field>

      <Field
        label="Buffer"
        hint="Cleanup time after. Blocks the next slot, not charged."
      >
        <Input
          name="buffer_minutes"
          type="number"
          min={0}
          max={240}
          step={1}
          defaultValue={service?.buffer_minutes ?? 0}
        />
      </Field>
    </div>
  );
}
