import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "Overview — BookFlow" };

const steps = [
  {
    title: "Add your services",
    body: "What you offer, how long each one takes, and what it costs.",
    href: "/services",
    cta: "Add a service",
  },
  {
    title: "Set your weekly hours",
    body: "The hours you work each day. Block out time off when plans change.",
    href: "/availability",
    cta: "Set availability",
  },
  {
    title: "Share your booking link",
    body: "Send customers straight to your page. No account needed on their side.",
    href: "/bookings",
    cta: "View bookings",
  },
] as const;

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const bookingPath = `/book/${business.slug}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {business.name}
        </h1>
        <p className="mt-2 text-muted">
          Three things to do before you can take your first booking.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Your public booking page</h2>
        <p className="mt-1.5 font-mono text-sm break-all text-brand">{bookingPath}</p>
        <p className="mt-2 text-sm text-muted">
          Not live yet — it starts working once you have a service and some
          availability.
        </p>
      </section>

      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.href}
            className="flex flex-col rounded-xl border border-border p-5"
          >
            <span className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-brand-soft text-sm font-medium text-brand">
              {i + 1}
            </span>
            <h3 className="font-medium">{step.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              {step.body}
            </p>
            <Link
              href={step.href}
              className="mt-4 text-sm font-medium text-brand hover:underline"
            >
              {step.cta} →
            </Link>
          </li>
        ))}
      </ol>

      <p className="text-sm text-muted">
        Timezone:{" "}
        <span className="font-medium text-foreground">{business.timezone}</span>.
        All times are stored in UTC and shown to you in this zone.
      </p>
    </div>
  );
}
