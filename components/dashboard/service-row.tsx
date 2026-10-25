import Link from "next/link";
import { setServiceActive } from "@/app/(dashboard)/services/actions";
import { ServiceForm } from "./service-form";
import { SubmitButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { Service } from "@/lib/types";

function describe(service: Service, currency: string) {
  const parts = [
    `${service.duration_minutes} min`,
    formatMoney(service.price_cents, currency),
  ];
  if (service.buffer_minutes > 0) parts.push(`+${service.buffer_minutes} min buffer`);
  return parts.join(" · ");
}

export function ServiceRow({
  service,
  currency,
  editing,
}: {
  service: Service;
  currency: string;
  editing: boolean;
}) {
  if (editing) {
    return (
      <li className="rounded-xl border border-brand p-5">
        <ServiceForm service={service} currency={currency} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{service.name}</h3>
          {!service.active && (
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
              Hidden
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{describe(service, currency)}</p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/services?edit=${service.id}`}
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Edit
        </Link>
        <form action={setServiceActive}>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="active" value={String(!service.active)} />
          <SubmitButton variant={service.active ? "danger" : "secondary"}>
            {service.active ? "Hide" : "Show"}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
