"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createService,
  updateService,
  type ServiceFormState,
} from "@/app/(dashboard)/services/actions";
import { ServiceFields } from "./service-fields";
import { SubmitButton } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import type { Service } from "@/lib/types";

/**
 * Whether a form is open lives in the URL (?add=1 / ?edit=<id>), not in React
 * state. The server action redirects back to /services on success, which closes
 * the form as a side effect of navigation — no effect syncing a boolean, no
 * stale open form after a save, and the state survives a refresh.
 */
export function ServiceForm({
  service,
  currency,
}: {
  service?: Service;
  currency: string;
}) {
  const [state, formAction] = useActionState<ServiceFormState, FormData>(
    service ? updateService : createService,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}
      <FormError>{state.error}</FormError>
      <ServiceFields service={service} currency={currency} />
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">
          {service ? "Save changes" : "Save service"}
        </SubmitButton>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
