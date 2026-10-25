"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

export function ConfirmForm({
  slug,
  serviceId,
  staffId,
  startsAt,
  backHref,
}: {
  slug: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  backHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ reference: string } | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId,
          staffId,
          startsAt,
          customerName: formData.get("customer_name"),
          customerEmail: formData.get("customer_email"),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone({ reference: String(body.booking?.id ?? "").slice(0, 8) });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-brand bg-brand-soft p-6">
        <h2 className="text-lg font-semibold">You&apos;re booked</h2>
        <p className="mt-2 text-sm">
          We&apos;ve saved your appointment. Reference{" "}
          <span className="font-mono font-medium">{done.reference}</span>.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      <FormError>{error}</FormError>
      <Field label="Your name">
        <Input name="customer_name" required autoComplete="name" placeholder="Priya Sharma" />
      </Field>
      <Field label="Your email" hint="So we can send you the details.">
        <Input
          name="customer_email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={pending} className="sm:flex-1">
          {pending ? "Confirming…" : "Confirm booking"}
        </Button>
        <a
          href={backHref}
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Pick another time
        </a>
      </div>
    </form>
  );
}
