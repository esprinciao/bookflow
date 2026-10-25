"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createStaff,
  updateStaff,
  type StaffFormState,
} from "@/app/(dashboard)/staff/actions";
import { SubmitButton } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import type { Staff } from "@/lib/types";

export function StaffForm({ member }: { member?: Staff }) {
  const [state, formAction] = useActionState<StaffFormState, FormData>(
    member ? updateStaff : createStaff,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {member && <input type="hidden" name="id" value={member.id} />}
      <FormError>{state.error}</FormError>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            required
            maxLength={80}
            defaultValue={member?.name}
            placeholder="Aisha"
          />
        </Field>
        <Field label="Email" hint="Optional. For booking notifications later.">
          <Input
            name="email"
            type="email"
            defaultValue={member?.email ?? ""}
            placeholder="aisha@example.com"
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">
          {member ? "Save changes" : "Save"}
        </SubmitButton>
        <Link
          href="/staff"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
