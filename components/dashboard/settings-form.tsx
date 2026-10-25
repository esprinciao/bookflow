"use client";

import { useActionState } from "react";
import {
  updateSettings,
  type SettingsState,
} from "@/app/(dashboard)/settings/actions";
import { SubmitButton } from "@/components/ui/button";
import { Field, FormError, FormNotice, Input } from "@/components/ui/field";
import type { Business } from "@/lib/types";

export function SettingsForm({ business }: { business: Business }) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateSettings,
    {},
  );

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      <FormError>{state.error}</FormError>
      {state.saved && <FormNotice>Saved.</FormNotice>}

      <Field label="Business name">
        <Input name="name" required maxLength={80} defaultValue={business.name} />
      </Field>

      <Field
        label="Deposit"
        hint="Percentage of the price taken when booking. 0 means customers book without paying."
      >
        <div className="flex items-center gap-2">
          <Input
            name="deposit_percent"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={business.deposit_percent}
            className="w-28"
          />
          <span className="text-sm text-muted">% of the service price</span>
        </div>
      </Field>

      <Field label="Currency" hint="Three-letter ISO code, e.g. INR, GBP, USD.">
        <Input
          name="currency"
          required
          maxLength={3}
          defaultValue={business.currency}
          className="w-28 uppercase"
        />
      </Field>

      <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata.">
        <Input name="timezone" required defaultValue={business.timezone} />
      </Field>

      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}
