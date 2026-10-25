import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  AddRuleForm,
  AddTimeOffForm,
} from "@/components/dashboard/availability-forms";
import {
  deleteAvailabilityRule,
  deleteTimeOff,
} from "@/app/(dashboard)/availability/actions";
import { SubmitButton } from "@/components/ui/button";
import { DAY_NAMES, displayTimezone } from "@/lib/time";
import type { AvailabilityRule, Staff, TimeOff } from "@/lib/types";

export const metadata: Metadata = { title: "Availability — BookFlow" };

function formatTime(value: string) {
  return value.slice(0, 5); // "09:00:00" -> "09:00"
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const [{ business }, params] = await Promise.all([
    requireBusiness(),
    searchParams,
  ]);
  const supabase = await createClient();

  const { data: staffRows } = await supabase
    .from("staff")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .returns<Staff[]>();

  const team = staffRows ?? [];

  if (team.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">Add someone to the team first</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Working hours belong to a person, not to the business — that is what
            makes it possible to prevent two customers booking the same person
            at the same time.
          </p>
          <Link
            href="/staff?add=1"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
          >
            Add a team member
          </Link>
        </div>
      </div>
    );
  }

  const selected =
    team.find((member) => member.id === params.staff) ?? team[0];

  const [{ data: ruleRows }, { data: timeOffRows }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .eq("staff_id", selected.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true })
      .returns<AvailabilityRule[]>(),
    supabase
      .from("time_off")
      .select("*")
      .eq("staff_id", selected.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .returns<TimeOff[]>(),
  ]);

  const rules = ruleRows ?? [];
  const upcomingTimeOff = timeOffRows ?? [];
  const zone = business.timezone;

  const formatRange = (startsAt: string, endsAt: string) => {
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `${format.format(new Date(startsAt))} → ${format.format(new Date(endsAt))}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="mt-2 text-muted">
          Weekly hours per person, in{" "}
          <span className="font-medium text-foreground">
            {displayTimezone(zone)}
          </span>
          . Slots are generated from these rules — they are never maintained by
          hand.
        </p>
      </div>

      {team.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {team.map((member) => (
            <Link
              key={member.id}
              href={`/availability?staff=${member.id}`}
              className={
                member.id === selected.id
                  ? "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"
                  : "rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface"
              }
            >
              {member.name}
            </Link>
          ))}
        </nav>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Weekly hours — {selected.name}</h2>
        {rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
            No hours set, so nothing can be booked with {selected.name} yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const forDay = rules.filter((rule) => rule.day_of_week === dayIndex);
              return (
                <li
                  key={dayName}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                >
                  <span className="w-24 text-sm font-medium">{dayName}</span>
                  {forDay.length === 0 ? (
                    <span className="text-sm text-muted">Closed</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {forDay.map((rule) => (
                        <form
                          key={rule.id}
                          action={deleteAvailabilityRule}
                          className="flex items-center gap-1.5 rounded-lg bg-surface py-1 pr-1 pl-3"
                        >
                          <span className="font-mono text-sm">
                            {formatTime(rule.start_time)}–{formatTime(rule.end_time)}
                          </span>
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="staff_id" value={selected.id} />
                          <SubmitButton
                            variant="secondary"
                            className="!border-0 !px-2 !py-1 text-muted"
                          >
                            Remove
                          </SubmitButton>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <AddRuleForm staffId={selected.id} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Time off</h2>
        {upcomingTimeOff.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">
            Nothing blocked out.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {upcomingTimeOff.map((off) => (
              <li
                key={off.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm">{formatRange(off.starts_at, off.ends_at)}</p>
                  {off.reason && (
                    <p className="mt-0.5 text-sm text-muted">{off.reason}</p>
                  )}
                </div>
                <form action={deleteTimeOff}>
                  <input type="hidden" name="id" value={off.id} />
                  <input type="hidden" name="staff_id" value={selected.id} />
                  <SubmitButton variant="danger">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddTimeOffForm staffId={selected.id} timezone={displayTimezone(zone)} />
      </section>
    </div>
  );
}
