import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { StaffForm } from "@/components/dashboard/staff-form";
import { StaffRow } from "@/components/dashboard/staff-row";
import type { Staff } from "@/lib/types";

export const metadata: Metadata = { title: "Team — BookFlow" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; edit?: string }>;
}) {
  const [, params] = await Promise.all([requireBusiness(), searchParams]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .order("active", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<Staff[]>();

  if (error) throw new Error(`Could not load your team: ${error.message}`);
  const team = data ?? [];
  const adding = params.add === "1";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-2 text-muted">
            Whoever delivers the appointments. Availability is set per person.
          </p>
        </div>
        {!adding && (
          <Link
            href="/staff?add=1"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
          >
            Add someone
          </Link>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-brand p-5">
          <h2 className="mb-4 font-medium">New team member</h2>
          <StaffForm />
        </div>
      )}

      {team.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">Nobody on the team yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add at least one person — even if that person is you. Bookings are
            made against a specific individual, which is what makes
            double-booking preventable.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {team.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              editing={params.edit === member.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
