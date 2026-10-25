import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/components/dashboard/service-form";
import { ServiceRow } from "@/components/dashboard/service-row";
import type { Service } from "@/lib/types";

export const metadata: Metadata = { title: "Services — BookFlow" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; edit?: string }>;
}) {
  const [{ business }, params] = await Promise.all([
    requireBusiness(),
    searchParams,
  ]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("active", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<Service[]>();

  if (error) throw new Error(`Could not load services: ${error.message}`);
  const services = data ?? [];
  const adding = params.add === "1";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-2 text-muted">
            What customers can book, how long each takes, and what it costs.
          </p>
        </div>
        {!adding && (
          <Link
            href="/services?add=1"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
          >
            Add a service
          </Link>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-brand p-5">
          <h2 className="mb-4 font-medium">New service</h2>
          <ServiceForm currency={business.currency} />
        </div>
      )}

      {services.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">No services yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add your first one. Customers pick a service before they pick a
            time, so nothing can be booked until there is at least one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              currency={business.currency}
              editing={params.edit === service.id}
            />
          ))}
        </ul>
      )}

      <p className="text-sm text-muted">
        Hiding a service removes it from your booking page but keeps it on past
        appointments. Services are never deleted, so your booking history stays
        readable.
      </p>
    </div>
  );
}
